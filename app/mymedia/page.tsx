"use client";
import { useEffect, useState } from "react";
import type { MediaItem } from "../_lib/schema";
import { FavoritesStore } from "../_state/favorites";
import MediaTile from "../_components/MediaTile";
import DetailsModal from "../_components/DetailsModal";

export default function MyMediaPage() {
  const [favorites, setFavorites] = useState<MediaItem[]>(FavoritesStore.read());
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);

  useEffect(() => {
    const unsubscribe = FavoritesStore.subscribe(setFavorites);
    return () => { unsubscribe(); };
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">My Media</h1>
      
      {favorites.length === 0 ? (
        <div className="text-gray-500">You haven't added any favorites yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

