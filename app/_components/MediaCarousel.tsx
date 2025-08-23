"use client";

import { useRef } from "react";
import type { MediaItem } from "../_lib/schema";
import MediaTile from "./MediaTile";

export default function MediaCarousel({ items }: { items: MediaItem[] }) {
  const scroller = useRef<HTMLDivElement>(null);

  const scrollBy = (delta: number) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: "smooth" });
  };

  return (
    <div className="carousel">
      <button
        className="carouselNav left"
        aria-label="Scroll left"
        onClick={() => scrollBy(-1000)}
      >
        ‹
      </button>

      <div ref={scroller} className="carouselScroll">
        <div className="carouselInner">
          {items.map((it) => (
            <MediaTile key={it.id} item={it} />
          ))}
        </div>
      </div>

      <button
        className="carouselNav right"
        aria-label="Scroll right"
        onClick={() => scrollBy(1000)}
      >
        ›
      </button>
    </div>
  );
}
