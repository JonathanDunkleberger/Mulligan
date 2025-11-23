import { NextResponse } from "next/server";

// --- Types ---
interface TrendingItem {
  id: string;
  title: string;
  imageUrl: string;
  backdropUrl: string;
  type: string;
  releaseYear: string;
  genres: string[];
  matchScore: number;
  trailerUrl: string;
  overview: string;
}

// --- TMDB Config ---
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_GENRES: Record<number, string> = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
  99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History",
  27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance", 878: "Sci-Fi",
  10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western",
  10759: "Action & Adventure", 10762: "Kids", 10763: "News", 10764: "Reality",
  10765: "Sci-Fi & Fantasy", 10766: "Soap", 10767: "Talk", 10768: "War & Politics",
};

// --- Helpers ---
async function getTwitchToken() {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  try {
    const res = await fetch(
      `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
      { method: "POST" }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token;
  } catch {
    return null;
  }
}

// --- Fetchers ---

async function fetchTMDB(category: 'movie' | 'tv' | 'anime'): Promise<TrendingItem[]> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return [];

  let endpoint = "";
  if (category === 'anime') {
    endpoint = `/discover/tv?api_key=${apiKey}&with_genres=16&with_original_language=ja&sort_by=popularity.desc&page=1`;
  } else {
    endpoint = `/trending/${category}/week?api_key=${apiKey}&page=1`;
  }

  try {
    const res = await fetch(`${TMDB_BASE}${endpoint}`);
    if (!res.ok) return [];
    const data = await res.json();
    
    // Fetch trailers in parallel for the top 24 items
    const results = data.results.slice(0, 24);
    const itemsWithTrailers = await Promise.all(results.map(async (item: any) => {
      // Fetch video details
      const type = category === 'movie' ? 'movie' : 'tv';
      const vidRes = await fetch(`${TMDB_BASE}/${type}/${item.id}/videos?api_key=${apiKey}`);
      let trailerUrl = "";
      if (vidRes.ok) {
        const vidData = await vidRes.json();
        const trailer = vidData.results?.find((v: any) => v.site === "YouTube" && v.type === "Trailer");
        if (trailer) trailerUrl = `https://www.youtube.com/watch?v=${trailer.key}`;
      }

      return {
        id: `tmdb-${item.id}`,
        title: item.title || item.name,
        imageUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : "",
        backdropUrl: item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : "",
        type: category === 'anime' ? 'anime' : (category === 'movie' ? 'movie' : 'tv'),
        releaseYear: (item.release_date || item.first_air_date || "").substring(0, 4),
        genres: (item.genre_ids || []).map((id: number) => TMDB_GENRES[id] || "Unknown"),
        matchScore: Math.round((item.vote_average || 0) * 10),
        trailerUrl,
        overview: item.overview || ""
      };
    }));

    return itemsWithTrailers;
  } catch (e) {
    console.error("TMDB Fetch Error", e);
    return [];
  }
}

async function fetchIGDB(): Promise<TrendingItem[]> {
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
      body: `
        fields name, cover.url, screenshots.url, first_release_date, summary, total_rating, genres.name, videos.video_id;
        where total_rating_count > 100 & total_rating != null;
        sort total_rating desc;
        limit 24;
      `
    });

    if (!res.ok) return [];
    const data = await res.json();

    return data.map((item: any) => ({
      id: `igdb-${item.id}`,
      title: item.name,
      imageUrl: item.cover?.url ? `https:${item.cover.url.replace('t_thumb', 't_cover_big')}` : "",
      backdropUrl: item.screenshots?.[0]?.url ? `https:${item.screenshots[0].url.replace('t_thumb', 't_screenshot_big')}` : "",
      type: 'game',
      releaseYear: item.first_release_date ? new Date(item.first_release_date * 1000).getFullYear().toString() : "",
      genres: (item.genres || []).map((g: any) => g.name),
      matchScore: Math.round(item.total_rating || 0),
      trailerUrl: item.videos?.[0]?.video_id ? `https://www.youtube.com/watch?v=${item.videos[0].video_id}` : "",
      overview: item.summary || ""
    }));
  } catch (e) {
    console.error("IGDB Fetch Error", e);
    return [];
  }
}

async function fetchBooks(): Promise<TrendingItem[]> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=subject:fiction&orderBy=relevance&maxResults=24&key=${apiKey}`
    );
    if (!res.ok) return [];
    const data = await res.json();

    return (data.items || []).map((item: any) => {
      const info = item.volumeInfo;
      return {
        id: `gbooks-${item.id}`,
        title: info.title,
        imageUrl: info.imageLinks?.thumbnail ? info.imageLinks.thumbnail.replace('http:', 'https:') : "",
        backdropUrl: info.imageLinks?.thumbnail ? info.imageLinks.thumbnail.replace('http:', 'https:') : "", // Books don't really have backdrops
        type: 'book',
        releaseYear: (info.publishedDate || "").substring(0, 4),
        genres: info.categories || [],
        matchScore: info.averageRating ? Math.round(info.averageRating * 20) : 0, // Scale 5 to 100
        trailerUrl: "",
        overview: info.description || ""
      };
    });
  } catch (e) {
    console.error("Google Books Fetch Error", e);
    return [];
  }
}

// --- Main Handler ---
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");

  let items: TrendingItem[] = [];

  switch (category) {
    case 'movie':
    case 'tv':
    case 'anime':
      items = await fetchTMDB(category);
      break;
    case 'game':
      items = await fetchIGDB();
      break;
    case 'book':
      items = await fetchBooks();
      break;
    default:
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  return NextResponse.json(items);
}
