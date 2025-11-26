"use server";

import { supabase } from "../app/_lib/supabase";
import OpenAI from "openai";
import type { MediaItem } from "../app/_lib/schema";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function dislikeItem(item: MediaItem) {
  const userId = "guest_user_123";
  
  try {
    // 1. Check if item exists (Idempotency)
    const { data: existing } = await supabase
      .from('media_items')
      .select('id, embedding')
      .eq('source', item.source)
      .eq('source_id', item.sourceId)
      .maybeSingle();

    let mediaId = existing?.id;

    // 2. Lazy Ingest (If New)
    // Even for dislikes, we need the media item in our DB to reference it
    if (!mediaId) {
      console.log(`⚡ Generating Vector for Dislike: ${item.title}`);
      const embeddingResp = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: `${item.title} ${item.summary || ""} ${item.genres?.join(" ")}`
      });
      const vec = embeddingResp.data[0].embedding;

      const { data: newItem, error: insertError } = await supabase
        .from('media_items')
        .insert({
          title: item.title,
          type: item.category,
          description: item.summary || "",
          source: item.source,
          source_id: item.sourceId,
          embedding: vec,
          metadata: item
        })
        .select('id')
        .single();

      if (insertError) throw insertError;
      mediaId = newItem.id;
    }

    // 3. Insert into Dislikes
    const { error: dislikeError } = await supabase
      .from('dislikes')
      .upsert({ 
        user_id: userId, 
        media_id: mediaId 
      }, { onConflict: 'user_id, media_id' });

    if (dislikeError) throw dislikeError;

    // 4. Remove from Favorites if it exists there (can't like and dislike same item)
    await supabase
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('media_id', mediaId);

    console.log(`👎 Disliked: ${item.title} for User: ${userId}`);
    return { success: true };

  } catch (error: any) {
    console.error("❌ Dislike Logic Error:", error.message);
    return { success: false, error: error.message };
  }
}
