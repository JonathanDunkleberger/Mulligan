"use server";

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { auth } from "@clerk/nextjs/server";

// Initialize Supabase with Service Role Key to allow inserting into media_items
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; 
const supabase = createClient(supabaseUrl, supabaseKey);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Define the interface matching the search API result and TrendingItem
interface MediaResult {
  id: string;
  title: string;
  type: 'movie' | 'tv' | 'book' | 'game';
  description: string;
  imageUrl: string;
  releaseYear: string;
  sourceId: string;
  // Extended metadata
  backdropUrl?: string;
  trailerUrl?: string;
  genres?: string[];
  matchScore?: number;
}

export async function saveAndFavoriteItem(item: MediaResult) {
  try {
    // 0. Authentication
    const { userId } = auth();
    if (!userId) {
      throw new Error("User not authenticated");
    }

    // 1. Check Existence (Optimized)
    // Try to find by sourceId first (more reliable), then fallback to title/type
    let mediaId: string | null = null;

    // Check by source_id in metadata
    const { data: existingBySource, error: sourceError } = await supabase
      .from("media_items")
      .select("id")
      .eq("metadata->>source_id", item.sourceId)
      .limit(1);

    if (existingBySource && existingBySource.length > 0) {
      mediaId = existingBySource[0].id;
    } else {
      // Fallback: Check by title and type
      const { data: existingByTitle, error: titleError } = await supabase
        .from("media_items")
        .select("id")
        .eq("title", item.title)
        .eq("type", item.type)
        .limit(1);
        
      if (existingByTitle && existingByTitle.length > 0) {
        mediaId = existingByTitle[0].id;
      }
    }

    if (!mediaId) {
      // 2. Lazy Ingest (New Item)
      console.log(`Lazy ingesting: ${item.title}`);

      // Generate Embedding
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: `${item.title}: ${item.description}`,
      });
      const embedding = embeddingResponse.data[0].embedding;

      // Insert into media_items
      const { data: newItem, error: insertError } = await supabase
        .from("media_items")
        .insert({
          title: item.title,
          type: item.type,
          description: item.description,
          metadata: { 
            cover_url: item.imageUrl,
            backdrop_url: item.backdropUrl || "",
            trailer_url: item.trailerUrl || "",
            genres: item.genres || [],
            release_year: item.releaseYear || "",
            vote_average: item.matchScore || 0,
            source_id: item.sourceId
          },
          embedding: embedding,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("Supabase Insert Error:", insertError);
        return { success: false, error: insertError.message };
      }
      
      mediaId = newItem.id;
    }

    // 3. Favorite the item
    const { error: favError } = await supabase
      .from("favorites")
      .upsert(
        { user_id: userId, media_id: mediaId },
        { onConflict: "user_id, media_id" }
      );

    if (favError) {
      console.error("Supabase Favorite Error:", favError);
      return { success: false, error: favError.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error("Error in saveAndFavoriteItem:", error);
    return { success: false, error: error.message || "Unknown error" };
  }
}
