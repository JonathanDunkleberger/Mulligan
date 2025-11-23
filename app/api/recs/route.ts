import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../_lib/supabase";
import { MediaItem, Category } from "../../_lib/schema";
import { 
  tmdbGetRecommendations, 
  igdbGetSimilar, 
  gbooksGetSimilar,
  tmdbDiscover,
  igdbDiscover,
  gbooksDiscover
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

    // Fix: Handle potential array structure in media_items and normalize IDs
    const favoritedIds = new Set<string>();
    favorites.forEach((f: any) => {
      const item = Array.isArray(f.media_items) ? f.media_items[0] : f.media_items;
      if (item?.id) favoritedIds.add(item.id);
    });

    // Helper: Calculate cosine similarity (dot product for normalized vectors)
    const cosineSim = (a: number[], b: number[]) => {
      return a.reduce((sum, val, i) => sum + val * b[i], 0);
    };

    await Promise.all(categories.map(async (cat) => {
      // A. Vector Search (Primary - Internal DB)
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

      // B. External Backfill (Secondary - External APIs)
      // If we don't have enough vector matches, use "Smart Discovery"
      if (results[cat].length < 24) {
        const catFavorites = favorites
          .map((f: any) => Array.isArray(f.media_items) ? f.media_items[0] : f.media_items)
          .filter((item: any) => item && item.type === cat);

        if (catFavorites.length > 0) {
           // Strategy 1: Centroids (The "Core" Taste)
           // Find the 3 favorites closest to the mean vector
           const sortedByDistance = catFavorites
             .filter((item: any) => item.embedding)
             .sort((a: any, b: any) => {
               const simA = cosineSim(meanVector, a.embedding);
               const simB = cosineSim(meanVector, b.embedding);
               return simB - simA; // Descending similarity
             });
           
           const seeds = sortedByDistance.slice(0, 3);
           // If no embeddings on favorites yet, fallback to random
           if (seeds.length === 0) seeds.push(...catFavorites.sort(() => 0.5 - Math.random()).slice(0, 3));

           // Strategy 2: Genre Discovery (The "Vibe" Expansion)
           // Extract top genres from all favorites in this category
           const genreCounts: Record<string, number> = {};
           catFavorites.forEach((item: any) => {
             const genres = item.metadata?.genres || [];
             genres.forEach((g: string) => {
               genreCounts[g] = (genreCounts[g] || 0) + 1;
             });
           });
           const topGenres = Object.entries(genreCounts)
             .sort(([,a], [,b]) => b - a)
             .slice(0, 2)
             .map(([g]) => g);

           // Execute External Queries
           const externalPromises: Promise<MediaItem[]>[] = [];

           // 1. Get Similar to Centroids
           for (const seed of seeds) {
              if (cat === 'film' || cat === 'tv' || cat === 'anime') {
                 externalPromises.push(tmdbGetRecommendations(seed.id, cat));
              } else if (cat === 'game') {
                 externalPromises.push(igdbGetSimilar(seed.id));
              } else if (cat === 'book') {
                 externalPromises.push(gbooksGetSimilar(seed.id));
              }
           }

           // 2. Get Discovery by Genre (if supported)
           if (topGenres.length > 0) {
             if (cat === 'film' || cat === 'tv' || cat === 'anime') {
               externalPromises.push(tmdbDiscover(cat, topGenres));
             } else if (cat === 'game') {
               externalPromises.push(igdbDiscover(topGenres));
             } else if (cat === 'book') {
               externalPromises.push(gbooksDiscover(topGenres));
             }
           }

           const externalResults = await Promise.all(externalPromises);
           
           // Flatten and Deduplicate
           const candidates = externalResults.flat();
           
           // Shuffle candidates to mix "Similar To" and "Discovery" results
           // Fisher-Yates shuffle
           for (let i = candidates.length - 1; i > 0; i--) {
             const j = Math.floor(Math.random() * (i + 1));
             [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
           }

           for (const sim of candidates) {
              if (results[cat].length >= 24) break;
              
              const isFav = favoritedIds.has(sim.id);
              const isInResults = results[cat].some(r => r.id === sim.id);
              
              if (!isFav && !isInResults) {
                 results[cat].push(sim);
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
