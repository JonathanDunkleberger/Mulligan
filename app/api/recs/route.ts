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

  // 2. Fetch "similar" items for a RANDOM sample of the user's favorites to expand the pool
  // We pick 6 random items to get a better spread than just the top 3
  const shuffled = [...favorites].sort(() => 0.5 - Math.random());
  const seeds = shuffled.slice(0, 6);
  
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

  // Create a blacklist of the original popular items to ensure "For You" is different
  const blacklist = [
    ...tmdb.film, 
    ...tmdb.tv, 
    ...tmdb.anime, 
    ...igdb, 
    ...gbooks
  ];

  // 3. Run the recommender logic
  const recs = recommendForAllCategories(favorites, pools, blacklist, 15);

  return NextResponse.json(recs);
}
