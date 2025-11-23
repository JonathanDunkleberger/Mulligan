"use server";

import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
// Note: In a real app, you might want to use a singleton or a helper file
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

type MediaItem = {
  id: string;
  title: string;
  type: string;
  description: string;
  metadata: any;
  similarity?: number;
};

export async function getCategoryRecommendations(
  userId: string,
  category: string
): Promise<MediaItem[]> {
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

    let recommendations: MediaItem[] = [];

    // Strategy: 0 Favorites -> Recent items
    if (validFavorites.length === 0) {
      const { data: recentItems, error: recentError } = await supabase
        .from("media_items")
        .select("id, title, type, description, metadata")
        .eq("type", category)
        .limit(15)
        .returns<MediaItem[]>();

      if (recentError) throw recentError;
      recommendations = recentItems || [];
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
          match_count: 5,
          filter_type: category,
        })
      );

      const results = await Promise.all(promises);

      // Combine results
      const allMatches: MediaItem[] = [];
      results.forEach((res: any) => {
        if (res.data) {
          // res.data is unknown, cast it
          allMatches.push(...(res.data as MediaItem[]));
        }
      });

      // Deduplicate
      const seen = new Set<string>();
      const deduped: MediaItem[] = [];

      for (const item of allMatches) {
        // Skip if already favorited
        if (favoriteIds.has(item.id)) continue;
        // Skip if already added to recommendations
        if (seen.has(item.id)) continue;

        seen.add(item.id);
        deduped.push(item);
      }

      recommendations = deduped;
    }

    // Shuffle (Fisher-Yates)
    for (let i = recommendations.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [recommendations[i], recommendations[j]] = [recommendations[j], recommendations[i]];
    }

    // Limit to 15
    return recommendations.slice(0, 15);

  } catch (error) {
    console.error("Error fetching recommendations:", error);
    return [];
  }
}
