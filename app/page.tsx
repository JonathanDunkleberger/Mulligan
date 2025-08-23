"use client";

import { useEffect, useMemo, useState } from "react";
import { Category, MediaItem } from "./_lib/schema";
import { debounce } from "./_lib/debounce";
import MediaCarousel from "./_components/MediaCarousel";
import MediaTile from "./_components/MediaTile";
import FavoritesBar from "./_components/FavoritesBar";
import { recommendForAllCategories } from "./_lib/recommender";
import { FavoritesStore } from "./_state/favorites";

type Mode = "browse" | "search" | "recommend";
const ORDER: Category[] = ["film", "game", "anime", "tv", "book"];

export default function Page() {
  const [mode, setMode] = useState<Mode>("browse");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MediaItem[]>([]);
  const [favorites, setFavorites] = useState<MediaItem[]>(FavoritesStore.read());
  const [popular, setPopular] = useState<Record<Category, MediaItem[]>>({ film: [], game: [], anime: [], tv: [], book: [] });

  useEffect(() => {
    const unsub = FavoritesStore.subscribe(setFavorites);
    (async () => {
      const res = await fetch("/api/popular", { cache: "no-store" });
      const json = await res.json();
      setPopular(json.byCat || { film: [], game: [], anime: [], tv: [], book: [] });
    })();
    return () => unsub();
  }, []);

  const runSearch = useMemo(
    () =>
      debounce(async (q: string) => {
        if (!q.trim()) { setResults([]); setMode("browse"); return; }
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
        const json = await res.json();
        setResults(json.items || []);
        setMode("search");
      }, 200),
    []
  );

  function onChangeQuery(v: string) { setQuery(v); runSearch(v); }
  function onPickFromSearch(item: MediaItem) { FavoritesStore.add(item); setQuery(""); setResults([]); setMode("browse"); }

  const rails = useMemo(() => {
    if (mode === "recommend") {
      const rec = recommendForAllCategories(favorites, popular);
      return ORDER.map((cat) => ({
        title: cat === "film" ? "Movies for you" : cat === "game" ? "Games for you" : cat === "anime" ? "Anime for you" : cat === "tv" ? "TV for you" : "Books for you",
        category: cat as Category, items: rec[cat]
      }));
    }
    return ORDER.map((cat) => ({
      title: cat === "film" ? "Trending Films" : cat === "game" ? "Popular Games" : cat === "anime" ? "Top Anime" : cat === "tv" ? "Top TV" : "Popular Books",
      category: cat as Category, items: popular[cat] || []
    }));
  }, [mode, favorites, popular]);

  return (
    <>
      <header className="header">
        <div className="searchWrap">
          <input className="search" placeholder="Add favorites: Search films, games, anime, TV, books…" value={query} onChange={(e) => onChangeQuery(e.target.value)} />
          <div className="modeRow">
            <button className="btn" onClick={() => setMode("browse")}>Home</button>
            <button className="btn btnPrimary" disabled={favorites.length < 5} onClick={() => setMode("recommend")} title={favorites.length < 5 ? "Add at least 5 favorites to unlock" : "Get recommendations"}>
              {favorites.length < 5 ? `Add ${5 - favorites.length} more favorites…` : "🎯 Get recommendations"}
            </button>
            <span className="badge">Favorites: {favorites.length}</span>
          </div>
        </div>
      </header>

      <main className="container">
        <section>
          {mode === "search" ? (
            <>
              <div className="sectionTitle">Add to favorites: “{query}”</div>
              <div className="gridResults">
                {results.map((item) => (
                  <MediaTile key={item.id} item={item} onClick={() => onPickFromSearch(item)} showAddHint />
                ))}
              </div>
            </>
          ) : (
            rails.map((rail) => (
              <div key={rail.category} className="rail">
                <div className="sectionTitle">{rail.title}</div>
                <MediaCarousel items={rail.items} />
              </div>
            ))
          )}
        </section>

        <aside className="sidebar">
          <FavoritesBar favorites={favorites} />
        </aside>
      </main>
    </>
  );
}
