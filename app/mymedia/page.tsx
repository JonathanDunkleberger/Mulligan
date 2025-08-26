"use client";
import { useEffect, useState } from "react";
import type { MediaItem } from "../_lib/schema";
import { FavoritesStore } from "../_state/favorites";
import MediaTile from "../_components/MediaTile";

export default function MyMediaPage() {
  const [favorites, setFavorites] = useState<MediaItem[]>(FavoritesStore.read());
  useEffect(() => {
    const unsubscribe = FavoritesStore.subscribe(setFavorites);
    return () => { unsubscribe(); };
  }, []);
  const genres = favorites.flatMap(f => f.genres);
  const counts = genres.reduce<Record<string, number>>((a, g) => { a[g] = (a[g] || 0) + 1; return a; }, {});
  const genreCounts: Array<[string, number]> = Object.entries(counts).sort((a, b) => (b[1] as number) - (a[1] as number)) as Array<[string, number]>;
  const oldest = favorites.reduce<MediaItem | null>((a, f) => (f.year && (!a || (a.year ?? Infinity) > f.year)) ? f : a, null);
  const newest = favorites.reduce<MediaItem | null>((a, f) => (f.year && (!a || (a.year ?? -Infinity) < f.year)) ? f : a, null);

  return (
    <div style={{ padding: 24 }}>
      <h1>My Media</h1>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:10, marginTop:12 }}>
        {favorites.map(f => <MediaTile key={f.id} item={f} />)}
      </div>
      <h2 style={{ marginTop: 24 }}>Taste Snapshot</h2>
      <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
        <div><b>Favorites:</b> {favorites.length}</div>
        {oldest ? <div><b>Oldest:</b> {oldest.title} ({oldest.year})</div> : null}
        {newest ? <div><b>Newest:</b> {newest.title} ({newest.year})</div> : null}
  {genreCounts.slice(0,3).map(([g,c]: [string, number]) => <div key={g}><b>{g}:</b> {c}</div>)}
      </div>
    </div>
  );
}
