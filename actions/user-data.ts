"use server";

import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Use Service Role to bypass RLS
const supabase = createClient(supabaseUrl, supabaseKey);

export async function getUserFavoriteIds(): Promise<string[]> {
  const { userId } = auth();
  if (!userId) return [];

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
