import { ENV } from "./env";
import type { Category, MediaItem } from "./schema";

/* -------------------- TMDB -------------------- */
const TMDB_BASE = "https://api.themoviedb.org/3";

const TMDB_GENRES: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Sci-Fi",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
  10759: "Action & Adventure",
  10762: "Kids",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics",
};

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
    backdropUrl: it.backdrop_path ? `https://image.tmdb.org/t/p/original${it.backdrop_path}` : undefined,
    genres: (it.genre_ids || []).map((g: any) => TMDB_GENRES[Number(g)] || String(g)),
    summary: it.overview,
    rating: it.vote_average,
  };
}

export async function tmdbGetDetails(category: "film" | "tv" | "anime", id: string): Promise<MediaItem | null> {
  if (!ENV.TMDB_API_KEY) return null;
  const type = category === "film" ? "movie" : "tv";
  const res = await tmdbFetch(`/${type}/${id}`, { append_to_response: "credits,videos" });
  if (!res) return null;
  
  const item = mapTmdbListItem(res, category);
  // Enrich with details
  item.genres = (res.genres || []).map((g: any) => g.name);
  item.status = res.status;
  
  // Map videos (prioritize trailers)
  if (res.videos?.results) {
    const vids = res.videos.results.filter((v: any) => v.site === "YouTube");
    const trailers = vids.filter((v: any) => v.type === "Trailer");
    const others = vids.filter((v: any) => v.type !== "Trailer");
    item.videos = [...trailers, ...others].slice(0, 3).map((v: any) => ({
      id: v.key,
      title: v.name,
      thumbnail: `https://i.ytimg.com/vi/${v.key}/hqdefault.jpg`
    }));
  }
  
  if (category === "film") {
    item.runtime = res.runtime ? `${res.runtime}m` : undefined;
    const director = res.credits?.crew?.find((c: any) => c.job === "Director")?.name;
    if (director) item.creators = [director];
  } else {
    item.runtime = res.number_of_episodes ? `${res.number_of_episodes} eps` : undefined;
    const creator = res.created_by?.map((c: any) => c.name);
    if (creator?.length) item.creators = creator;
  }
  return item;
}

export async function tmdbSearch(query: string, category: "film" | "tv" | "anime"): Promise<MediaItem[]> {
  if (!ENV.TMDB_API_KEY) return [];
  const type = category === "film" ? "movie" : "tv";
  
  const res = await tmdbFetch(`/search/${type}`, { query, include_adult: "false", page: "1" });
  if (!res || !res.results) return [];

  const items: MediaItem[] = [];
  for (const r of res.results) {
    if (category === "anime") {
       const isAnime = (r.origin_country || []).includes("JP") || (r.genre_ids || []).includes(16);
       if (!isAnime) continue;
    }
    items.push(mapTmdbListItem(r, category));
  }
  return items;
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

export async function tmdbGetRecommendations(id: string, category: "film" | "tv" | "anime"): Promise<MediaItem[]> {
  if (!ENV.TMDB_API_KEY) return [];
  const type = category === "film" ? "movie" : "tv";
  // Extract the numeric ID from "tmdb:film:123"
  const numericId = id.split(":").pop();
  if (!numericId) return [];

  const res = await tmdbFetch(`/${type}/${numericId}/recommendations`, { page: "1" });
  if (!res || !res.results) return [];
  
  let results = res.results;

  // Strict filtering for Anime to prevent pollution (e.g. "Severance" appearing in Anime)
  if (category === "anime") {
    results = results.filter((r: any) => {
      const isAnime = (r.origin_country || []).includes("JP") || (r.genre_ids || []).includes(16);
      return isAnime;
    });
  }

  return results.map((r: any) => mapTmdbListItem(r, category)).slice(0, 10);
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
    fields id, name, first_release_date, cover.image_id, genres.name, summary, rating, involved_companies.company.name, involved_companies.developer, screenshots.image_id;
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
    backdropUrl: g.screenshots?.[0]?.image_id ? `https://images.igdb.com/igdb/image/upload/t_screenshot_big/${g.screenshots[0].image_id}.jpg` : undefined,
    genres: (g.genres || []).map((x: any) => x.name),
    summary: g.summary,
    rating: g.rating ? g.rating / 10 : undefined, // Scale to 0-10
    creators: g.involved_companies?.filter((c: any) => c.developer).map((c: any) => c.company.name),
  }));
}

