import { NextResponse } from "next/server";
import { tmdbPopular, igdbPopular, gbooksPopular } from "@/app/_lib/adapters.server";

export async function GET() {
  const [{ film, tv, anime }, game, book] = await Promise.all([
    tmdbPopular().catch(() => ({ film: [], tv: [], anime: [] })),
    igdbPopular().catch(() => []),
    gbooksPopular().catch(() => [])
  ]);
  const byCat = { film, game, anime, tv, book };
  return NextResponse.json({ byCat });
}
