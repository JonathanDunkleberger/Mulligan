"use client";

import Image from "next/image";
import type { MediaItem } from "../_lib/schema";
import { FavoritesStore } from "../_state/favorites";
import { Heart, Plus } from "lucide-react";
import { useState, useEffect } from "react";

export default function MediaTile({
  item,
  onClick,
  showAddHint
}: {
  item: MediaItem;
  onClick?: () => void; // If provided, this is the primary action (e.g. open details)
  showAddHint?: boolean;
}) {
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    const checkFav = () => {
      const favs = FavoritesStore.read();
      setIsFavorite(favs.some(f => f.id === item.id));
    };
    checkFav();
    const unsub = FavoritesStore.subscribe(checkFav);
    return () => { unsub(); };
  }, [item.id]);

  const toggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFavorite) {
      FavoritesStore.remove(item.id);
    } else {
      FavoritesStore.add(item);
    }
  };

  return (
    <div 
      className="tile group cursor-pointer relative transition-all duration-300 hover:scale-125 hover:z-50 origin-center"
      onClick={onClick}
    >
      <div className="aspect-video relative overflow-hidden rounded-md bg-[#222]">
        {item.imageUrl || item.backdropUrl ? (
          <Image 
            src={item.backdropUrl || item.imageUrl!} 
            alt={item.title} 
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-gray-400 p-2 text-center text-sm">
            {item.title}
          </div>
        )}
      </div>
      
      {/* Hover Overlay */}
      <div className="absolute inset-0 bg-black/90 opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-4 flex flex-col justify-between rounded-md">
        <div>
          <h4 className="text-white font-bold text-sm leading-tight mb-2 line-clamp-2">{item.title}</h4>
          <div className="flex flex-wrap gap-2 items-center text-[10px] text-gray-300">
            <span className="uppercase tracking-wider border border-gray-600 px-1.5 py-0.5 rounded">
              {item.category}
            </span>
            {item.year && <span className="font-medium">{item.year}</span>}
          </div>
          {item.genres && item.genres.length > 0 && (
             <div className="mt-2 text-[10px] text-gray-400 line-clamp-1">
               {item.genres.slice(0, 3).join(" • ")}
             </div>
          )}
        </div>
        
        <div className="flex gap-2 mt-2">
          <button 
            className="flex-1 bg-white/10 hover:bg-white/20 text-white rounded-full p-1.5 flex items-center justify-center transition-colors"
            onClick={toggleFavorite}
            title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
          >
            <Heart size={16} className={isFavorite ? "fill-red-500 text-red-500" : "text-white"} />
          </button>
          <button 
            className="flex-1 bg-white text-black rounded-full p-1.5 flex items-center justify-center hover:bg-gray-200 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onClick?.();
            }}
            title="More Details"
          >
            <Plus size={16} strokeWidth={3} />
          </button>
        </div>
      </div>
    </div>
  );
}

