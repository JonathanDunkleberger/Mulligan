import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../_lib/supabase";
import { MediaItem, Category } from "../../_lib/schema";

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
  // We don't rely on the body favorites anymore for the core logic, 
  // we fetch fresh embeddings from the DB to ensure we have the vectors.
  // But we might use the body to know *which* items to exclude if the client has local state.
  // For now, let's fetch everything server-side.
  
  const userId = "guest_user_123"; // Hardcoded for now as per other files

  try {
    // 1. Fetch all user favorites with their embeddings
    const { data: favorites, error } = await supabase
      .from("favorites")
      .select(`
        media_items (
          id,
          title,
          embedding,
          metadata
        )
      `)
      .eq("user_id", userId);

    if (error || !favorites || favorites.length === 0) {
      return NextResponse.json({ error: "No favorites found" }, { status: 400 });
    }

    // Extract embeddings
    const embeddings = favorites
      .map((f: any) => f.media_items?.embedding)
      .filter((e: any) => e !== null && Array.isArray(e));

    if (embeddings.length === 0) {
      return NextResponse.json({ error: "No embeddings found for favorites" }, { status: 400 });
    }

    // 2. Calculate Mean Vector (The "Vibe")
    const meanVector = calculateMeanVector(embeddings);

    // 3. Query for nearest neighbors in each category
    const categories: Category[] = ["film", "tv", "anime", "game", "book"];
    const results: Record<Category, MediaItem[]> = { film: [], tv: [], anime: [], game: [], book: [] };

    // We exclude items the user has already favorited
    const favoritedIds = new Set(favorites.map((f: any) => f.media_items?.id));

    await Promise.all(categories.map(async (cat) => {
      const { data: recs, error: rpcError } = await supabase.rpc("match_media_items", {
        query_embedding: meanVector,
        match_threshold: 0.3, // Lower threshold to ensure we get results
        match_count: 20,
        filter_category: cat
      });

      if (rpcError) {
        console.error(`RPC Error for ${cat}:`, rpcError);
        return;
      }

      if (recs) {
        // Map back to MediaItem and filter out existing favorites
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
