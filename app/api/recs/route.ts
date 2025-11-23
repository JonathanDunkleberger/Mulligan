import { NextRequest, NextResponse } from "next/server";
import { MediaItem, Category } from "../../_lib/schema";
import { 
  tmdbPopular, igdbPopular, gbooksPopular,
  tmdbGetRecommendations, igdbGetSimilar, gbooksGetSimilar 
} from "../../_lib/adapters.server";
import { recommendForAllCategories } from "../../_lib/recommender";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const favorites: MediaItem[] = body.favorites || [];

  if (favorites.length < 1) {
    return NextResponse.json({ error: "No favorites" }, { status: 400 });
  }

  // 1. Fetch popular items as a baseline pool
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

  // 2. Fetch "similar" items for the user's top 3 favorites to expand the pool
  // We pick the first 3 (assuming they are recent or relevant)
  const seeds = favorites.slice(0, 3);
  const similarResults = await Promise.all(seeds.map(async (seed) => {
    try {
      if (seed.source === "tmdb" && (seed.category === "film" || seed.category === "tv" || seed.category === "anime")) {
        return await tmdbGetRecommendations(seed.id, seed.category);
      } else if (seed.source === "igdb") {
        return await igdbGetSimilar(seed.id);
      } else if (seed.source === "gbooks") {
        return await gbooksGetSimilar(seed.id);
      }
    } catch (e) {
      console.error(`Failed to fetch similar for ${seed.title}`, e);
    }
    return [];
  }));

  // Merge similar items into the pools
  similarResults.flat().forEach((item) => {
    if (item && item.category && pools[item.category]) {
      // Avoid duplicates
      if (!pools[item.category].find(p => p.id === item.id)) {
        pools[item.category].push(item);
      }
    }
  });

  // 3. Run the recommender logic
  const recs = recommendForAllCategories(favorites, pools, 15);

  return NextResponse.json(recs);
}
