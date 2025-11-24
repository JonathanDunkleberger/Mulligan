import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../_lib/supabase";
import { MediaItem, Category } from "../../_lib/schema";
import { 
  tmdbGetRecommendations, 
  igdbGetSimilar, 
  gbooksGetSimilar,
  tmdbDiscover,
  igdbDiscover,
  gbooksDiscover,
  tmdbSearch,
  igdbSearch,
  gbooksSearch
} from "../../_lib/adapters.server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Keywords to filter out "meta-content" and bundles (Same as in adapters)
const EXCLUDED_BOOK_KEYWORDS = [
  "unofficial", "guide", "trivia", "facts", "notebook", 
  "boxed set", "box set", "collection", "bundle", "complete set", 
  "summary", "analysis", "study guide", "companion", "encyclopedia",
  "journal", "sketchbook", "coloring book", "poster book", "sticker book"
];

function normalizeBookTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\(.*\)/g, "") // Remove parentheticals like (2024 Edition)
    .replace(/[:\-].*$/, "") // Remove subtitles
    .trim();
}

// Helper to calculate vector mean
function calculateMeanVector(embeddings: number[][]): number[] {
  if (embeddings.length === 0) return [];
  const dim = embeddings[0].length;
  const mean = new Array(dim).fill(0);
  
  for (const vec of embeddings) {
    for (let i = 0; i < dim; i++) {
      mean[i] += vec[i];
    }
  }
  
  for (let i = 0; i < dim; i++) {
    mean[i] /= embeddings.length;
  }
  
  return mean;
}

