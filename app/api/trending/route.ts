import { NextResponse } from 'next/server';

const TMDB_KEY = process.env.TMDB_API_KEY;
const GOOGLE_BOOKS_KEY = process.env.GOOGLE_BOOKS_API_KEY;
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

// Helper: Get Twitch Token
async function getTwitchToken() {
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) return null;
  try {
    const res = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`, { method: 'POST' });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token;
  } catch { return null; }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category'); // 'movie', 'tv', 'book', 'game', 'anime'

  try {
    let results: any[] = [];

    if (category === 'movie' || category === 'tv' || category === 'anime') {
      let url = '';
      if (category === 'movie') {
        url = `https://api.themoviedb.org/3/trending/movie/week?api_key=${TMDB_KEY}`;
      } else if (category === 'tv') {
        url = `https://api.themoviedb.org/3/trending/tv/week?api_key=${TMDB_KEY}`;
      } else if (category === 'anime') {
        url = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&with_genres=16&sort_by=popularity.desc&with_original_language=ja`;
      }

      const res = await fetch(url);
      const data = await res.json();
      const items = data.results || [];

      results = items.slice(0, 24).map((item: any) => ({
        id: item.id.toString(),
        sourceId: item.id,
        source: 'tmdb',
        title: item.title || item.name,
        type: category === 'anime' ? 'anime' : (category === 'movie' ? 'movie' : 'tv'),
        description: item.overview || "",
        imageUrl: item.poster_path 
          ? `https://image.tmdb.org/t/p/w500${item.poster_path}` 
          : "https://placehold.co/400x600?text=No+Image",
        backdropUrl: item.backdrop_path 
          ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` 
          : null,
        genres: [], // Can be populated if needed
        releaseYear: (item.release_date || item.first_air_date || "").split('-')[0],
        matchScore: item.vote_average ? Math.round(item.vote_average * 10) : 0,
        trailerUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent((item.title || item.name) + " trailer")}`
      }));

    } else if (category === 'game') {
      const token = await getTwitchToken();
      if (token) {
        const res = await fetch("https://api.igdb.com/v4/games", {
          method: "POST",
          headers: {
            "Client-ID": TWITCH_CLIENT_ID!,
            "Authorization": `Bearer ${token}`,
            "Content-Type": "text/plain"
          },
          body: `
            fields name, cover.url, screenshots.url, first_release_date, summary, total_rating, genres.name;
            where total_rating_count > 20 & total_rating != null;
            sort total_rating desc;
            limit 24;
          `
        });
        const data = await res.json();
        
        if (Array.isArray(data)) {
          results = data.map((item: any) => ({
            id: item.id.toString(),
            sourceId: item.id,
            source: 'igdb',
            title: item.name,
            type: 'game',
            description: item.summary || "",
            imageUrl: item.cover?.url ? `https:${item.cover.url.replace('t_thumb', 't_cover_big')}` : "https://placehold.co/400x600?text=No+Image",
            backdropUrl: item.screenshots?.[0]?.url ? `https:${item.screenshots[0].url.replace('t_thumb', 't_screenshot_big')}` : null,
            genres: item.genres?.map((g: any) => g.name) || [],
            releaseYear: item.first_release_date ? new Date(item.first_release_date * 1000).getFullYear().toString() : "",
            matchScore: item.total_rating ? Math.round(item.total_rating) : 0,
            trailerUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(item.name + " game trailer")}`
          }));
        }
      }

    } else if (category === 'book') {
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=subject:fiction&orderBy=relevance&maxResults=24&key=${GOOGLE_BOOKS_KEY}`);
      const data = await res.json();
      
      if (data.items) {
        results = data.items.map((item: any) => ({
          id: item.id,
          sourceId: item.id,
          source: 'google_books',
          title: item.volumeInfo.title,
          type: 'book',
          description: item.volumeInfo.description || "",
          imageUrl: item.volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:') || "https://placehold.co/400x600?text=No+Image",
          backdropUrl: item.volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:') || null,
          genres: item.volumeInfo.categories || [],
          releaseYear: item.volumeInfo.publishedDate?.split('-')[0] || "",
          matchScore: item.volumeInfo.averageRating ? Math.round(item.volumeInfo.averageRating * 20) : 0,
          trailerUrl: item.volumeInfo.previewLink || ""
        }));
      }
    }

    return NextResponse.json(results);

  } catch (error) {
    console.error("Trending API Error:", error);
    return NextResponse.json([]);
  }
}
