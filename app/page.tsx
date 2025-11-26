"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Category, MediaItem } from "./_lib/schema";
import { debounce } from "./_lib/debounce";
import MediaCarousel from "./_components/MediaCarousel";
import MediaTile from "./_components/MediaTile";
import DetailsModal from "./_components/DetailsModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getUserFavoriteIds, getUserDislikedIds } from "@/actions/user-data";
import { saveAndFavoriteItem } from "@/actions/save-and-favorite";
import { removeFavorite } from "@/actions/remove-favorite";
import { dislikeItem } from "@/actions/dislike-item";

type Mode = "browse" | "search" | "recommend";
const ORDER: Category[] = ["film", "tv", "anime", "game", "book"];

export default function Page() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("browse");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MediaItem[]>([]);
  const [favorites, setFavorites] = useState<MediaItem[]>([]); // We don't strictly need this for the home page unless for "For You" logic
  const [popular, setPopular] = useState<Record<Category, MediaItem[]>>({ film: [], game: [], anime: [], tv: [], book: [] });
  const [recs, setRecs] = useState<Record<Category, MediaItem[]>>({ film: [], game: [], anime: [], tv: [], book: [] });
  const [heroItem, setHeroItem] = useState<MediaItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [dislikedIds, setDislikedIds] = useState<Set<string>>(new Set());

  // const handleItemClick = (item: MediaItem) => {
  //   router.push(`/detail/${item.source}/${item.category}/${item.sourceId}`);
  // };

  useEffect(() => {
    const handleReset = () => {
      setQuery("");
      setResults([]);
      setMode("browse");
    };
    window.addEventListener("mulligan-reset", handleReset);
    return () => window.removeEventListener("mulligan-reset", handleReset);
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        // 1. Load Favorites & Dislikes IDs
        const [ids, dislikes] = await Promise.all([
          getUserFavoriteIds(),
          getUserDislikedIds()
        ]);
        setLikedIds(new Set(ids));
        setDislikedIds(new Set(dislikes));

        // 2. Load Trending (with Cache)
        const cacheKey = "mulligan:trending_cache";
        const cached = localStorage.getItem(cacheKey);
        let newPopular: Record<Category, MediaItem[]> = { film: [], game: [], anime: [], tv: [], book: [] };
        let loadedFromCache = false;

        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          // Cache valid for 30 minutes
          if (Date.now() - timestamp < 30 * 60 * 1000) {
            newPopular = data;
            setPopular(data);
            loadedFromCache = true;
            
            // Set hero immediately from cache
            const allItems = Object.values(data).flat() as MediaItem[];
            if (allItems.length > 0) {
              setHeroItem(allItems[Math.floor(Math.random() * allItems.length)]);
            }
          }
        }

        if (!loadedFromCache) {
          const categories: Category[] = ["film", "tv", "anime", "game", "book"];
          
          await Promise.all(categories.map(async (cat) => {
            const res = await fetch(`/api/trending?category=${cat}`);
            if (!res.ok) return;
            const data = await res.json();
            newPopular[cat] = data;
          }));

          setPopular(newPopular);
          localStorage.setItem(cacheKey, JSON.stringify({
            data: newPopular,
            timestamp: Date.now()
          }));
          
          // Pick a random hero item
          const allItems = Object.values(newPopular).flat();
          if (allItems.length > 0) {
            setHeroItem(allItems[Math.floor(Math.random() * allItems.length)]);
          }
        }

      } catch (error) {
        console.error("Failed to load data:", error);
      }
    }

    loadData();
  }, []);

  const handleToggleFavorite = async (item: MediaItem) => {
    // Optimistic Update
    const isLiked = likedIds.has(item.id);
    setLikedIds(prev => {
      const next = new Set(prev);
      if (isLiked) next.delete(item.id);
      else next.add(item.id);
      return next;
    });

    // If it was disliked, remove from disliked
    if (dislikedIds.has(item.id)) {
      setDislikedIds(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }

    if (!isLiked) {
      // Add to favorites
      const result = await saveAndFavoriteItem(item);
      if (!result.success) {
        console.error("Failed to save favorite:", result.error);
        // Revert on failure
        setLikedIds(prev => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
      }
    } else {
      // Remove from favorites
      const result = await removeFavorite(item.source, String(item.sourceId));
      if (!result.success) {
         console.error("Failed to remove favorite:", result.error);
         // Revert on failure (re-add it)
         setLikedIds(prev => {
            const next = new Set(prev);
            next.add(item.id);
            return next;
          });
      }
    }
  };

  const handleDislike = async (item: MediaItem) => {
    // Optimistic Update
    setDislikedIds(prev => {
      const next = new Set(prev);
      next.add(item.id);
      return next;
    });

    // If it was liked, remove from liked
    if (likedIds.has(item.id)) {
      setLikedIds(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }

    const result = await dislikeItem(item);
    if (!result.success) {
      console.error("Failed to dislike item:", result.error);
      // Revert on failure
      setDislikedIds(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  const runSearch = useMemo(
    () =>
      debounce(async (q: string) => {
        if (!q.trim()) { setResults([]); setMode("browse"); return; }
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
          const json = await res.json();

          // Map the normalized API results to MediaItem
          const mappedResults: MediaItem[] = (json || []).map((item: any) => ({
            ...item, // Keep original properties including correct ID
            id: item.id, // Use the ID from the API (e.g. tmdb:film:123)
            sourceId: String(item.sourceId), // Ensure string
            year: item.year || (item.releaseYear ? parseInt(item.releaseYear) : undefined),
          }));

          setResults(mappedResults); // API now returns MediaItem[]
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
    // We need to fetch full favorites objects for recommendations
    // Or we can just call the API and let it handle it if it knows the user ID
    // But the current API expects a body with favorites.
    // Let's fetch favorites first if we don't have them.
    
    // For now, let's assume we need to fetch them.
    // Ideally, we should have them in state or context.
    // But to keep it simple, let's fetch them here.
    
    setMode("recommend");
    try {
      // Fetch favorites from server to pass to recs API
      // Alternatively, update /api/recs to fetch favorites from DB using userId
      // But let's stick to the existing pattern if possible, or update it.
      // The user said "robust recommendation system", so maybe the API should do the heavy lifting.
      
      // Let's fetch favorites here
      const { getUserFavorites } = await import("@/actions/user-data");
      const favs = await getUserFavorites();
      setFavorites(favs);

      if (favs.length < 1) return;

      const res = await fetch("/api/recs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorites: favs })
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
    return ORDER.map((cat) => {
      const rawItems = source[cat] || [];
      // Filter out liked items to keep discovery fresh
      // If in "recommend" mode, the API already filters, but double check client-side
      // If in "browse" (trending) mode, this is crucial
      const filtered = rawItems.filter(item => !likedIds.has(item.id));
      
      // Slice to keep UI consistent (e.g. 20 items)
      // We fetch ~50 items from API to allow for this filtering buffer
      const displayItems = filtered.slice(0, 20);

      return {
        title: mode === "recommend" 
          ? (cat === "film" ? "Movies for you" : cat === "game" ? "Games for you" : cat === "anime" ? "Anime for you" : cat === "tv" ? "TV for you" : "Books for you")
          : (cat === "film" ? "Trending Films" : cat === "game" ? "Popular Games" : cat === "anime" ? "Top Anime" : cat === "tv" ? "Trending TV" : "Popular Books"),
        category: cat as Category, 
        items: displayItems
      };
    }).filter(r => r.items.length > 0);
  }, [mode, recs, popular, likedIds]);

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
                // disabled={likedIds.size < 1} // We can check likedIds size
                className={likedIds.size < 1 ? "opacity-50" : ""}
              >
                For You
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  const allItems = Object.values(popular).flat();
                  if (allItems.length > 0) {
                    const random = allItems[Math.floor(Math.random() * allItems.length)];
                    setSelectedItem(random);
                  }
                }}
                title="Feeling Lucky"
              >
                🎲
              </Button>
            </div>
          </div>

          {/* Content */}
          <section className="min-h-screen">
            {mode === "search" ? (
              <div className="px-8">
                <h2 className="text-2xl font-bold mb-6">Results for "{query}"</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {results.filter(item => !dislikedIds.has(item.id)).map((item) => (
                    <MediaTile
                      key={item.id}
                      item={item}
                      onClick={() => setSelectedItem(item)}
                      isFavorited={likedIds.has(item.id)}
                      onToggleFavorite={() => handleToggleFavorite(item)}
                      onDislike={() => handleDislike(item)}
                    />
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
                    <MediaCarousel 
                      items={rail.items.filter(item => !dislikedIds.has(item.id))} 
                      onSelect={setSelectedItem} 
                      likedIds={likedIds}
                      onToggleFavorite={handleToggleFavorite}
                      onDislike={handleDislike}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {selectedItem && (
        <DetailsModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          isFavorited={likedIds.has(selectedItem.id)}
          onToggleFavorite={() => handleToggleFavorite(selectedItem)}
        />
      )}
    </>
  );
}

