import { NextRequest, NextResponse } from "next/server";
import { tmdbGetDetails, igdbGetDetails, gbooksGetDetails } from "../../_lib/adapters.server";
import { Category } from "../../_lib/schema";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const source = searchParams.get("source");
  const sourceId = searchParams.get("sourceId");
  const category = searchParams.get("category") as Category;

  if (!source || !sourceId || !category) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  let item = null;
  if (source === "tmdb") {
    // TMDB handles film/tv/anime (anime is usually under tv or film)
    // We need to know if it's film or tv. The category param helps.
    // If category is 'anime', we need to guess or try both? 
    // Actually adapters.server.ts tmdbGetDetails takes "film" | "tv" | "anime".
    // It maps "anime" to "tv" internally usually, or we can trust the caller.
    item = await tmdbGetDetails(category as "film"|"tv"|"anime", sourceId);
  } else if (source === "igdb") {
    item = await igdbGetDetails(sourceId);
  } else if (source === "gbooks") {
    item = await gbooksGetDetails(sourceId);
  }

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(item);
}

