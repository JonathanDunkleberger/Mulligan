"use client";
import { useEffect, useState } from "react";
import type { MediaItem } from "../_lib/schema";
import { FavoritesStore } from "../_state/favorites";
import MediaTile from "../_components/MediaTile";

export default function MyMediaPage() {
  const [favorites, setFavorites] = useState<MediaItem[]>(FavoritesStore.read());
  useEffect(() => FavoritesStore.subscribe(setFavorites), []);
  const genres = favorites.flatMap(f => f.genres);
  const genreCounts = Object.entries(genres.reduce((a:any,g)=>{a[g]=(a[g]||0)+1;return a;}, {})).sort((a,b)=>b[1]-a[1]);
  const oldest = favorites.reduce((a,f)=> f.year && (!a||f.year<a.year)? f:a, null as MediaItem|null);
  const newest = favorites.reduce((a,f)=> f.year && (!a||f.year>a.year)? f:a, null as MediaItem|null);

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
        {genreCounts.slice(0,3).map(([g,c]) => <div key={g}><b>{g}:</b> {c}</div>)}
      </div>
    </div>
  );
}
