"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import type { MediaItem } from "../_lib/schema";
import MediaTile from "../_components/MediaTile";
import DetailsModal from "../_components/DetailsModal";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function MyMediaPage() {
  const [favorites, setFavorites] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);

  useEffect(() => {
    async function loadFavorites() {
      setLoading(true);
      try {
        // Hardcoded user ID for now (replace with Clerk auth later)
        const userId = "user_123";
        
        const { data, error } = await supabase
          .from('favorites')
          .select('media_id, media_items (*)') // Inner Join
          .eq('user_id', userId);

        if (error) {
          console.error("Error fetching favorites:", error);
          return;
        }

        if (data) {
          const items: MediaItem[] = data.map((row: any) => {
            const item = row.media_items;
            const meta = item.metadata || {};
            
            return {
              id: item.id,
              title: item.title,
              category: item.type === 'movie' ? 'film' : item.type,
              source: "supa",
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
            };
          });
          setFavorites(items);
        }
      } catch (error) {
        console.error("Failed to load favorites", error);
      } finally {
        setLoading(false);
      }
    }
    loadFavorites();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">My Media</h1>
      
      {loading ? (
        <div className="text-gray-500">Loading your favorites...</div>
      ) : favorites.length === 0 ? (
        <div className="text-gray-500">You haven't added any favorites yet.</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {favorites.map(f => (
            <MediaTile 
              key={f.id} 
              item={f} 
              onClick={() => setSelectedItem(f)}
            />
          ))}
        </div>
      )}

      {selectedItem && (
        <DetailsModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}

