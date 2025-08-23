import { ENV } from "./env";
import type { Category, MediaItem } from "./schema";

/* -------------------- TMDB -------------------- */
const TMDB_BASE = "https://api.themoviedb.org/3";

async function tmdbFetch(path: string, params: Record<string, string> = {}) {
  if (!ENV.TMDB_API_KEY) return null;
  const url = new URL(TMDB_BASE + path);
  url.searchParams.set("api_key", ENV.TMDB_API_KEY);
  url.searchParams.set("language", "en-US");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) return null;
  return res.json();
}

function mapTmdbListItem(it: any, category: Category): MediaItem {
  const title = it.title || it.name || "Untitled";
  const date = it.release_date || it.first_air_date;
  return {
    id: `tmdb:${category}:${it.id}`,
    source: "tmdb",
    sourceId: String(it.id),
    category,
    title,
    year: date ? Number(String(date).slice(0, 4)) : undefined,
    imageUrl: it.poster_path ? `https://image.tmdb.org/t/p/w500${it.poster_path}` : undefined,
    genres: (it.genre_ids || []).map((g: any) => String(g))
  };
}

export async function tmdbSearchAll(query: string): Promise<MediaItem[]> {
  if (!ENV.TMDB_API_KEY) return [];
  const [movies, tv] = await Promise.all([
    tmdbFetch("/search/movie", { query, include_adult: "false", page: "1" }),
    tmdbFetch("/search/tv", { query, include_adult: "false", page: "1" })
  ]);
  const arr: MediaItem[] = [];
  if (movies?.results) arr.push(...movies.results.map((r: any) => mapTmdbListItem(r, "film")));
  if (tv?.results) {
    for (const r of tv.results) {
      const isAnime = (r.origin_country || []).includes("JP") || (r.genre_ids || []).includes(16);
      arr.push(mapTmdbListItem(r, isAnime ? "anime" : "tv"));
    }
  }
  return arr;
}

export async function tmdbPopular(): Promise<Record<"film" | "tv" | "anime", MediaItem[]>> {
  const [moviePop, tvPop, animeDiscover] = await Promise.all([
    tmdbFetch("/movie/popular", { page: "1" }),
    tmdbFetch("/tv/popular", { page: "1" }),
    tmdbFetch("/discover/tv", { with_genres: "16", sort_by: "popularity.desc", page: "1" })
  ]);
  const film = (moviePop?.results || []).map((r: any) => mapTmdbListItem(r, "film")).slice(0, 20);
  const tv = (tvPop?.results || []).map((r: any) => mapTmdbListItem(r, "tv")).slice(0, 20);
  const anime = (animeDiscover?.results || []).map((r: any) => mapTmdbListItem(r, "anime")).slice(0, 20);
  return { film, tv, anime };
}

/* -------------------- IGDB via Twitch -------------------- */
let _token: { value: string; expires: number } | null = null;
async function getTwitchToken() {
  if (!ENV.TWITCH_CLIENT_ID || !ENV.TWITCH_CLIENT_SECRET) return null;
  const now = Date.now();
  if (_token && _token.expires > now + 60_000) return _token.value;
  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${ENV.TWITCH_CLIENT_ID}&client_secret=${ENV.TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,
    { method: "POST" }
  );
  const json = await res.json();
  _token = { value: json.access_token, expires: now + json.expires_in * 1000 };
  return _token.value;
}
async function igdbQuery(endpoint: string, body: string) {
  const token = await getTwitchToken();
  if (!token) return [];
  const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: "POST",
    headers: {
      "Client-ID": ENV.TWITCH_CLIENT_ID!,
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain"
    },
    body
  });
  if (!res.ok) return [];
  return res.json();
}
export async function igdbSearch(query: string): Promise<MediaItem[]> {
  if (!ENV.TWITCH_CLIENT_ID || !ENV.TWITCH_CLIENT_SECRET) return [];
  const q = `
    fields id, name, first_release_date, cover.image_id, genres.name;
    search "${query.replace(/"/g, '\\"')}";
    where version_parent = null;
    limit 25;
  `;
  const rows = await igdbQuery("games", q);
  return (rows || []).map((g: any) => ({
    id: `igdb:game:${g.id}`,
    source: "igdb" as const,
    sourceId: String(g.id),
    category: "game" as const,
    title: g.name,
    year: g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : undefined,
    imageUrl: g.cover?.image_id ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${g.cover.image_id}.jpg` : undefined,
    genres: (g.genres || []).map((x: any) => x.name)
  }));
}
export async function igdbPopular(): Promise<MediaItem[]> {
  const q = `
    fields id, name, first_release_date, cover.image_id, genres.name, rating_count;
    where rating_count != null & rating_count > 100;
    sort rating_count desc;
    limit 40;
  `;
  const rows = await igdbQuery("games", q);
  return (rows || []).map((g: any) => ({
    id: `igdb:game:${g.id}`,
    source: "igdb" as const,
    sourceId: String(g.id),
    category: "game" as const,
    title: g.name,
    year: g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : undefined,
    imageUrl: g.cover?.image_id ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${g.cover.image_id}.jpg` : undefined,
    genres: (g.genres || []).map((x: any) => x.name)
  })).slice(0, 20);
}

/* -------------------- Google Books -------------------- */

function normalizeGBooksThumb(url?: string): string | undefined {
  if (!url) return undefined;
  // Force https, some thumbnails come back as http://
  return url.replace(/^http:\/\//i, "https://");
}

export async function gbooksSearch(query: string): Promise<MediaItem[]> {
  if (!ENV.GOOGLE_BOOKS_API_KEY) return [];
  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", query);
  url.searchParams.set("maxResults", "25");
  url.searchParams.set("key", ENV.GOOGLE_BOOKS_API_KEY);
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) return [];
  const json = await res.json();
  return (json.items || []).map((b: any) => {
    const info = b.volumeInfo || {};
    const thumb = normalizeGBooksThumb(info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail);
    const year = info.publishedDate ? Number(String(info.publishedDate).slice(0, 4)) : undefined;
    return {
      id: `gbooks:book:${b.id}`,
      source: "gbooks" as const,
      sourceId: b.id,
      category: "book" as const,
      title: info.title || "Untitled",
      year,
      imageUrl: thumb,
      genres: info.categories || []
    } as MediaItem;
  });
}

export async function gbooksPopular(): Promise<MediaItem[]> {
  if (!ENV.GOOGLE_BOOKS_API_KEY) return [];
  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", "subject:fiction");
  url.searchParams.set("maxResults", "40");
  url.searchParams.set("orderBy", "relevance");
  url.searchParams.set("key", ENV.GOOGLE_BOOKS_API_KEY);
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) return [];
  const json = await res.json();
  return (json.items || []).map((b: any) => {
    const info = b.volumeInfo || {};
    const thumb = normalizeGBooksThumb(info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail);
    const year = info.publishedDate ? Number(String(info.publishedDate).slice(0, 4)) : undefined;
    return {
      id: `gbooks:book:${b.id}`,
      source: "gbooks" as const,
      sourceId: b.id,
      category: "book" as const,
      title: info.title || "Untitled",
      year,
      imageUrl: thumb,
      genres: info.categories || []
    } as MediaItem;
  }).slice(0, 20);
}
