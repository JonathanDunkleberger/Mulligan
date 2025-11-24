"use client";

import Image from "next/image";
import type { MediaItem } from "../_lib/schema";
import { Heart, Plus } from "lucide-react";

export default function MediaTile({
  item,
  onClick,
  isFavorited = false,
  onToggleFavorite,
  showAddHint
}: {
  item: MediaItem;
  onClick?: () => void;
  isFavorited?: boolean;
  onToggleFavorite?: (item: MediaItem) => void;
  showAddHint?: boolean;
}) {
  const isPortrait = item.category === "book" || item.category === "game";
  const aspectRatio = isPortrait ? "aspect-[2/3]" : "aspect-video";
  const imageSrc = (isPortrait ? item.imageUrl : item.backdropUrl) || item.imageUrl || item.backdropUrl;

  return (
    <div 
      className="tile group cursor-pointer relative transition-all duration-300 hover:scale-110 hover:z-50 origin-center"
      onClick={onClick}
    >
      <div className={`${aspectRatio} relative overflow-hidden rounded-md bg-[#222]`}>
        {imageSrc ? (
          <Image 
            src={imageSrc} 
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
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-4 flex flex-col justify-end rounded-md">
        
        <div className="absolute top-2 right-2 flex flex-col gap-2 z-50">
          <button 
            className="w-8 h-8 bg-black/60 hover:bg-black/80 backdrop-blur-md text-white rounded-full flex items-center justify-center transition-colors border border-white/10 cursor-pointer"
            onClick={handleHeartClick}
            title={isFavorited ? "Saved" : "Add to Favorites"}
          >
            <Heart size={16} className={isFavorited ? "fill-red-500 text-red-500" : "text-white"} />
          </button>
          <button 
            className="w-8 h-8 bg-white text-black rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onClick?.();
            }}
            title="More Details"
          >
            <Plus size={16} strokeWidth={3} />
          </button>
        </div>

        <div className="translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
          <div className="flex items-end justify-between">
            <div className="flex-1">
              <h4 className="text-white font-bold text-sm leading-tight mb-2 line-clamp-2 drop-shadow-md">{item.title}</h4>
              <div className="flex flex-wrap gap-2 items-center text-[10px] text-gray-200 mb-2">
                <span className="uppercase tracking-wider border border-gray-400 px-1.5 py-0.5 rounded bg-black/30 backdrop-blur-sm">
                  {item.category}
                </span>
                {item.year && <span className="font-medium drop-shadow-md">{item.year}</span>}
                {item.rating && (
                  <span className="text-green-400 font-bold drop-shadow-md">
                    {Math.round(item.rating * 10)}% Match
                  </span>
                )}
              </div>
              {item.genres && item.genres.length > 0 && (
                <div className="text-[10px] text-gray-300 line-clamp-1 drop-shadow-md mb-3">
                  {item.genres.slice(0, 3).join(" • ")}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

