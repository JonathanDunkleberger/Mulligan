import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../_lib/supabase";
import { MediaItem, Category } from "../../_lib/schema";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper to calculate vector mean
function calculateMeanVector(embeddings: number[][]): number[] {
  if (embeddings.length === 0) return [];
  const dim = embeddings[0].length;
  const mean = new Array(dim).fill(0);
  
  for (const vec of embeddings) {
    for (let i = 0; i < dim; i++) {
      mean[i] += vec[i];
    }
  }
  
  for (let i = 0; i < dim; i++) {
    mean[i] /= embeddings.length;
  }
  
  return mean;
}

export async function POST(req: NextRequest) {
  const userId = "guest_user_123"; 

  try {
    // 1. Fetch all user favorites with their embeddings
    const { data: favorites, error } = await supabase
      .from("favorites")
      .select(`
        media_items (
          id,
          title,
          description,
          type,
          embedding,
          metadata
        )
      `)
      .eq("user_id", userId);

    if (error || !favorites || favorites.length === 0) {
      // Return empty instead of 400 to prevent UI crash
      return NextResponse.json({ film: [], tv: [], anime: [], game: [], book: [] });
    }

    // Extract embeddings
    let embeddings = favorites
      .map((f: any) => f.media_items?.embedding)
      .filter((e: any) => e !== null && Array.isArray(e));

    // SELF-HEALING: If we have favorites but no embeddings, generate them now
    if (embeddings.length === 0) {
      console.log("⚠️ No embeddings found. Attempting self-healing...");
      const itemsToHeal = favorites.slice(0, 3); // Heal top 3 to get started
      
      for (const f of itemsToHeal) {
        const item = f.media_items;
        if (!item) continue;
        
        try {
          const embeddingResp = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: `${item.title} ${item.description || ""} ${item.type}`
          });
          const vec = embeddingResp.data[0].embedding;
          
          // Update DB
          await supabase
            .from('media_items')
            .update({ embedding: vec })
            .eq('id', item.id);
            
          embeddings.push(vec);
        } catch (err) {
          console.error("Failed to heal item:", item.title, err);
        }
      }
    }

    if (embeddings.length === 0) {
      // Still no embeddings? Return empty.
      return NextResponse.json({ film: [], tv: [], anime: [], game: [], book: [] });
    }

    // 2. Calculate Mean Vector (The "Vibe")
    const meanVector = calculateMeanVector(embeddings);

    // 3. Query for nearest neighbors in each category
    const categories: Category[] = ["film", "tv", "anime", "game", "book"];
    const results: Record<Category, MediaItem[]> = { film: [], tv: [], anime: [], game: [], book: [] };

    const favoritedIds = new Set(favorites.map((f: any) => f.media_items?.id));

    await Promise.all(categories.map(async (cat) => {
      const { data: recs, error: rpcError } = await supabase.rpc("match_media_items", {
        query_embedding: meanVector,
        match_threshold: 0.3, 
        match_count: 20,
        filter_category: cat
      });

      if (rpcError) {
        console.error(`RPC Error for ${cat}:`, rpcError);
        // Fallback? For now just return empty for this cat
        return;
      }

      if (recs) {
        results[cat] = recs
          .filter((r: any) => !favoritedIds.has(r.id))
          .map((r: any) => r.metadata as MediaItem);
      }
    }));

    return NextResponse.json(results);

  } catch (e) {
    console.error("Recs API Error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
