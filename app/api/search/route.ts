import { NextResponse } from 'next/server';

const TMDB_KEY = process.env.TMDB_API_KEY;
const GOOGLE_BOOKS_KEY = process.env.GOOGLE_BOOKS_API_KEY;
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

// Helper: Map TMDB Genre IDs to text
const GENRE_MAP: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
  27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi',
  10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
  10765: 'Sci-Fi & Fantasy', 10759: 'Action & Adventure'
};

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
  const query = searchParams.get('q');
  
  if (!query) return NextResponse.json([]);

  try {
    // 1. Parallel Fetch
    const twitchToken = await getTwitchToken();
    
    const promises = [
      fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&query=${query}&include_adult=false`),
      fetch(`https://www.googleapis.com/books/v1/volumes?q=${query}&key=${GOOGLE_BOOKS_KEY}&maxResults=10`)
    ];

    if (twitchToken) {
      promises.push(
        fetch("https://api.igdb.com/v4/games", {
          method: "POST",
          headers: {
            "Client-ID": TWITCH_CLIENT_ID!,
            "Authorization": `Bearer ${twitchToken}`,
            "Content-Type": "text/plain"
          },
          body: `fields name, cover.url, screenshots.url, genres.name, first_release_date, summary, total_rating; search "${query.replace(/"/g, '\\"')}"; limit 10;`
        })
      );
    }

    const responses = await Promise.all(promises);
    const tmdbData = await responses[0].json();
    const booksData = await responses[1].json();
    const gamesData = twitchToken ? await responses[2].json() : [];

    const results: any[] = [];

    // 2. Process Movies/TV
    if (tmdbData.results) {
      const media = tmdbData.results
        .filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv')
        .map((item: any) => ({
          id: item.id.toString(), // External ID
          sourceId: item.id,
          source: 'tmdb',
          title: item.title || item.name,
          type: item.media_type === 'movie' ? 'movie' : 'tv',
          description: item.overview || "No summary available.",
          imageUrl: item.poster_path 
            ? `https://image.tmdb.org/t/p/w500${item.poster_path}` 
            : "https://placehold.co/400x600?text=No+Image",
          backdropUrl: item.backdrop_path 
            ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` 
            : item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
          trailerUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent((item.title || item.name) + " trailer")}`, // Fallback link
          genres: item.genre_ids?.map((id: number) => GENRE_MAP[id]).filter(Boolean) || [],
          releaseYear: (item.release_date || item.first_air_date || "").split('-')[0],
          matchScore: item.vote_average ? Math.round(item.vote_average * 10) : 0
        }));
      results.push(...media);
    }

    // 3. Process Books
    if (booksData.items) {
      const books = booksData.items.map((item: any) => ({
        id: item.id,
        sourceId: item.id,
        source: 'google_books',
        title: item.volumeInfo.title,
        type: 'book',
        description: item.volumeInfo.description || "No description available.",
        imageUrl: item.volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:') || "https://placehold.co/400x600?text=No+Image",
        backdropUrl: item.volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:') || null,
        trailerUrl: item.volumeInfo.previewLink,
        genres: item.volumeInfo.categories || [],
        releaseYear: item.volumeInfo.publishedDate?.split('-')[0] || "",
        matchScore: item.volumeInfo.averageRating ? Math.round(item.volumeInfo.averageRating * 20) : 0 // Convert 5 star to 100 scale
      }));
      results.push(...books);
    }

    // 4. Process Games
    if (Array.isArray(gamesData)) {
      const games = gamesData.map((item: any) => ({
        id: item.id.toString(),
        sourceId: item.id,
        source: 'igdb',
        title: item.name,
        type: 'game',
        description: item.summary || "No summary available.",
        imageUrl: item.cover?.url ? `https:${item.cover.url.replace('t_thumb', 't_cover_big')}` : "https://placehold.co/400x600?text=No+Image",
        backdropUrl: item.screenshots?.[0]?.url ? `https:${item.screenshots[0].url.replace('t_thumb', 't_screenshot_big')}` : null,
        trailerUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(item.name + " game trailer")}`,
        genres: item.genres?.map((g: any) => g.name) || [],
        releaseYear: item.first_release_date ? new Date(item.first_release_date * 1000).getFullYear().toString() : "",
        matchScore: item.total_rating ? Math.round(item.total_rating) : 0
      }));
      results.push(...games);
    }

    return NextResponse.json(results);

  } catch (error) {
    console.error("Search API Error:", error);
    return NextResponse.json([]); // Return empty array on error to prevent UI crash
  }
}
