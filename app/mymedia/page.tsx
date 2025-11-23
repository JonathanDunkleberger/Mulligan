"use client";
import { useEffect, useState } from "react";
import type { MediaItem } from "../_lib/schema";
import MediaTile from "../_components/MediaTile";
import DetailsModal from "../_components/DetailsModal";
import { getFavorites } from "@/actions/get-favorites";

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
        const data = await getFavorites(userId);
        // Cast the result to MediaItem[] as the action returns a compatible shape
        setFavorites(data as unknown as MediaItem[]);
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

