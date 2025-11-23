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

import { getCategoryRecommendations } from "@/actions/get-recommendations";

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
    // Sync initial state
    setFavorites(FavoritesStore.read());
    const unsub = FavoritesStore.subscribe(setFavorites);

    async function loadDeepCuts() {
      try {
        // A. Call the new Engine (Supabase)
        // Hardcode a generic user ID or use the real one if you have Auth set up
        const userId = "user_123"; 
        
        // Fetch for all categories to populate the rails
        const categories: Category[] = ["film", "tv", "anime", "game", "book"];
        const newPopular: Record<Category, MediaItem[]> = { film: [], game: [], anime: [], tv: [], book: [] };

        await Promise.all(categories.map(async (cat) => {
          // Map 'film' to 'movie' for the DB query if needed, but the action takes 'type'
          // The DB enum has 'movie', schema has 'film'.
          const dbType = cat === "film" ? "movie" : cat;
          const data = await getCategoryRecommendations(userId, dbType);

          // B. THE ADAPTER (Make it fit your UI)
          newPopular[cat] = data.map((item: any) => ({
            id: item.id,
            title: item.title,
            category: cat, 
            // Use placeholder if no image
            imageUrl: item.metadata?.cover_url || item.metadata?.imageUrl || "https://placehold.co/400x600?text=" + encodeURIComponent(item.title),
            description: item.description,
            source: "supa",
            sourceId: item.id,
            year: item.metadata?.year,
            genres: item.metadata?.genres || [],
          } as MediaItem));
        }));

        setPopular(newPopular);
        
        // Pick a random hero item
        const allItems = Object.values(newPopular).flat();
        if (allItems.length > 0) {
          setHeroItem(allItems[Math.floor(Math.random() * allItems.length)]);
        }

      } catch (error) {
        console.error("Failed to load deep cuts:", error);
      }
    }

    loadDeepCuts();
    return () => { unsub(); };
  }, []);

  const runSearch = useMemo(
    () =>
      debounce(async (q: string) => {
        if (!q.trim()) { setResults([]); setMode("browse"); return; }
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
          const json = await res.json();
          
          // Map the normalized API results to MediaItem
          const mappedResults: MediaItem[] = (json || []).map((item: any) => ({
            id: item.id,
            title: item.title,
            category: item.type === 'movie' ? 'film' : item.type, // Map 'movie' -> 'film'
            imageUrl: item.imageUrl,
            description: item.description,
            source: "supa", // Or keep original source if needed, but 'supa' works for now
            sourceId: item.sourceId,
            year: item.releaseYear ? parseInt(item.releaseYear) : undefined,
            genres: [], // Search API might not return genres yet
          }));

          setResults(mappedResults);
          setMode("search");
        } catch (error) {
          console.error("Search failed", error);
          setResults([]);
        }
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
          <div className="flex gap-4 items-center px-8">
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
              <div className="px-8">
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
                  <div key={rail.category} className="rail px-8">
                    <h3 className="text-xl font-bold mb-2 text-gray-100 flex items-center gap-2">
                      {rail.title}
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
