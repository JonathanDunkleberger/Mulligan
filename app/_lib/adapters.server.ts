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
  
  // Append extra details: credits, videos, watch providers, content ratings, keywords
  const append = "credits,videos,watch/providers,content_ratings,release_dates,keywords";
  const res = await tmdbFetch(`/${type}/${id}`, { append_to_response: append });
  if (!res) return null;
  
  const item = mapTmdbListItem(res, category);
  
  // 1. Basic Enrichment
  item.genres = (res.genres || []).map((g: any) => g.name);
  item.status = res.status;
  item.tagline = res.tagline;
  
  // 2. Cast & Crew
  if (res.credits?.cast) {
    item.cast = res.credits.cast.slice(0, 12).map((c: any) => ({
      id: String(c.id),
      name: c.name,
      character: c.character,
      imageUrl: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : undefined
    }));
  }

  if (category === "film") {
    item.runtime = res.runtime ? `${res.runtime}m` : undefined;
    const director = res.credits?.crew?.find((c: any) => c.job === "Director")?.name;
    if (director) item.creators = [director];
    
    // Content Rating (US)
    const usRelease = res.release_dates?.results?.find((r: any) => r.iso_3166_1 === "US");
    if (usRelease) {
      const cert = usRelease.release_dates?.find((d: any) => d.certification)?.certification;
      if (cert) item.contentRating = cert;
    }
  } else {
    // TV/Anime Specifics
    item.runtime = res.episode_run_time?.[0] ? `${res.episode_run_time[0]}m` : undefined;
    if (!item.runtime && res.number_of_episodes) item.runtime = `${res.number_of_episodes} eps`;
    
    const creator = res.created_by?.map((c: any) => c.name);
    if (creator?.length) item.creators = creator;

    // Seasons
    if (res.seasons) {
      item.seasons = res.seasons
        .filter((s: any) => s.season_number > 0) // Skip "Specials" (Season 0) usually
        .map((s: any) => ({
          id: String(s.id),
          name: s.name,
          season_number: s.season_number,
          episode_count: s.episode_count,
          air_date: s.air_date,
          poster_path: s.poster_path ? `https://image.tmdb.org/t/p/w300${s.poster_path}` : undefined,
          overview: s.overview
        }));
    }

    // Content Rating (TV)
    const rating = res.content_ratings?.results?.find((r: any) => r.iso_3166_1 === "US")?.rating;
    if (rating) item.contentRating = rating;
  }

  // 3. Watch Providers (US Flatrate)
  const usProviders = res["watch/providers"]?.results?.US?.flatrate;
  if (usProviders) {
    item.watchProviders = usProviders.map((p: any) => ({
      provider_id: p.provider_id,
      provider_name: p.provider_name,
      logo_path: p.logo_path ? `https://image.tmdb.org/t/p/original${p.logo_path}` : undefined
    }));
  }
  
  // 4. Videos
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
       // Strict check: Must be Animation AND from Japan or China
       const isAnime = (r.genre_ids || []).includes(16) && (r.origin_country || []).some((c: string) => ["JP", "CN"].includes(c));
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
      // Strict check: Must be Animation AND from Japan or China
      const isAnime = (r.genre_ids || []).includes(16) && (r.origin_country || []).some((c: string) => ["JP", "CN"].includes(c));
      arr.push(mapTmdbListItem(r, isAnime ? "anime" : "tv"));
    }
  }
  return arr;
}

export async function tmdbPopular(): Promise<Record<"film" | "tv" | "anime", MediaItem[]>> {
  const [moviePop1, moviePop2, tvPop1, tvPop2, animePop1, animePop2] = await Promise.all([
    tmdbFetch("/movie/popular", { page: "1" }),
    tmdbFetch("/movie/popular", { page: "2" }),
    tmdbFetch("/tv/popular", { page: "1" }),
    tmdbFetch("/tv/popular", { page: "2" }),
    // Filter for Animation (16) AND Origin Country (Japan or China) to exclude Western cartoons
    tmdbFetch("/discover/tv", { 
      with_genres: "16", 
      with_origin_country: "JP|CN", 
      sort_by: "popularity.desc", 
      page: "1" 
    }),
    tmdbFetch("/discover/tv", { 
      with_genres: "16", 
      with_origin_country: "JP|CN", 
      sort_by: "popularity.desc", 
      page: "2" 
    })
  ]);

  const film = [
    ...(moviePop1?.results || []),
    ...(moviePop2?.results || [])
  ].map((r: any) => mapTmdbListItem(r, "film")).slice(0, 24);

  const tv = [
    ...(tvPop1?.results || []),
    ...(tvPop2?.results || [])
  ].map((r: any) => mapTmdbListItem(r, "tv")).slice(0, 24);

  const anime = [
    ...(animePop1?.results || []),
    ...(animePop2?.results || [])
  ].map((r: any) => mapTmdbListItem(r, "anime")).slice(0, 24);

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

  return results.map((r: any) => mapTmdbListItem(r, category)).slice(0, 20);
}

