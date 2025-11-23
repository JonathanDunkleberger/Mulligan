import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../_lib/supabase";
import { MediaItem, Category } from "../../_lib/schema";
import { 
  tmdbGetRecommendations, 
  igdbGetSimilar, 
  gbooksGetSimilar 
} from "../../_lib/adapters.server";
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
        const itemData = f.media_items;
        // Supabase might return an array for the relation
        const item = Array.isArray(itemData) ? itemData[0] : itemData;

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
          console.error("Failed to heal item:", item?.title, err);
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
      // A. Vector Search (Primary)
      const { data: recs, error: rpcError } = await supabase.rpc("match_media_items", {
        query_embedding: meanVector,
        match_threshold: 0.3, 
        match_count: 24,
        filter_category: cat
      });

      if (rpcError) {
        console.error(`RPC Error for ${cat}:`, rpcError);
      } else if (recs) {
        results[cat] = recs
          .filter((r: any) => !favoritedIds.has(r.id))
          .map((r: any) => r.metadata as MediaItem);
      }

      // B. External Backfill (Secondary)
      // If we don't have enough vector matches, fetch "similar" items from external APIs
      // based on the user's existing favorites in this category.
      if (results[cat].length < 24) {
        // Find favorites of this category to use as seeds
        const catFavorites = favorites.filter((f: any) => {
           const item = Array.isArray(f.media_items) ? f.media_items[0] : f.media_items;
           return item && item.type === cat;
        });

        if (catFavorites.length > 0) {
           // Pick up to 3 random favorites to diversify the backfill
           const seeds = catFavorites.sort(() => 0.5 - Math.random()).slice(0, 3);
           
           for (const seed of seeds) {
              if (results[cat].length >= 24) break;
              
              const item = Array.isArray(seed.media_items) ? seed.media_items[0] : seed.media_items;
              let similarItems: MediaItem[] = [];
              
              try {
                 if (cat === 'film' || cat === 'tv' || cat === 'anime') {
                    similarItems = await tmdbGetRecommendations(item.id, cat);
                 } else if (cat === 'game') {
                    similarItems = await igdbGetSimilar(item.id);
                 } else if (cat === 'book') {
                    similarItems = await gbooksGetSimilar(item.id);
                 }
              } catch (err) {
                 console.error(`External fetch failed for ${cat} seed ${item.title}`, err);
              }
              
              // Append unique items
              for (const sim of similarItems) {
                 if (results[cat].length >= 24) break;
                 
                 const isFav = favoritedIds.has(sim.id);
                 const isInResults = results[cat].some(r => r.id === sim.id);
                 
                 if (!isFav && !isInResults) {
                    results[cat].push(sim);
                 }
              }
           }
        }
      }
    }));

    return NextResponse.json(results);

  } catch (e) {
    console.error("Recs API Error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
