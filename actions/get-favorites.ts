"use server";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function getFavorites(userId: string) {
  try {
    const { data, error } = await supabase
      .from('favorites')
      .select(`
        media_id,
        media_items (
          id,
          title,
          type,
          description,
          metadata
        )
      `)
      .eq('user_id', userId);

    if (error) {
      console.error("Error fetching favorites:", error);
      return [];
    }

    // Flatten the structure
    return data.map((item: any) => {
      const m = item.media_items;
      return {
        id: m.id,
        title: m.title,
        category: m.type === 'movie' ? 'film' : m.type, // Map DB type to Schema type
        description: m.description,
        imageUrl: m.metadata?.cover_url || m.metadata?.imageUrl || "https://placehold.co/400x600?text=" + encodeURIComponent(m.title),
        source: "supa",
        sourceId: m.metadata?.source_id || m.id,
        year: m.metadata?.year ? parseInt(m.metadata.year) : undefined,
        genres: m.metadata?.genres || [],
      };
    });
  } catch (error) {
    console.error("Unexpected error fetching favorites:", error);
    return [];
  }
}