/* -------------------- IGDB via Twitch -------------------- */
let _token: { value: string; expires: number } | null = null;

function normalizeGameTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/:\s*.*$/, "") // Remove subtitles (e.g. "Batman: Arkham City" -> "batman")
    .replace(/\s+(?:part\s+)?(?:\d+|i{1,3}|iv|v|vi{0,3}|ix|x|xi{0,3}|xiv|xv|xvi{0,3}|xix|xx)$/i, "") // Remove numbers/roman numerals
    .trim();
}

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
  
  // Expanded query for "Mega Detail"
  const q = `
    fields 
      name, first_release_date, cover.image_id, screenshots.image_id, genres.name, summary, rating, 
      involved_companies.company.name, involved_companies.developer, involved_companies.publisher,
      videos.video_id, videos.name,
      platforms.name, websites.url, websites.category,
      dlcs.name, expansions.name,
      game_modes.name, themes.name;
    where id = ${id};
  `;
  
  const rows = await igdbQuery("games", q);
  if (!rows || !rows.length) return null;
  const g = rows[0];
  
  const item: MediaItem = {
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
    
    // New Fields
    platforms: (g.platforms || []).map((p: any) => p.name),
    developer: g.involved_companies?.find((c: any) => c.developer)?.company?.name,
    publisher: g.involved_companies?.find((c: any) => c.publisher)?.company?.name,
    websites: (g.websites || []).map((w: any) => ({
      category: String(w.category), // IGDB uses enums, but string is fine for now
      url: w.url
    })),
    // We can map DLCs/Expansions to "Seasons" or just list them in summary later if needed
    // For now, let's just keep them in mind.
  };
  
  return item;
}

export async function igdbPopular(): Promise<MediaItem[]> {
  const q = `
    fields id, name, first_release_date, cover.image_id, genres.name, rating_count, summary, rating, involved_companies.company.name, involved_companies.developer, screenshots.image_id, collection.name;
    where rating_count != null & rating_count > 100;
    sort rating_count desc;
    limit 100;
  `;
  const rows = await igdbQuery("games", q);
  
  const seenKeys = new Set<string>();
  const items: MediaItem[] = [];

  for (const g of (rows || [])) {
    const keys: string[] = [];
    
    // Key 1: Collection Name (if available)
    if (g.collection?.name) {
      keys.push(`collection:${g.collection.name.toLowerCase()}`);
    }
    
    // Key 2: Normalized Title (fallback for games without collection or loose matches)
    const normTitle = normalizeGameTitle(g.name);
    keys.push(`title:${normTitle}`);

    // Check if any key has been seen
    const isDuplicate = keys.some(k => seenKeys.has(k));
    
    if (isDuplicate) {
      continue;
    }

    // Mark all keys as seen
    keys.forEach(k => seenKeys.add(k));
    
    items.push({
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
    });

    if (items.length >= 24) break;
  }

  return items;
}

