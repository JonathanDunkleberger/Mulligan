export type Category = "film" | "game" | "anime" | "tv" | "book";

export type MediaItem = {
  id: string;
  source: "tmdb" | "igdb" | "gbooks";
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
};

