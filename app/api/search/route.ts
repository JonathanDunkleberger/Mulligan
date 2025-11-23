import { NextResponse } from "next/server";

// 1. Define the normalized interface
interface MediaItem {
  id: string;
  title: string;
  type: 'movie' | 'tv' | 'game' | 'book';
  description: string;
  imageUrl: string;
  backdropUrl: string; // Fallback to imageUrl if missing
  genres: string[];
  releaseYear: string;
  sourceId: string | number;
}

// TMDB Genre Map
const TMDB_GENRES: Record<number, string> = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
  99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History",
  27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance", 878: "Sci-Fi",
  10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western",
  10759: "Action & Adventure", 10762: "Kids", 10763: "News", 10764: "Reality",
  10765: "Sci-Fi & Fantasy", 10766: "Soap", 10767: "Talk", 10768: "War & Politics",
};

// 2. Twitch/IGDB Auth Helper
let twitchToken: string | null = null;
let tokenExpiry: number = 0;

async function getTwitchToken() {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("Missing Twitch credentials");
    return null;
  }

  // Return cached token if valid
  if (twitchToken && Date.now() < tokenExpiry) {
    return twitchToken;
  }

  try {
    const res = await fetch(
      `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
      { method: "POST" }
    );
    
    if (!res.ok) throw new Error("Failed to fetch Twitch token");
    
    const data = await res.json();
    twitchToken = data.access_token;
    // Set expiry (expires_in is in seconds, subtract a buffer)
    tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;
    
    return twitchToken;
  } catch (error) {
    console.error("Error getting Twitch token:", error);
    return null;
  }
}

// 3. Search Functions
async function searchTMDB(query: string): Promise<MediaItem[]> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(query)}&include_adult=false`,
      { next: { revalidate: 3600 } }
    );
    
    if (!res.ok) return [];
    
    const data = await res.json();
    
    return (data.results || [])
      .filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv')
      .map((item: any) => {
        const imageUrl = item.poster_path 
          ? `https://image.tmdb.org/t/p/w500${item.poster_path}` 
          : "https://placehold.co/400x600?text=No+Image";
          
        return {
          id: `tmdb-${item.id}`,
          title: item.title || item.name,
          type: item.media_type === 'movie' ? 'movie' : 'tv',
          description: item.overview || "",
          imageUrl: imageUrl,
          backdropUrl: item.backdrop_path 
            ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` 
            : imageUrl,
          genres: (item.genre_ids || []).map((id: number) => TMDB_GENRES[id] || "Unknown"),
          releaseYear: (item.release_date || item.first_air_date || "").substring(0, 4),
          sourceId: String(item.id)
        };
      });
  } catch (error) {
    console.error("TMDB Search Error:", error);
    return [];
  }
}

async function searchGoogleBooks(query: string): Promise<MediaItem[]> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&key=${apiKey}&maxResults=10`,
      { next: { revalidate: 3600 } }
    );

    if (!res.ok) return [];

    const data = await res.json();

    return (data.items || []).map((item: any) => {
      const info = item.volumeInfo;
      const imageUrl = info.imageLinks?.thumbnail 
        ? info.imageLinks.thumbnail.replace('http:', 'https:') 
        : "https://placehold.co/400x600?text=No+Image";

      return {
        id: `gbooks-${item.id}`,
        title: info.title,
        type: 'book',
        description: info.description || "",
        imageUrl: imageUrl,
        backdropUrl: imageUrl, // Books don't have backdrops, use cover
        genres: info.categories || [],
        releaseYear: (info.publishedDate || "").substring(0, 4),
        sourceId: item.id
      };
    });
  } catch (error) {
    console.error("Google Books Search Error:", error);
    return [];
  }
}

async function searchIGDB(query: string): Promise<MediaItem[]> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const token = await getTwitchToken();

  if (!clientId || !token) return [];

  try {
    const res = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": clientId,
        "Authorization": `Bearer ${token}`,
        "Content-Type": "text/plain"
      },
      body: `fields name, cover.url, screenshots.url, genres.name, first_release_date, summary; search "${query.replace(/"/g, '\\"')}"; limit 10;`
    });

    if (!res.ok) return [];

    const data = await res.json();

    return data.map((item: any) => {
      const imageUrl = item.cover?.url 
        ? `https:${item.cover.url.replace('t_thumb', 't_cover_big')}` 
        : "https://placehold.co/400x600?text=No+Image";

      return {
        id: `igdb-${item.id}`,
        title: item.name,
        type: 'game',
        description: item.summary || "",
        imageUrl: imageUrl,
        backdropUrl: item.screenshots?.[0]?.url 
          ? `https:${item.screenshots[0].url.replace('t_thumb', 't_screenshot_big')}` 
          : imageUrl,
        genres: (item.genres || []).map((g: any) => g.name),
        releaseYear: item.first_release_date 
          ? new Date(item.first_release_date * 1000).getFullYear().toString() 
          : "",
        sourceId: String(item.id)
      };
    });
  } catch (error) {
    console.error("IGDB Search Error:", error);
    return [];
  }
}

// 4. Main Route Handler
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json([]);
  }

  // Parallel Fetching
  const [tmdbResults, booksResults, gamesResults] = await Promise.all([
    searchTMDB(query),
    searchGoogleBooks(query),
    searchIGDB(query)
  ]);

  // Combine and Normalize
  const combinedResults: MediaItem[] = [
    ...tmdbResults,
    ...booksResults,
    ...gamesResults
  ];

  return NextResponse.json(combinedResults);
}
