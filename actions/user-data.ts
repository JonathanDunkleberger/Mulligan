"use server";

import { createClient } from "@supabase/supabase-js";
import { MediaItem } from "@/app/_lib/schema";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Use Service Role to bypass RLS
const supabase = createClient(supabaseUrl, supabaseKey);

export async function getUserFavoriteIds(): Promise<string[]> {
  // Placeholder user ID for guest access
  const userId = "guest_user_123";
  
  // Fetch media_items linked to favorites to get the source_id
  const { data, error } = await supabase
    .from("favorites")
    .select(`
      media_items (
        type,
        metadata
      )
    `)
    .eq("user_id", userId);

  if (error) {
    console.error("Error fetching likes:", error);
    return [];
  }

  return data.map((row: any) => {
    const item = row.media_items;
    if (!item || !item.metadata) return null;
    
    const sourceId = item.metadata.source_id;
    if (!sourceId) return null;

    // Reconstruct the ID used in the frontend (e.g. tmdb-123)
    let prefix = "tmdb";
    if (item.type === "game") prefix = "igdb";
    if (item.type === "book") prefix = "google_books";
    
    return `${prefix}-${sourceId}`;
  }).filter((id): id is string => id !== null);
}

export async function getUserFavorites(): Promise<MediaItem[]> {
  const userId = "guest_user_123";

  const { data, error } = await supabase
    .from("favorites")
    .select(`
      media_id,
      media_items (*)
    `)
    .eq("user_id", userId);

  if (error) {
    console.error("Error fetching favorites:", error);
    return [];
  }

  if (!data) return [];

  return data.map((row: any) => {
    const item = row.media_items;
    const meta = item.metadata || {};
    
    return {
      id: item.id,
      title: item.title,
      category: item.type === 'movie' ? 'film' : item.type,
      source: "supa", // Indicates it came from our DB
      sourceId: meta.source_id || item.id,
      imageUrl: meta.cover_url || meta.imageUrl || "https://placehold.co/400x600?text=" + encodeURIComponent(item.title),
      backdropUrl: meta.backdrop_url,
      genres: meta.genres || [],
      year: meta.release_year ? parseInt(meta.release_year) : (meta.year ? parseInt(meta.year) : undefined),
      summary: item.description,
      rating: meta.vote_average !== undefined ? meta.vote_average / 10 : meta.rating,
      creators: meta.creators,
      status: meta.status,
      videos: meta.trailer_url ? [{
        id: meta.trailer_url.split('v=')[1] || 'trailer',
        title: 'Trailer',
        thumbnail: `https://img.youtube.com/vi/${meta.trailer_url.split('v=')[1] || ''}/mqdefault.jpg`
      }] : []
    } as MediaItem;
  });
}