export async function igdbGetSimilar(id: string): Promise<MediaItem[]> {
  // Extract numeric ID
  const numericId = id.split(":").pop();
  if (!numericId) return [];

  // Fetch the game's similar_games field
  // Added screenshots.image_id to the query
  const q = `
    fields similar_games.id, similar_games.name, similar_games.first_release_date, similar_games.cover.image_id, similar_games.genres.name, similar_games.summary, similar_games.rating, similar_games.involved_companies.company.name, similar_games.involved_companies.developer, similar_games.screenshots.image_id;
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
    backdropUrl: g.screenshots?.[0]?.image_id ? `https://images.igdb.com/igdb/image/upload/t_screenshot_big/${g.screenshots[0].image_id}.jpg` : undefined,
    genres: (g.genres || []).map((x: any) => x.name),
    summary: g.summary,
    rating: g.rating ? g.rating / 10 : undefined,
    creators: g.involved_companies?.filter((c: any) => c.developer).map((c: any) => c.company.name),
  })).slice(0, 20);
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
    params.with_origin_country = "JP|CN"; // Strict origin check
  } else {
    if (genreIds.length > 0) params.with_genres = genreIds.join(",");
  }

  const [res1, res2] = await Promise.all([
    tmdbFetch(`/discover/${type}`, { ...params, page: "1" }),
    tmdbFetch(`/discover/${type}`, { ...params, page: "2" })
  ]);

  const allResults = [
    ...(res1?.results || []),
    ...(res2?.results || [])
  ];

  const items: MediaItem[] = [];
  for (const r of allResults) {
    // For anime, double check origin country if possible, but TMDB discover is loose
    if (category === "anime") {
       const isAnime = (r.genre_ids || []).includes(16) && (r.origin_country || []).some((c: string) => ["JP", "CN"].includes(c));
       if (!isAnime) continue;
    }
    items.push(mapTmdbListItem(r, category));
  }
  
  return items.slice(0, 24);
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
    limit 50;
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
  })).slice(0, 24);
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
  url.searchParams.set("maxResults", "40");
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
  
  // To ensure high-quality "Whack-a-Mole" targets, we use a curated list of specific
  // highly-recognizable novels (classics + modern hits).
  // We search for the specific title to avoid "Series Bundles", "Study Guides", etc.
  const CURATED_BOOKS = [
    "Harry Potter and the Sorcerer's Stone",
    "A Game of Thrones",
    "The Fellowship of the Ring",
    "The Hunger Games",
    "The Da Vinci Code",
    "The Martian",
    "Project Hail Mary",
    "Dune",
    "A Court of Thorns and Roses",
    "Fourth Wing",
    "It Ends with Us",
    "The Seven Husbands of Evelyn Hugo",
    "Lessons in Chemistry",
    "Tomorrow, and Tomorrow, and Tomorrow",
    "Gone Girl",
    "The Girl with the Dragon Tattoo",
    "1984",
    "The Great Gatsby",
    "To Kill a Mockingbird",
    "Pride and Prejudice",
    "The Catcher in the Rye",
    "The Hobbit",
    "Fahrenheit 451",
    "Brave New World",
    "The Handmaid's Tale",
    "Ender's Game",
    "The Hitchhiker's Guide to the Galaxy",
    "Percy Jackson and the Lightning Thief",
    "The Shining",
    "It",
    "Mistborn: The Final Empire",
    "The Way of Kings",
    "The Name of the Wind",
    "Dark Matter",
    "Ready Player One",
    "Red Rising",
    "The Silent Patient",
    "Where the Crawdads Sing",
    "Daisy Jones & The Six",
    "Normal People",
    "Iron Flame",
    "Yellowface",
    "Demon Copperhead",
    "The Covenant of Water",
    "Tom Lake"
  ];

  // Pick 24 random titles to ensure variety on refresh
  const selected = CURATED_BOOKS.sort(() => 0.5 - Math.random()).slice(0, 24);
  
  const promises = selected.map(async (query) => {
    const url = new URL("https://www.googleapis.com/books/v1/volumes");
    url.searchParams.set("q", `intitle:"${query}"`); // Exact title search
    url.searchParams.set("langRestrict", "en");
    url.searchParams.set("printType", "books");
    url.searchParams.set("maxResults", "3"); // Fetch top 3 to pick the best edition
    url.searchParams.set("orderBy", "relevance");
    url.searchParams.set("key", ENV.GOOGLE_BOOKS_API_KEY!);
    
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return null;
    const json = await res.json();
    
    if (!json.items || json.items.length === 0) return null;

    // Sort by ratingsCount (popularity) to find the "main" edition vs obscure reprints
    // If ratingsCount is missing, fall back to relevance (original order)
    const bestMatch = json.items.sort((a: any, b: any) => {
      const countA = a.volumeInfo.ratingsCount || 0;
      const countB = b.volumeInfo.ratingsCount || 0;
      return countB - countA;
    })[0];

    const info = bestMatch.volumeInfo || {};
    const thumb = normalizeGBooksThumb(info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail);
    
    // Skip if no image (bad data)
    if (!thumb) return null;

    return {
      id: `gbooks:book:${bestMatch.id}`,
      source: "gbooks" as const,
      sourceId: bestMatch.id,
      category: "book" as const,
      title: info.title || "Untitled",
      year: info.publishedDate ? Number(String(info.publishedDate).slice(0, 4)) : undefined,
      imageUrl: thumb,
      genres: info.categories || [],
      summary: info.description,
      creators: info.authors,
      rating: info.averageRating ? info.averageRating * 2 : undefined,
    } as MediaItem;
  });

  const results = await Promise.all(promises);
  // Filter out nulls
  return results.filter((r): r is MediaItem => r !== null);
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
  url.searchParams.set("maxResults", "20");
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
    
    // New Fields
    pageCount: info.pageCount,
    publisherName: info.publisher,
    previewLink: info.previewLink,
    isbn: info.industryIdentifiers?.find((i: any) => i.type === "ISBN_13")?.identifier
  };
}