export async function POST(req: NextRequest) {
  const userId = "guest_user_123"; 

  try {
    // 1. Fetch all user favorites with their embeddings
    const { data: favorites, error } = await supabase
      .from("favorites")
      .select(`
        created_at,
        media_items (
          id,
          title,
          description,
          type,
          embedding,
          metadata
        )
      `)
      .eq("user_id", userId)
      .order('created_at', { ascending: false });

    if (error || !favorites || favorites.length === 0) {
      // Return empty instead of 400 to prevent UI crash
      return NextResponse.json({ film: [], tv: [], anime: [], game: [], book: [] });
    }

    // Extract embeddings
    let embeddings = favorites
      .map((f: any) => f.media_items?.embedding)
      .filter((e: any) => e !== null && Array.isArray(e));

    // SELF-HEALING: If we have favorites but no embeddings, generate them now
    if (embeddings.length === 0) {
      console.log("⚠️ No embeddings found. Attempting self-healing...");
      const itemsToHeal = favorites.slice(0, 3); // Heal top 3 to get started
      
      for (const f of itemsToHeal) {
        const itemData = f.media_items;
        // Supabase might return an array for the relation
        const item = Array.isArray(itemData) ? itemData[0] : itemData;

        if (!item) continue;
        
        try {
          const embeddingResp = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: `${item.title} ${item.description || ""} ${item.type}`
          });
          const vec = embeddingResp.data[0].embedding;
          
          // Update DB
          await supabase
            .from('media_items')
            .update({ embedding: vec })
            .eq('id', item.id);
            
          embeddings.push(vec);
        } catch (err) {
          console.error("Failed to heal item:", item?.title, err);
        }
      }
    }

    if (embeddings.length === 0) {
      // Still no embeddings? Return empty.
      return NextResponse.json({ film: [], tv: [], anime: [], game: [], book: [] });
    }

    // 2. Group favorites by category for LLM analysis
    const favsByCategory: Record<Category, any[]> = { film: [], tv: [], anime: [], game: [], book: [] };
    favorites.forEach((f: any) => {
      const item = Array.isArray(f.media_items) ? f.media_items[0] : f.media_items;
      if (item && item.type) {
        favsByCategory[item.type as Category]?.push(item);
      }
    });

    // 3. Generate Recommendations via LLM + External Search
    const categories: Category[] = ["film", "tv", "anime", "game", "book"];
    const results: Record<Category, MediaItem[]> = { film: [], tv: [], anime: [], game: [], book: [] };

    // Fix: Handle potential array structure in media_items and normalize IDs
    const favoritedIds = new Set<string>();
    favorites.forEach((f: any) => {
      const item = Array.isArray(f.media_items) ? f.media_items[0] : f.media_items;
      if (item?.id) favoritedIds.add(item.id);
    });

    await Promise.all(categories.map(async (cat) => {
      const catFavs = favsByCategory[cat];
      
      // If no favorites in this category, return empty (or handle cold start elsewhere)
      if (!catFavs || catFavs.length === 0) return;

      // A. LLM Analysis: Get "Seed" titles and "Discovery" params
      // Use entire history (up to 500 items) to ensure comprehensive understanding of user taste.
      const selectedFavs = catFavs.slice(0, 500);
      const favTitles = selectedFavs.map(f => f.title).join(", ");
      
      const prompt = `
        You are an expert recommendation engine for ${cat}.
        The user has liked these titles (entire history): ${favTitles}.
        
        Task:
        1. Identify 4 specific titles that perfectly match the user's taste but are NOT in the list.
           - 2 should be "Safe Bets" (highly acclaimed or cult classics similar to their likes).
           - 2 should be "Hidden Gems" (lesser known but high quality matches).
           - IMPORTANT: Do NOT suggest titles by the same authors/creators as the user's favorites if possible. Focus on similar vibes, not just same creator.
        2. Identify 2 specific sub-genres or themes (e.g. "Cyberpunk", "Space Opera", "Cozy Mystery") that the user seems to like.
        
        Return ONLY a JSON object with this structure:
        {
          "seeds": ["Safe Bet 1", "Safe Bet 2", "Hidden Gem 1", "Hidden Gem 2"],
          "genres": ["Genre 1", "Genre 2"]
        }
      `;

      let seeds: string[] = [];
      let genres: string[] = [];

      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o", // Use smart model for reasoning
          messages: [{ role: "system", content: "You are a helpful assistant that outputs JSON." }, { role: "user", content: prompt }],
          response_format: { type: "json_object" }
        });
        const content = JSON.parse(completion.choices[0].message.content || "{}");
        seeds = content.seeds || [];
        genres = content.genres || [];
      } catch (err) {
        console.error(`LLM Error for ${cat}:`, err);
        // Fallback: Pick random favorites as seeds
        seeds = catFavs.sort(() => 0.5 - Math.random()).slice(0, 3).map(f => f.title);
      }

      // B. Execution: Search and Expand
      const promises: Promise<MediaItem[]>[] = [];

      // 1. Search for specific "Seed" titles and get their recommendations
      for (const seedTitle of seeds) {
        promises.push((async () => {
          try {
            let searchResults: MediaItem[] = [];
            if (cat === 'game') searchResults = await igdbSearch(seedTitle);
            else if (cat === 'book') searchResults = await gbooksSearch(seedTitle);
            else searchResults = await tmdbSearch(seedTitle, cat);

            // Find best match
            const bestMatch = searchResults[0]; // Top result is usually best
            if (!bestMatch) return [];

            // Return the seed itself (High Priority)
            const seedResult = [bestMatch];

            // Get recommendations based on this seed (Expansion)
            let similar: MediaItem[] = [];
            if (cat === 'game') similar = await igdbGetSimilar(bestMatch.id);
            else if (cat === 'book') similar = await gbooksGetSimilar(bestMatch.id);
            else similar = await tmdbGetRecommendations(bestMatch.id, cat);

            return [...seedResult, ...similar];
          } catch (e) {
            return [];
          }
        })());
      }

      // 2. Run "Discovery" query based on LLM genres
      if (genres.length > 0) {
        promises.push((async () => {
          try {
             if (cat === 'game') return await igdbDiscover(genres);
             if (cat === 'book') return await gbooksDiscover(genres);
             return await tmdbDiscover(cat, genres);
          } catch (e) { return []; }
        })());
      }

      const allResults = await Promise.all(promises);
      const candidates = allResults.flat();

      // C. Filter and Fill
      // Normalize favorited titles for stricter filtering
      const favoritedTitles = new Set(favorites.map((f: any) => {
        const item = Array.isArray(f.media_items) ? f.media_items[0] : f.media_items;
        return item?.title?.toLowerCase().trim();
      }));

      for (const item of candidates) {
        if (results[cat].length >= 24) break;
        
        // Strict ID check
        if (favoritedIds.has(item.id)) continue;

        // Strict Title check (fuzzy match backup)
        if (item.title && favoritedTitles.has(item.title.toLowerCase().trim())) continue;
        
        // Deduplicate within results (ID check)
        if (results[cat].some(r => r.id === item.id)) continue;

        // Deduplicate within results (Title check) - Prevents multiple editions of same book
        if (item.title && results[cat].some(r => r.title?.toLowerCase().trim() === item.title?.toLowerCase().trim())) continue;

        // Aggressive Book Filtering
        if (cat === 'book' && item.title) {
          const lowerTitle = item.title.toLowerCase();
          
          // 1. Keyword Blocklist
          if (EXCLUDED_BOOK_KEYWORDS.some(kw => lowerTitle.includes(kw))) continue;

          // 2. Normalized Title Deduplication (vs Favorites)
          const norm = normalizeBookTitle(item.title);
          const isFavDuplicate = Array.from(favoritedTitles).some(ft => normalizeBookTitle(ft) === norm);
          if (isFavDuplicate) continue;

          // 3. Normalized Title Deduplication (vs Current Results)
          const isResultDuplicate = results[cat].some(r => normalizeBookTitle(r.title || "") === norm);
          if (isResultDuplicate) continue;
        }

        results[cat].push(item);
      }
    }));

    return NextResponse.json(results);

  } catch (e) {
    console.error("Recs API Error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
