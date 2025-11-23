"use server";

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; 
const supabase = createClient(supabaseUrl, supabaseKey);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function saveAndFavoriteItem(item: any) {
  // 1. Authentication Check (Placeholder)
  const userId = "guest_user_123";
  
  try {
    // 2. Check if item exists (Idempotency)
    // We check by Title + Type because IDs from external APIs might overlap
    const { data: existing } = await supabase
      .from('media_items')
      .select('id')
      .eq('title', item.title)
      .eq('type', item.type)
      .maybeSingle();

    let mediaId = existing?.id;

    // 3. Lazy Ingest (If New)
    if (!mediaId) {
      console.log(`⚡ Generating Vector for: ${item.title}`);
      const embeddingResp = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: `${item.title} ${item.description} ${item.genres?.join(" ")}`
      });

      const { data: newItem, error: insertError } = await supabase
        .from('media_items')
        .insert({
          title: item.title,
          type: item.type,
          description: item.description || "",
          embedding: embeddingResp.data[0].embedding,
          // CRITICAL: Save ALL metadata here so My Media looks good
          metadata: {
            cover_url: item.imageUrl,
            backdrop_url: item.backdropUrl,
            trailer_url: item.trailerUrl,
            genres: item.genres,
            release_year: item.releaseYear,
            vote_average: item.matchScore,
            source_id: item.sourceId
          }
        })
        .select('id')
        .single();

      if (insertError) throw insertError;
      mediaId = newItem.id;
    }

    // 4. Favorite Link (The "Heart")
    const { error: favError } = await supabase
      .from('favorites')
      .upsert({ 
        user_id: userId, 
        media_id: mediaId 
      }, { onConflict: 'user_id, media_id' });

    if (favError) throw favError;

    console.log(`❤️ Favorited: ${item.title} for User: ${userId}`);
    return { success: true };

  } catch (error: any) {
    console.error("❌ Save Logic Error:", error.message);
    return { success: false, error: error.message };
  }
}
