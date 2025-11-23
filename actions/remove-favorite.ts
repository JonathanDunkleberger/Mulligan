"use server";

import { supabase } from "@/app/_lib/supabase";

export async function removeFavorite(source: string, sourceId: string) {
  try {
    const userId = "guest_user_123";

    // 1. Find the media_id
    const { data: mediaItems, error: findError } = await supabase
      .from("media_items")
      .select("id")
      .eq("source", source)
      .eq("source_id", sourceId)
      .limit(1);

    if (findError) {
      console.error("Error finding media item:", findError);
      return { success: false, error: findError.message };
    }

    if (!mediaItems || mediaItems.length === 0) {
      return { success: true };
    }

    const mediaId = mediaItems[0].id;

    // 2. Delete from favorites
    const { error: deleteError } = await supabase
      .from("favorites")
      .delete()
      .match({ user_id: userId, media_id: mediaId });

    if (deleteError) {
      console.error("Error removing favorite:", deleteError);
      return { success: false, error: deleteError.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error("Error in removeFavorite:", error);
    return { success: false, error: error.message };
  }
}

