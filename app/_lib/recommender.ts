import { Category, MediaItem } from "./schema";

/** ---------- Helpers ---------- **/

function normTitle(t: string) {
  return t.toLowerCase().replace(/[:!'’\-–,.\(\)\[\]]/g, "").trim();
}
function jaccard(a: string[], b: string[]) {
  const A = new Set(a.map((x) => x.toLowerCase()));
  const B = new Set(b.map((x) => x.toLowerCase()));
  if (!A.size && !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}
function expDecay(dist: number, halfLife: number) {
  // Half-life in years; distance 0 => 1, distance = halfLife => 0.5
  return Math.pow(0.5, Math.max(0, dist) / Math.max(1, halfLife));
}

/** Genre “weights” so rare tastes count more (very light TF-IDF flavor) */
function genreWeights(favorites: MediaItem[]) {
  const counts: Record<string, number> = {};
  for (const f of favorites) for (const g of f.genres || []) counts[g] = (counts[g] || 0) + 1;
  const weights: Record<string, number> = {};
  const max = Math.max(1, ...Object.values(counts));
  for (const [g, c] of Object.entries(counts)) {
    // rarer genres => higher weight; cap between 0.6 and 1.6
    const w = 1 + (1 - c / max);
    weights[g] = Math.min(1.6, Math.max(0.6, w));
  }
  return weights;
}

/** Cross-category “affinity” boosts (very light-hand, adjustable later) */
const CROSS: Partial<Record<Category, Record<string, Partial<Record<Category, number>>>>> = {
  anime: {
    "action": { game: 0.15, film: 0.1 },
    "fantasy": { game: 0.2, book: 0.15 },
    "sci-fi": { game: 0.15, film: 0.1 },
  },
  game: {
    "action": { film: 0.1, anime: 0.1 },
    "rpg":    { book: 0.15, anime: 0.1 },
    "adventure": { film: 0.1, book: 0.1 }
  },
  film: {
    "sci-fi": { book: 0.1, game: 0.1 },
    "fantasy": { book: 0.15, game: 0.1 }
  },
  tv: {
    "crime": { book: 0.1 },
    "fantasy": { book: 0.1, game: 0.1 }
  },
  book: {
    "fantasy": { game: 0.2, anime: 0.1 },
    "sci-fi":  { game: 0.15, film: 0.1 }
  }
};

/** ---------- Scoring ---------- **/
function scoreItem(
  item: MediaItem,
  favorites: MediaItem[],
  rankInPopular: number,
  gw: Record<string, number>
): number {
  // Base: genre similarity weighted by user taste emphasis
  const gSimRaw = favorites.reduce((acc, f) => {
    const sim = jaccard(item.genres || [], f.genres || []);
    // weight each shared genre by rarity emphasis
    let boost = 0;
    for (const g of (item.genres || [])) if ((f.genres || []).includes(g)) boost += (gw[g] || 1) * 0.35;
    return acc + sim + boost;
  }, 0) / Math.max(1, favorites.length);

  // Year proximity (half-life 6 years)
  const yearBoost = (() => {
    if (!item.year) return 0;
    let sum = 0, seen = 0;
    for (const f of favorites) if (f.year) { sum += expDecay(Math.abs(item.year - f.year), 6); seen++; }
    return seen ? sum / seen : 0;
  })();

  // Cross-category affinity – small additive bump if genres imply a cross hop that matches user taste
  let cross = 0;
  for (const f of favorites) {
    const affin = CROSS[f.category] || {};
    for (const g of f.genres || []) {
      const map = affin[g.toLowerCase()];
      if (map && map[item.category]) cross += map[item.category]!;
    }
  }
  cross = cross / Math.max(1, favorites.length) * 0.6;

  // Popularity penalty – push away from the top obvious items
  const popularityPenalty = Math.max(0, 0.6 - 0.02 * rankInPopular); // strong for rank 0–10

  // Final score
  return gSimRaw * 2.2 + yearBoost * 1.1 + cross - popularityPenalty;
}

/** ---------- Public API ---------- **/
export function recommendForAllCategories(
  favorites: MediaItem[],
  pools: Record<Category, MediaItem[]>,
  blacklist: MediaItem[] = [],
  n = 12
): Record<Category, MediaItem[]> {
  const favIds = new Set(favorites.map(f => f.id));
  const favTitles = new Set(favorites.map(f => normTitle(f.title)));
  const blacklistIds = new Set(blacklist.map(b => b.id));
  const blacklistTitles = new Set(blacklist.map(b => normTitle(b.title)));
  
  const weights = genreWeights(favorites);

  const out: Record<Category, MediaItem[]> = { film: [], game: [], anime: [], tv: [], book: [] };

  (Object.keys(pools) as Category[]).forEach((cat) => {
    const pool = pools[cat] || [];

    // Filter out blacklist items (trending) and favorites
    const candidates = pool.filter(item => 
      !blacklistIds.has(item.id) && 
      !blacklistTitles.has(normTitle(item.title)) &&
      !favIds.has(item.id) && 
      !favTitles.has(normTitle(item.title))
    );

    // Score
    const scored = candidates
      .map((item, i) => ({
        item,
        score: scoreItem(item, favorites, i, weights) // Rank i is relative to this filtered pool now
      }));

    // Diversity: greedy pick avoiding same normalized title prefix
    const seenFranchise = new Set<string>();
    const pick: MediaItem[] = [];
    
    // Sort by score descending
    scored.sort((a,b) => b.score - a.score);

    for (const { item } of scored) {
      const key = normTitle(item.title).split(" ")[0]; // coarse franchise key
      if (seenFranchise.has(key)) continue;
      pick.push(item);
      seenFranchise.add(key);
      if (pick.length >= n) break;
    }

    // If we didn’t reach n, fill from the original pool (including blacklist if absolutely necessary, but prefer not to)
    // Let's just fill from the remaining scored candidates first
    if (pick.length < n) {
      for (const { item } of scored) {
        if (pick.find(p => p.id === item.id)) continue;
        pick.push(item);
        if (pick.length >= n) break;
      }
    }
    
    // If still not enough, we might have been too aggressive with the blacklist. 
    // But the user wants "90% different", so returning fewer items is better than returning trending ones.
    // We will leave it as is.

    out[cat] = pick;
  });

  return out;
}