export async function igdbGetDetails(id: string): Promise<MediaItem | null> {
  if (!ENV.TWITCH_CLIENT_ID || !ENV.TWITCH_CLIENT_SECRET) return null;
  const q = `
    fields name, first_release_date, cover.image_id, screenshots.image_id, genres.name, summary, rating, involved_companies.company.name, involved_companies.developer, videos.video_id, videos.name;
    where id = ${id};
  `;
  const rows = await igdbQuery("games", q);
  if (!rows || !rows.length) return null;
  const g = rows[0];
  
  return {
    id: `igdb:game:${g.id}`,
    source: "igdb",
    sourceId: String(g.id),
    category: "game",
    title: g.name,
    year: g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : undefined,
    imageUrl: g.cover?.image_id ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${g.cover.image_id}.jpg` : undefined,
    backdropUrl: g.screenshots?.[0]?.image_id ? `https://images.igdb.com/igdb/image/upload/t_screenshot_big/${g.screenshots[0].image_id}.jpg` : undefined,
    genres: (g.genres || []).map((x: any) => x.name),
    summary: g.summary,
    rating: g.rating ? g.rating / 10 : undefined,
    creators: g.involved_companies?.filter((c: any) => c.developer).map((c: any) => c.company.name),
    videos: (g.videos || []).slice(0, 3).map((v: any) => ({
      id: v.video_id,
      title: v.name || "Gameplay Video",
      thumbnail: `https://i.ytimg.com/vi/${v.video_id}/hqdefault.jpg`
    })),
  };
}

export async function igdbPopular(): Promise<MediaItem[]> {
  const q = `
    fields id, name, first_release_date, cover.image_id, genres.name, rating_count, summary, rating, involved_companies.company.name, involved_companies.developer, screenshots.image_id;
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
    backdropUrl: g.screenshots?.[0]?.image_id ? `https://images.igdb.com/igdb/image/upload/t_screenshot_big/${g.screenshots[0].image_id}.jpg` : undefined,
    genres: (g.genres || []).map((x: any) => x.name),
    summary: g.summary,
    rating: g.rating ? g.rating / 10 : undefined,
    creators: g.involved_companies?.filter((c: any) => c.developer).map((c: any) => c.company.name),
  })).slice(0, 20);
}

