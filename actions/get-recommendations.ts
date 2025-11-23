"use server";

import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Define the rich return type
export type RecommendedItem = {
  id: string;
  title: string;
  category: string;
  description: string;
  imageUrl: string;
  backdropUrl?: string;
  trailerUrl?: string;
  genres: string[];
  year?: number;
  matchScore?: number;
  source: "supa";
  sourceId: string;
  videos?: { id: string; title: string; thumbnail: string }[];
};

export async function getCategoryRecommendations(
  userId: string,
  category: string
): Promise<RecommendedItem[]> {
  try {
    // 1. Fetch all favorites for this user to exclude them later
    // and to get the embeddings for the "Shotgun"
    const { data: favorites, error: favError } = await supabase
      .from("favorites")
      .select(`
        media_id,
        created_at,
        media_items (
          id,
          embedding
        )
      `)
      .eq("user_id", userId)
      .returns<{
        media_id: string;
        created_at: string;
        media_items: { id: string; embedding: string } | null;
      }[]>();

    if (favError) throw favError;

    const favoriteIds = new Set(favorites?.map((f: any) => f.media_id));
    
    // Filter out favorites that might have missing media_items (deleted?)
    const validFavorites = favorites
      ?.filter((f: any) => f.media_items)
      .map((f: any) => ({
        id: f.media_items!.id,
        embedding: f.media_items!.embedding,
        created_at: f.created_at,
      })) || [];

    let rawItems: any[] = [];

    // Strategy: 0 Favorites -> Recent items
    if (validFavorites.length === 0) {
      const { data: recentItems, error: recentError } = await supabase
        .from("media_items")
        .select("id, title, type, description, metadata")
        .eq("type", category)
        .limit(24) // Increased limit
        .returns<any[]>();

      if (recentError) throw recentError;
      rawItems = recentItems || [];
    } 
    // Strategy: > 0 Favorites -> Shotgun Approach
    else {
      // Sort by most recent favorite first
      validFavorites.sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // Pick top 5 most recent favorites
      const seeds = validFavorites.slice(0, 5);

      // Run parallel RPC calls
      const promises = seeds.map((seed: any) =>
        supabase.rpc("get_recommendations", {
          query_embedding: seed.embedding,
          match_threshold: 0.5, // Adjust based on your embedding model's scale
          match_count: 10, // Fetch more to allow for deduping
          filter_type: category,
        })
      );

      const results = await Promise.all(promises);

      // Combine results
      const allMatches: any[] = [];
      results.forEach((res: any) => {
        if (res.data) {
          allMatches.push(...(res.data as any[]));
        }
      });

      // Deduplicate
      const seen = new Set<string>();
      
      for (const item of allMatches) {
        // Skip if already favorited
        if (favoriteIds.has(item.id)) continue;
        // Skip if already added to recommendations
        if (seen.has(item.id)) continue;

        seen.add(item.id);
        rawItems.push(item);
      }
    }

    // Shuffle (Fisher-Yates)
    for (let i = rawItems.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rawItems[i], rawItems[j]] = [rawItems[j], rawItems[i]];
    }

    // Limit to 24 and Map to Rich Object
    return rawItems.slice(0, 24).map(item => {
      const meta = item.metadata || {};
      
      // Construct videos array if trailer exists
      let videos: any[] = [];
      if (meta.trailer_url) {
        const videoId = meta.trailer_url.split('v=')[1];
        if (videoId) {
          videos.push({
            id: videoId,
            title: "Trailer",
            thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
          });
        }
      }

      return {
        id: item.id,
        title: item.title,
        category: item.type === 'movie' ? 'film' : item.type,
        description: item.description,
        imageUrl: meta.cover_url || meta.imageUrl || "https://placehold.co/400x600?text=" + encodeURIComponent(item.title),
        backdropUrl: meta.backdrop_url,
        trailerUrl: meta.trailer_url,
        genres: meta.genres || [],
        year: meta.release_year ? parseInt(meta.release_year) : (meta.year ? parseInt(meta.year) : undefined),
        matchScore: meta.vote_average !== undefined ? meta.vote_average : meta.external_rating,
        source: "supa",
        sourceId: meta.source_id || item.id,
        videos: videos
      };
    });

  } catch (error) {
    console.error("Error fetching recommendations:", error);
    return [];
  }
}
