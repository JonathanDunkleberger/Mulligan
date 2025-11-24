"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { saveAndFavoriteItem } from "@/actions/save-and-favorite";
import { removeFavorite } from "@/actions/remove-favorite";
import type { MediaItem } from "../_lib/schema";

export default function FavoriteButton({ item, initialIsFavorited = false }: { item: MediaItem, initialIsFavorited?: boolean }) {
  const [isFavorited, setIsFavorited] = useState(initialIsFavorited);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    setLoading(true);
    try {
      if (isFavorited) {
        await removeFavorite(item.id);
        setIsFavorited(false);
      } else {
        await saveAndFavoriteItem(item);
        setIsFavorited(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`
        flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all duration-300
        ${isFavorited 
          ? "bg-red-500/20 text-red-500 border border-red-500/50 hover:bg-red-500/30" 
          : "bg-white text-black hover:bg-gray-200"
        }
      `}
    >
      <Heart className={isFavorited ? "fill-current" : ""} size={20} />
      {loading ? "Updating..." : (isFavorited ? "Saved to Library" : "Add to Favorites")}
    </button>
  );
}
