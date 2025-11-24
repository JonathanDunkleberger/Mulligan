"use client";
import { useEffect, useState } from "react";
import type { MediaItem } from "../_lib/schema";
import MediaTile from "../_components/MediaTile";
import DetailsModal from "../_components/DetailsModal";
import { getUserFavorites } from "@/actions/user-data";
import { removeFavorite } from "@/actions/remove-favorite";

import Link from "next/link";

export default function MyMediaPage() {
  const [favorites, setFavorites] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);

  useEffect(() => {
    async function loadFavorites() {
      setLoading(true);
      try {
        const items = await getUserFavorites();
        setFavorites(items);
      } catch (error) {
        console.error("Failed to load favorites", error);
      } finally {
        setLoading(false);
      }
    }
    loadFavorites();
  }, []);

  const handleRemoveFavorite = async (item: MediaItem) => {
    // Optimistic update
    setFavorites(prev => prev.filter(i => i.id !== item.id));
    
    const result = await removeFavorite(item.source, item.sourceId);
    if (!result.success) {
      // Revert
      setFavorites(prev => [...prev, item]);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-6 mb-6 ml-4">
        <h1 className="text-3xl font-bold text-white">My Media</h1>
        <Link href="/wrapped" className="text-3xl font-bold text-gray-500 hover:text-white transition-colors">Wrapped</Link>
      </div>
      
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
              isFavorited={true}
              onToggleFavorite={handleRemoveFavorite}
            />
          ))}
        </div>
      )}

      {selectedItem && (
        <DetailsModal 
          item={selectedItem} 
          onClose={() => setSelectedItem(null)} 
          isFavorited={true}
          onToggleFavorite={handleRemoveFavorite}
        />
      )}
    </div>
  );
}