export async function igdbGetSimilar(id: string): Promise<MediaItem[]> {
  // Extract numeric ID
  const numericId = id.split(":").pop();
  if (!numericId) return [];

  // Fetch the game's similar_games field
  const q = `
    fields similar_games.id, similar_games.name, similar_games.first_release_date, similar_games.cover.image_id, similar_games.genres.name, similar_games.summary, similar_games.rating, similar_games.involved_companies.company.name, similar_games.involved_companies.developer;
    where id = ${numericId};
  `;
  const rows = await igdbQuery("games", q);
  if (!rows || !rows.length || !rows[0].similar_games) return [];

  return rows[0].similar_games.map((g: any) => ({
    id: `igdb:game:${g.id}`,
    source: "igdb" as const,
    sourceId: String(g.id),
    category: "game" as const,
    title: g.name,
    year: g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : undefined,
    imageUrl: g.cover?.image_id ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${g.cover.image_id}.jpg` : undefined,
    backdropUrl: undefined, // similar_games expansion usually doesn't include screenshots to save bandwidth, can be added if needed
    genres: (g.genres || []).map((x: any) => x.name),
    summary: g.summary,
    rating: g.rating ? g.rating / 10 : undefined,
    creators: g.involved_companies?.filter((c: any) => c.developer).map((c: any) => c.company.name),
  })).slice(0, 10);
}


export async function tmdbDiscover(category: "film" | "tv" | "anime", genreNames: string[]): Promise<MediaItem[]> {
  if (!ENV.TMDB_API_KEY) return [];
  const type = category === "film" ? "movie" : "tv";
  
  // Reverse map genre names to IDs
  const genreIds: number[] = [];
  for (const [id, name] of Object.entries(TMDB_GENRES)) {
    if (genreNames.some(g => g.toLowerCase() === name.toLowerCase())) {
      genreIds.push(Number(id));
    }
  }
  
  if (genreIds.length === 0 && category !== "anime") return [];

  const params: Record<string, string> = {
    page: "1",
    sort_by: "popularity.desc",
    "vote_count.gte": "100",
  };

  if (category === "anime") {
    params.with_genres = "16"; // Animation
    params.with_keywords = "210024"; // Anime keyword often used, or just rely on Animation genre + JP origin
  } else {
    if (genreIds.length > 0) params.with_genres = genreIds.join(",");
  }

  const res = await tmdbFetch(`/discover/${type}`, params);
  if (!res || !res.results) return [];

  const items: MediaItem[] = [];
  for (const r of res.results) {
    // For anime, double check origin country if possible, but TMDB discover is loose
    if (category === "anime") {
       const isAnime = (r.origin_country || []).includes("JP") || (r.genre_ids || []).includes(16);
       if (!isAnime) continue;
    }
    items.push(mapTmdbListItem(r, category));
  }
  
  return items.slice(0, 12);
}

export async function igdbDiscover(genreNames: string[]): Promise<MediaItem[]> {
  if (!ENV.TWITCH_CLIENT_ID || !ENV.TWITCH_CLIENT_SECRET) return [];
  
  // IGDB genres are strings in our DB, but we need to match them. 
  // IGDB API allows filtering by genre name if we join.
  // Or we can just search for games with these genres.
  // Let's try a simple approach: search for games where genres.name = "X"
  
  if (genreNames.length === 0) return [];
  
  // Construct a where clause
  // genres.name = ("RPG", "Shooter")
  const genreList = genreNames.map(g => `"${g}"`).join(",");
  
  const q = `
    fields id, name, first_release_date, cover.image_id, genres.name, summary, rating, involved_companies.company.name, involved_companies.developer, screenshots.image_id;
    where genres.name = (${genreList}) & rating > 70 & rating_count > 20;
    sort rating_count desc;
    limit 15;
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
    backdropUrl: g.screenshots?.[0]?.image_id ? `https://images.igdb.com/igdb/image/upload/t_screenshot_big/${g.screenshots[0].image_id}.jpg` : undefined,
    genres: (g.genres || []).map((x: any) => x.name),
    summary: g.summary,
    rating: g.rating ? g.rating / 10 : undefined,
    creators: g.involved_companies?.filter((c: any) => c.developer).map((c: any) => c.company.name),
  }));
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
      genres: info.categories || [],
      summary: info.description,
      creators: info.authors,
    } as MediaItem;
  });
}

export async function gbooksPopular(): Promise<MediaItem[]> {
  if (!ENV.GOOGLE_BOOKS_API_KEY) return [];
  
  // Google Books API doesn't have a "popular" endpoint, so "subject:fiction" returns public domain classics.
  // To serve "Whack-a-Mole" style popular hits (Harry Potter, King, etc.), we'll use a curated list of 
  // mega-popular authors and series to seed the "Popular" section.
  const POPULAR_SEEDS = [
    "Harry Potter", "Game of Thrones", "Stephen King", "Brandon Sanderson", 
    "J.R.R. Tolkien", "The Hunger Games", "Percy Jackson", "Agatha Christie", 
    "Dan Brown", "Colleen Hoover", "Sarah J. Maas", "Dune", "The Witcher", 
    "Neil Gaiman", "Haruki Murakami", "James Patterson", "John Grisham",
    "The Lord of the Rings", "Twilight", "Fifty Shades of Grey"
  ];

  // Keywords to filter out "meta-content" and bundles
  const EXCLUDED_KEYWORDS = [
    "unofficial", "guide", "trivia", "facts", "notebook", 
    "boxed set", "box set", "collection", "bundle", "complete set", 
    "summary", "analysis", "study guide", "companion", "encyclopedia",
    "journal", "sketchbook", "coloring book", "poster book", "sticker book"
  ];

  // Pick 4 random seeds to get a mix of 20 items (5 each)
  const seeds = POPULAR_SEEDS.sort(() => 0.5 - Math.random()).slice(0, 4);
  
  const promises = seeds.map(async (seed) => {
    const url = new URL("https://www.googleapis.com/books/v1/volumes");
    url.searchParams.set("q", seed); // Search directly for the popular term
    url.searchParams.set("langRestrict", "en");
    url.searchParams.set("printType", "books");
    url.searchParams.set("maxResults", "20"); // Fetch more to allow filtering
    url.searchParams.set("orderBy", "relevance");
    url.searchParams.set("key", ENV.GOOGLE_BOOKS_API_KEY!);
    
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return [];
    const json = await res.json();
    
    const items = (json.items || []).map((b: any) => {
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
        genres: info.categories || [],
        summary: info.description,
        creators: info.authors,
        rating: info.averageRating ? info.averageRating * 2 : undefined,
      } as MediaItem;
    });

    // Filter out unwanted items
    const filtered = items.filter((item: MediaItem) => {
      const titleLower = item.title.toLowerCase();
      // Check for excluded keywords
      if (EXCLUDED_KEYWORDS.some(kw => titleLower.includes(kw))) return false;
      // Filter out items with no image (often low quality)
      if (!item.imageUrl) return false;
      return true;
    });

    return filtered.slice(0, 5);
  });

  const results = await Promise.all(promises);
  const flatResults = results.flat();
  
  // Shuffle the final list so it doesn't look like blocks of authors
  return flatResults.sort(() => 0.5 - Math.random());
}

