"use client";

import { useRef } from "react";
import type { MediaItem } from "../_lib/schema";
import MediaTile from "./MediaTile";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function MediaCarousel({ 
  items,
  onSelect
}: { 
  items: MediaItem[];
  onSelect?: (item: MediaItem) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);

  const scrollBy = (delta: number) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: "smooth" });
  };

  return (
    <div className="group relative">
      <button
        className="absolute left-0 top-0 bottom-0 z-20 w-12 bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
        aria-label="Scroll left"
        onClick={() => scrollBy(-1000)}
      >
        <ChevronLeft size={32} />
      </button>

      <div ref={scroller} className="overflow-x-auto overflow-y-visible scroll-smooth scrollbar-hide pb-4 -mx-4 px-4 pt-4">
        <div className="flex gap-2 w-max">
          {items.map((it) => (
            <div key={it.id} className="w-[560px] flex-none">
              <MediaTile 
                item={it} 
                onClick={() => onSelect?.(it)}
              />
            </div>
          ))}
        </div>
      </div>

      <button
        className="absolute right-0 top-0 bottom-0 z-20 w-12 bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
        aria-label="Scroll right"
        onClick={() => scrollBy(1000)}
      >
        <ChevronRight size={32} />
      </button>
    </div>
  );
}

