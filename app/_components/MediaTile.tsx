"use client";

import Image from "next/image";
import Link from "next/link";
import type { MediaItem } from "../_lib/schema";
import { FavoritesStore } from "../_state/favorites";

export default function MediaTile({
  item,
  onClick,
  showAddHint
}: {
  item: MediaItem;
  onClick?: () => void;        // used on Home search to add-to-favs
  showAddHint?: boolean;
}) {
  const href = `/detail/${item.source}/${item.category}/${item.sourceId}`;
  return (
    <div className="tile">
      {item.imageUrl ? (
        <Image src={item.imageUrl} alt={item.title} width={150} height={225} />
      ) : (
        <div style={{height:225,display:"grid",placeItems:"center",background:"#222"}}>{item.title}</div>
      )}
      <div className="hud">
        <div className="hudInner">
          <span className="pill">{item.category.toUpperCase()}</span>
          {item.year ? <span className="pill">{item.year}</span> : null}
          {item.genres?.slice(0,2).map(g => <span key={g} className="pill">{g}</span>)}
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            {onClick ? (
              <button className="btnIcon" onClick={onClick} title="Add to favorites">+</button>
            ) : (
              <button className="btnIcon" onClick={() => FavoritesStore.add(item)} title="Add to favorites">+</button>
            )}
            <Link className="btnIcon" href={href} title="Details">⌄</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
