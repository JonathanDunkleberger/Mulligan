"use server";

import { supabase } from "../app/_lib/supabase";
import OpenAI from "openai";
import type { MediaItem } from "../app/_lib/schema";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function saveAndFavoriteItem(item: MediaItem) {
  // 1. Authentication Check (Placeholder)
  const userId = "guest_user_123";
  
  try {
    // 2. Check if item exists (Idempotency)
    const { data: existing } = await supabase
      .from('media_items')
      .select('id')
      .eq('source', item.source)
      .eq('source_id', item.sourceId)
      .maybeSingle();

    let mediaId = existing?.id;

    // 3. Lazy Ingest (If New)
    if (!mediaId) {
      console.log(`⚡ Generating Vector for: ${item.title}`);
      const embeddingResp = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: `${item.title} ${item.summary || ""} ${item.genres?.join(" ")}`
      });

      const { data: newItem, error: insertError } = await supabase
        .from('media_items')
        .insert({
          title: item.title,
          type: item.category,
          description: item.summary || "",
          source: item.source,
          source_id: item.sourceId,
          embedding: embeddingResp.data[0].embedding,
          // CRITICAL: Save ALL metadata here so My Media looks good
          metadata: item
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

