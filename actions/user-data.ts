"use server";

import { supabase } from "@/app/_lib/supabase";
import { MediaItem } from "@/app/_lib/schema";

export async function getUserFavoriteIds(): Promise<string[]> {
  // Placeholder user ID for guest access
  const userId = "guest_user_123";
  
  // Fetch media_items linked to favorites to get the source_id
  const { data, error } = await supabase
    .from("favorites")
    .select(`
      media_items (
        source,
        source_id,
        type
      )
    `)
    .eq("user_id", userId);

  if (error) {
    console.error("Error fetching likes:", error);
    return [];
  }

  return data.map((row: any) => {
    const item = row.media_items;
    if (!item) return null;
    // Reconstruct the ID used in the frontend: source:category:sourceId
    return `${item.source}:${item.type}:${item.source_id}`; 
  }).filter((id): id is string => id !== null);
}

export async function getUserFavorites(): Promise<MediaItem[]> {
  const userId = "guest_user_123";

  const { data, error } = await supabase
    .from("favorites")
    .select(`
      media_items (
        metadata
      )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching favorites:", error);
    return [];
  }

  if (!data) return [];

  return data.map((row: any) => {
    // The metadata column now holds the exact MediaItem structure
    return row.media_items.metadata as MediaItem;
  });
}


