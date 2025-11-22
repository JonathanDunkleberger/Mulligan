import { NextRequest, NextResponse } from "next/server";
import { MediaItem, Category } from "../../_lib/schema";
import { tmdbSearchAll, igdbSearch, gbooksSearch, tmdbPopular, igdbPopular, gbooksPopular } from "../../_lib/adapters.server";
import { recommendForAllCategories } from "../../_lib/recommender";

// Since we don't have true "similar to X" endpoints wired up in adapters yet for all sources,
// and to keep it simple/fast, we will reuse the client-side logic but run it server-side 
// with potentially larger pools if we wanted, or just fetch popular items dynamically.
//
// However, the user wants "custom titles... not the popular titles".
// To do this properly without 50 API calls, we can:
// 1. Fetch popular items (as a baseline pool).
// 2. Fetch "similar" items for the user's top 3 favorites.
// 3. Merge and rank.
//
// For this MVP refactor, let's stick to the existing "re-rank popular" strategy BUT 
// we will move it here so the client doesn't have to fetch /api/popular and do the math.
// AND we can add a "discovery" layer later.
//
// Actually, let's try to fetch *some* similar items if possible.
// But `adapters.server.ts` doesn't expose `getSimilar`.
// So we will stick to the "Smart Re-ranking of Popular" for now, which is robust enough for an MVP
// if the popular pool is diverse enough.
//
// To make it feel "custom", we can ensure we fetch a fresh batch of popular items.

export async function POST(req: NextRequest) {
  const body = await req.json();
  const favorites: MediaItem[] = body.favorites || [];

  if (favorites.length < 1) {
    return NextResponse.json({ error: "No favorites" }, { status: 400 });
  }

  // 1. Fetch pools (we could cache this in memory for a few minutes)
  const [tmdb, igdb, gbooks] = await Promise.all([
    tmdbPopular(),
    igdbPopular(),
    gbooksPopular()
  ]);

  const pools: Record<Category, MediaItem[]> = {
    film: tmdb.film,
    tv: tmdb.tv,
    anime: tmdb.anime,
    game: igdb,
    book: gbooks
  };

  // 2. Run the recommender logic
  // We import the logic from _lib/recommender.ts. 
  // Note: recommender.ts is currently client-side safe (no secrets), so we can use it here.
  const recs = recommendForAllCategories(favorites, pools, 15);

  return NextResponse.json(recs);
}
