"use client";

import type { MediaItem } from "../_lib/schema";
import Link from "next/link";

export default function FavoritesBar({ favorites }: { favorites: MediaItem[] }) {
  return (
    <div>
      <div className="sectionTitle">Your favorites</div>
      {favorites.length === 0 ? (
        <div style={{ color: "var(--muted)", fontSize: 14 }}>
          Add at least <b>5</b> favorites from the search to unlock recs.
        </div>
      ) : null}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
        {favorites.map(f => (
          <Link key={f.id} href={`/detail/${f.source}/${f.category}/${f.sourceId}`} className="badlink">
            {f.title} {f.year ? `(${f.year})` : ""}
          </Link>
        ))}
      </div>
    </div>
  );
}
