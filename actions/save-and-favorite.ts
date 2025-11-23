"use server";

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

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

export async function saveAndFavoriteItem(item: MediaResult, userId: string) {
  try {
    // 1. Check Existence
    // We search by title and type to avoid duplicates
    const { data: existingItems, error: searchError } = await supabase
      .from("media_items")
      .select("id")
      .eq("title", item.title)
      .eq("type", item.type)
      .limit(1);

    if (searchError) {
      console.error("Error searching for item:", searchError);
      throw new Error("Database search failed");
    }

    let mediaId: string;

    if (existingItems && existingItems.length > 0) {
      // Found existing item
      mediaId = existingItems[0].id;
      
      // Optional: Update metadata if it's missing or we have better data now?
      // For now, we'll just use the existing ID.
    } else {
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
            backdrop_url: item.backdropUrl,
            trailer_url: item.trailerUrl,
            genres: item.genres,
            year: item.releaseYear,
            external_rating: item.matchScore,
            source_id: item.sourceId
          },
          embedding: embedding,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("Error inserting item:", insertError);
        throw new Error("Failed to ingest new item");
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
      console.error("Error favoriting item:", favError);
      throw new Error("Failed to favorite item");
    }

    return { success: true };
  } catch (error) {
    console.error("Error in saveAndFavoriteItem:", error);
    // Return success: false so the UI can handle it
    return { success: false };
  }
}
