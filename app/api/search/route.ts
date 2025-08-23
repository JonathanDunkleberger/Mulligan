import { NextResponse } from "next/server";
import { tmdbSearchAll, igdbSearch, gbooksSearch } from "@/app/_lib/adapters.server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") || "";
  if (!q.trim()) return NextResponse.json({ items: [] });
  const [tmdb, igdb, gbooks] = await Promise.all([
    tmdbSearchAll(q).catch(() => []),
    igdbSearch(q).catch(() => []),
    gbooksSearch(q).catch(() => [])
  ]);
  return NextResponse.json({ items: [...tmdb, ...igdb, ...gbooks].slice(0, 45) });
}
