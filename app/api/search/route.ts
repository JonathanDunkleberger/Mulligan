import { NextResponse } from 'next/server';
import { tmdbSearchAll, igdbSearch, gbooksSearch } from '../../_lib/adapters.server';
import type { MediaItem } from '../../_lib/schema';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  
  if (!query) return NextResponse.json([]);

  try {
    const [tmdbResults, igdbResults, gbooksResults] = await Promise.all([
      tmdbSearchAll(query),
      igdbSearch(query),
      gbooksSearch(query)
    ]);

    // Interleave results for a better mix, or just concat
    const allResults: MediaItem[] = [
      ...tmdbResults,
      ...igdbResults,
      ...gbooksResults
    ];

    return NextResponse.json(allResults);

  } catch (error) {
    console.error("Search API Error:", error);
    return NextResponse.json([]);
  }
}

