export type Category = "film" | "game" | "anime" | "tv" | "book";

export interface CastMember {
  id: string;
  name: string;
  character?: string;
  imageUrl?: string;
}

export interface Season {
  id: string;
  name: string;
  season_number: number;
  episode_count: number;
  air_date?: string;
  poster_path?: string;
  overview?: string;
}

export interface WatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path?: string;
}

export type MediaItem = {
  id: string;
  source: "tmdb" | "igdb" | "gbooks" | "supa";
  sourceId: string;
  category: Category;
  title: string;
  year?: number;
  imageUrl?: string;
  backdropUrl?: string;
  genres: string[];
  summary?: string;
  rating?: number;
  creators?: string[]; // Director, Developer, Author
  runtime?: string;    // "120m", "300p", "24 eps"
  status?: string;     // "Ended", "Ongoing"
  videos?: {
    id: string;
    title: string;
    thumbnail: string;
  }[];
  
  // Extended Details
  tagline?: string;
  cast?: CastMember[];
  seasons?: Season[];
  watchProviders?: WatchProvider[];
  contentRating?: string; // "PG-13", "TV-MA"
  
  // Game Specific
  platforms?: string[];
  developer?: string;
  publisher?: string;
  timeToBeat?: number; // Hours
  websites?: { category: string; url: string }[];
  
  // Book Specific
  pageCount?: number;
  isbn?: string;
  publisherName?: string;
  previewLink?: string;
};


