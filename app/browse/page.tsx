"use client";
import { useMemo, useState } from "react";
import { debounce } from "../_lib/debounce";
import type { MediaItem } from "../_lib/schema";
import MediaTile from "../_components/MediaTile";
import { Input } from "@/components/ui/input";
import DetailsModal from "../_components/DetailsModal";

export default function BrowsePage() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<MediaItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);

  const run = useMemo(() => debounce(async (s: string) => {
    if (!s.trim()) return setItems([]);
    const res = await fetch(`/api/search?q=${encodeURIComponent(s)}`, { cache:"no-store" });
    const json = await res.json();
    setItems(json.items || []);
  }, 300), []);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Browse</h1>
      <Input 
        className="max-w-xl bg-black/50 border-gray-700 text-white mb-8" 
        placeholder="Search for anything..." 
        value={q} 
        onChange={(e)=>{ setQ(e.target.value); run(e.target.value); }} 
      />
      
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {items.map(it => (
          <MediaTile 
            key={it.id} 
            item={it} 
            onClick={() => setSelectedItem(it)}
          />
        ))}
      </div>
      
      {items.length === 0 && q && (
        <div className="text-gray-500 text-center mt-12">No results found</div>
      )}

      {selectedItem && (
        <DetailsModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}