export async function gbooksGetSimilar(id: string): Promise<MediaItem[]> {
  // GBooks doesn't have a "similar" endpoint. We'll fetch the book details to get author/categories, then search.
  const details = await gbooksGetDetails(id.split(":").pop()!);
  if (!details) return [];

  const author = details.creators?.[0];
  if (!author) return [];

  // Search for other books by this author
  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", `inauthor:"${author}"`);
  url.searchParams.set("langRestrict", "en");
  url.searchParams.set("printType", "books");
  url.searchParams.set("maxResults", "10");
  url.searchParams.set("orderBy", "relevance");
  if (ENV.GOOGLE_BOOKS_API_KEY) url.searchParams.set("key", ENV.GOOGLE_BOOKS_API_KEY);
  
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) return [];
  const json = await res.json();
  
  return (json.items || [])
    .filter((b: any) => b.id !== details.sourceId) // Exclude the original book
    .map((b: any) => {
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
        genres: info.categories || [],
        summary: info.description,
        creators: info.authors,
        rating: info.averageRating ? info.averageRating * 2 : undefined,
      } as MediaItem;
    });
}

export async function gbooksDiscover(genreNames: string[]): Promise<MediaItem[]> {
  if (!ENV.GOOGLE_BOOKS_API_KEY) return [];
  
  // Google Books supports "subject:fiction", "subject:fantasy", etc.
  // We'll pick the top genre or "fiction" if none.
  const subject = genreNames.length > 0 ? genreNames[0] : "fiction";
  
  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", `subject:${subject}`);
  url.searchParams.set("langRestrict", "en");
  url.searchParams.set("printType", "books");
  url.searchParams.set("maxResults", "20");
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
      genres: info.categories || [],
      summary: info.description,
      creators: info.authors,
      rating: info.averageRating ? info.averageRating * 2 : undefined,
    } as MediaItem;
  });
}

export async function gbooksGetDetails(id: string): Promise<MediaItem | null> {
  if (!ENV.GOOGLE_BOOKS_API_KEY) return null;
  const url = new URL(`https://www.googleapis.com/books/v1/volumes/${id}`);
  url.searchParams.set("key", ENV.GOOGLE_BOOKS_API_KEY);
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) return null;
  const b = await res.json();
  const info = b.volumeInfo || {};
  const thumb = normalizeGBooksThumb(info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || info.imageLinks?.large);
  
  return {
    id: `gbooks:book:${b.id}`,
    source: "gbooks",
    sourceId: b.id,
    category: "book",
    title: info.title || "Untitled",
    year: info.publishedDate ? Number(String(info.publishedDate).slice(0, 4)) : undefined,
    imageUrl: thumb,
    genres: info.categories || [],
    summary: info.description?.replace(/<[^>]*>/g, ""), // Strip HTML
    rating: info.averageRating ? info.averageRating * 2 : undefined,
    creators: info.authors,
    runtime: info.pageCount ? `${info.pageCount} p` : undefined,
  };
}
