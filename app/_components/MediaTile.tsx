"use client";

import Image from "next/image";
import type { MediaItem } from "../_lib/schema";
import { FavoritesStore } from "../_state/favorites";

export default function MediaTile({
  item,
  onClick,
  showAddHint
}: {
  item: MediaItem;
  onClick?: () => void; // If provided, this is the primary action (e.g. open details)
  showAddHint?: boolean;
}) {
  return (
    <div 
      className="tile group cursor-pointer relative transition-transform hover:scale-105 hover:z-10"
      onClick={onClick}
    >
      {item.imageUrl ? (
        <Image 
          src={item.imageUrl} 
          alt={item.title} 
          width={200} 
          height={300} 
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-[225px] grid place-items-center bg-[#222] text-gray-400 p-2 text-center text-sm">
          {item.title}
        </div>
      )}
      
      {/* Hover Overlay */}
      <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-3 flex flex-col justify-end">
        <h4 className="text-white font-bold text-sm leading-tight mb-1">{item.title}</h4>
        <div className="flex flex-wrap gap-1 mb-2">
          <span className="text-[10px] uppercase tracking-wider text-gray-300 border border-gray-600 px-1 rounded">
            {item.category}
          </span>
          {item.year && <span className="text-[10px] text-green-400 font-bold">{item.year}</span>}
        </div>
        
        <div className="flex gap-2 mt-2">
          <button 
            className="flex-1 bg-white text-black text-xs font-bold py-1 rounded hover:bg-gray-200"
            onClick={(e) => {
              e.stopPropagation();
              onClick?.();
            }}
          >
            Info
          </button>
          <button 
            className="w-8 bg-[#333] text-white rounded flex items-center justify-center hover:bg-[#444]"
            onClick={(e) => {
              e.stopPropagation();
              FavoritesStore.add(item);
            }}
            title="Add to My List"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

