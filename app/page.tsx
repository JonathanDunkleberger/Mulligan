"use client";

import { useEffect, useMemo, useState } from "react";
import { Category, MediaItem } from "./_lib/schema";
import { debounce } from "./_lib/debounce";
import MediaCarousel from "./_components/MediaCarousel";
import MediaTile from "./_components/MediaTile";
import FavoritesBar from "./_components/FavoritesBar";
import { FavoritesStore } from "./_state/favorites";
import { motion, AnimatePresence } from "framer-motion";
import DetailsModal from "./_components/DetailsModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Mode = "browse" | "search" | "recommend";
const ORDER: Category[] = ["film", "tv", "anime", "game", "book"];

export default function Page() {
  const [mode, setMode] = useState<Mode>("browse");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MediaItem[]>([]);
  const [favorites, setFavorites] = useState<MediaItem[]>(FavoritesStore.read());
  const [popular, setPopular] = useState<Record<Category, MediaItem[]>>({ film: [], game: [], anime: [], tv: [], book: [] });
  const [recs, setRecs] = useState<Record<Category, MediaItem[]>>({ film: [], game: [], anime: [], tv: [], book: [] });
  const [heroItem, setHeroItem] = useState<MediaItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);

  useEffect(() => {
    const unsub = FavoritesStore.subscribe(setFavorites);
    (async () => {
      try {
        const res = await fetch("/api/popular", { cache: "no-store" });
        const json = await res.json();
        const pop = json.byCat || { film: [], game: [], anime: [], tv: [], book: [] };
        setPopular(pop);
        
        // Pick a random hero item from films or tv
        const candidates = [...(pop.film || []), ...(pop.tv || [])];
        if (candidates.length > 0) {
          setHeroItem(candidates[Math.floor(Math.random() * candidates.length)]);
        }
      } catch (e) {
        console.error("Failed to fetch popular", e);
      }
    })();
    return () => { unsub(); };
  }, []);

  const runSearch = useMemo(
    () =>
      debounce(async (q: string) => {
        if (!q.trim()) { setResults([]); setMode("browse"); return; }
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
        const json = await res.json();
        setResults(json.items || []);
        setMode("search");
      }, 300),
    []
  );

  function onChangeQuery(v: string) { setQuery(v); runSearch(v); }
  
  async function getRecs() {
    if (favorites.length < 1) return;
    setMode("recommend");
    try {
      const res = await fetch("/api/recs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorites })
      });
      const json = await res.json();
      setRecs(json);
      
      // Update hero to top rec
      const allRecs = Object.values(json).flat() as MediaItem[];
      if (allRecs.length > 0) {
        setHeroItem(allRecs[0]);
      }
    } catch (e) {
      console.error("Failed to get recs", e);
    }
  }

  const rails = useMemo(() => {
    const source = mode === "recommend" ? recs : popular;
    return ORDER.map((cat) => ({
      title: mode === "recommend" 
        ? (cat === "film" ? "Movies for you" : cat === "game" ? "Games for you" : cat === "anime" ? "Anime for you" : cat === "tv" ? "TV for you" : "Books for you")
        : (cat === "film" ? "Trending Films" : cat === "game" ? "Popular Games" : cat === "anime" ? "Top Anime" : cat === "tv" ? "Top TV" : "Popular Books"),
      category: cat as Category, 
      items: source[cat] || []
    })).filter(r => r.items.length > 0);
  }, [mode, recs, popular]);

  return (
    <>
      <main className="w-full relative z-10 mt-8">
        <div className="flex flex-col gap-8">
          
          {/* Search & Controls */}
          <div className="flex gap-4 items-center px-12">
            <Input 
              className="max-w-md bg-black/50 border-gray-700 text-white placeholder:text-gray-400" 
              placeholder="Search titles to add..." 
              value={query} 
              onChange={(e) => onChangeQuery(e.target.value)} 
            />
            <div className="flex gap-2">
              <Button variant={mode === "browse" ? "secondary" : "ghost"} onClick={() => setMode("browse")}>Browse</Button>
              <Button 
                variant={mode === "recommend" ? "secondary" : "ghost"} 
                onClick={getRecs}
                disabled={favorites.length < 1}
                className={favorites.length < 1 ? "opacity-50" : ""}
              >
                For You
              </Button>
            </div>
          </div>

          {/* Content */}
          <section className="min-h-screen">
            {mode === "search" ? (
              <div className="px-12">
                <h2 className="text-2xl font-bold mb-6">Results for "{query}"</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {results.map((item) => (
                    <MediaTile key={item.id} item={item} onClick={() => setSelectedItem(item)} showAddHint />
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6 pb-24">
                {rails.map((rail) => (
                  <div key={rail.category} className="rail px-12">
                    <h3 className="text-xl font-bold mb-2 text-gray-100 flex items-center gap-2">
                      {rail.title}
                      <span className="text-xs font-normal text-gray-500 uppercase tracking-wider border border-gray-700 px-2 py-0.5 rounded-full">
                        {rail.category}
                      </span>
                    </h3>
                    <MediaCarousel items={rail.items} onSelect={setSelectedItem} />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>


      {selectedItem && (
        <DetailsModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </>
  );
}
