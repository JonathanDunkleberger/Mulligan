export type Category = "film" | "game" | "anime" | "tv" | "book";

export type MediaItem = {
  id: string;
  source: "tmdb" | "igdb" | "gbooks";
  sourceId: string;
  category: Category;
  title: string;
  year?: number;
  imageUrl?: string;
  genres: string[];
};
