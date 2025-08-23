"use client";
import { useMemo, useState } from "react";
import { debounce } from "../_lib/debounce";
import type { MediaItem } from "../_lib/schema";
import MediaTile from "../_components/MediaTile";

export default function BrowsePage() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<MediaItem[]>([]);
  const run = useMemo(() => debounce(async (s: string) => {
    if (!s.trim()) return setItems([]);
    const res = await fetch(`/api/search?q=${encodeURIComponent(s)}`, { cache:"no-store" });
    const json = await res.json();
    setItems(json.items || []);
  }, 200), []);
  return (
    <div style={{ padding: 24 }}>
      <input className="search" placeholder="Find a specific title…" value={q} onChange={(e)=>{ setQ(e.target.value); run(e.target.value); }} />
      <div className="gridResults" style={{ marginTop: 12 }}>
        {items.map(it => <MediaTile key={it.id} item={it} />)}
      </div>
    </div>
  );
}
