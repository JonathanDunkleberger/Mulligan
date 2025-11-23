import { NextResponse } from 'next/server';
import { tmdbPopular, igdbPopular, gbooksPopular } from '../../_lib/adapters.server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category'); // 'movie', 'tv', 'book', 'game', 'anime'

  try {
    let results: any[] = [];

    if (category === 'movie') {
      const data = await tmdbPopular();
      results = data.film;
    } else if (category === 'tv') {
      const data = await tmdbPopular();
      results = data.tv;
    } else if (category === 'anime') {
      const data = await tmdbPopular();
      results = data.anime;
    } else if (category === 'game') {
      results = await igdbPopular();
    } else if (category === 'book') {
      results = await gbooksPopular();
    }

    return NextResponse.json(results);

  } catch (error) {
    console.error("Trending API Error:", error);
    return NextResponse.json([]);
  }
}
