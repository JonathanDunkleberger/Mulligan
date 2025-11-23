import { NextResponse } from "next/server";

// 1. Define the normalized interface
interface MediaResult {
  id: string;
  title: string;
  type: 'movie' | 'tv' | 'book' | 'game';
  description: string;
  imageUrl: string;
  releaseYear: string;
  sourceId: string;
}

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
async function searchTMDB(query: string): Promise<MediaResult[]> {
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
      .map((item: any) => ({
        id: `tmdb-${item.id}`,
        title: item.title || item.name,
        type: item.media_type === 'movie' ? 'movie' : 'tv',
        description: item.overview || "",
        imageUrl: item.poster_path 
          ? `https://image.tmdb.org/t/p/w500${item.poster_path}` 
          : "https://placehold.co/400x600?text=No+Image",
        releaseYear: (item.release_date || item.first_air_date || "").substring(0, 4),
        sourceId: String(item.id)
      }));
  } catch (error) {
    console.error("TMDB Search Error:", error);
    return [];
  }
}

async function searchGoogleBooks(query: string): Promise<MediaResult[]> {
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
      return {
        id: `gbooks-${item.id}`,
        title: info.title,
        type: 'book',
        description: info.description || "",
        imageUrl: info.imageLinks?.thumbnail 
          ? info.imageLinks.thumbnail.replace('http:', 'https:') 
          : "https://placehold.co/400x600?text=No+Image",
        releaseYear: (info.publishedDate || "").substring(0, 4),
        sourceId: item.id
      };
    });
  } catch (error) {
    console.error("Google Books Search Error:", error);
    return [];
  }
}

async function searchIGDB(query: string): Promise<MediaResult[]> {
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
      body: `fields name, cover.url, summary, first_release_date; search "${query.replace(/"/g, '\\"')}"; limit 10;`
    });

    if (!res.ok) return [];

    const data = await res.json();

    return data.map((item: any) => ({
      id: `igdb-${item.id}`,
      title: item.name,
      type: 'game',
      description: item.summary || "",
      imageUrl: item.cover?.url 
        ? `https:${item.cover.url.replace('t_thumb', 't_cover_big')}` 
        : "https://placehold.co/400x600?text=No+Image",
      releaseYear: item.first_release_date 
        ? new Date(item.first_release_date * 1000).getFullYear().toString() 
        : "",
      sourceId: String(item.id)
    }));
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
  const combinedResults: MediaResult[] = [
    ...tmdbResults,
    ...booksResults,
    ...gamesResults
  ];

  return NextResponse.json(combinedResults);
}
