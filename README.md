# Mulligan

A cross‑media discovery app that turns your favorites into fresh recommendations across film, TV, anime, games, and books.

## What it does

- Unified search across multiple sources (TMDB, IGDB via Twitch, Google Books)
- One favorites list powered by local storage (no sign‑in required)
- Personalized recommendations once you’ve added 5+ favorites
- Trending rails for quick exploration per category
- A simple “Taste Snapshot” for a lightweight sense of your preferences

## Why it exists

- Problem: People’s tastes span formats, but discovery is siloed by app and category. Crossing from “I like this anime” to “I might like these books/games” is hard.
- Hypothesis: Lightweight, cross‑category signals (genres, timeframe, popularity) are enough to unlock useful recommendations without heavy profiles or accounts.
- MVP goal: A fast, zero‑auth prototype that proves engagement beyond search by nudging users to build a favorites list and try personalized rails.

## Product decisions at a glance

- Zero‑friction onboarding: Favorites persist in localStorage; recs unlock at 5 items
- Cross‑category by design: One pane for films, TV, anime, games, and books
- Explainable-enough recs: Genre overlap and year proximity, with a bias against the most obvious popular items and a small diversity filter
- Operationally simple: Public APIs + server routes with light caching semantics

## Architecture overview

- Frontend: Next.js 14 (App Router), React 18
- API routes: Next.js Route Handlers in `app/api`
- Data adapters: `app/_lib/adapters.server.ts` fetches from TMDB, IGDB (via Twitch OAuth), and Google Books
- Recommendation logic: `app/_lib/recommender.ts` scores candidates using:
  - Genre similarity (Jaccard) with light “rarity” weights
  - Year proximity (exponential decay)
  - Small cross‑category affinity map (e.g., fantasy anime → games/books)
  - Popularity penalty (de‑emphasize the top‑trending obvious picks)
  - Diversity pass to avoid near‑duplicates/franchise repeats
- Client state: `app/_state/favorites.ts` (localStorage + pub/sub)

### Key endpoints

- `GET /api/search?q=…` → unified results (max ~45 items)
- `GET /api/popular` → trending pools per category for rails and recs
- `GET /api/details` → placeholder for future detail expansion

### Data model

```ts
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
```

## Run it locally

Prereqs

- Node.js 18+ recommended


Setup

1) Copy env vars
   - Duplicate `.env.local.example` to `.env.local`
   - Fill in keys (see “Environment” below)
2) Install deps and start the dev server

```powershell
# in project root
npm install
npm run dev
```

Then open <http://localhost:3000>

## Environment

Server-side secrets (never expose in the browser):

- TMDB_API_KEY
- TWITCH_CLIENT_ID
- TWITCH_CLIENT_SECRET
- GOOGLE_BOOKS_API_KEY

Public client config (safe to expose, but restrict in the provider consoles):

- NEXT_PUBLIC_FIREBASE_API_KEY
- NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
- NEXT_PUBLIC_FIREBASE_PROJECT_ID
- NEXT_PUBLIC_FIREBASE_APP_ID
- NEXT_PUBLIC_DISCORD_INVITE_URL

Notes

- TMDB is used server‑side only (via Route Handlers)
- IGDB requires a Twitch client credential flow (server‑side)
- Google Books supports API key restrictions; lock to domain/localhost

## UX flows to try

- Search for a few titles you love across categories and add them to Favorites
- After 5 favorites, hit “Get recommendations” to see personalized rails
- Browse Trending to quickly seed your list and compare categories
- Visit “My Media” to see a tiny taste snapshot across your collection

## Success metrics (MVP)

- Activation: % of users who add ≥5 favorites (unlock recs)
- Engagement: Save/add rate from recommended rails; CTR on rec tiles
- Breadth: # of categories touched per session after activation
- Retention proxy: Return sessions with an increased favorites count

## Roadmap (selected)

- Details pages with richer metadata and similar‑items pivots
- Account sync (optional) via Firebase Auth; cloud favorites
- Shareable profiles and recommendation bundles
- Better diversity (cluster‑aware) and multi‑objective ranking
- Rate‑limit + caching for API calls; server‑side logging for metrics
- Accessibility polish (focus states, keyboard nav, ARIA labels)

## Constraints and trade‑offs

- No user auth by default to keep onboarding frictionless
- Recommendations favor simplicity and speed over ML complexity
- Popularity penalty helps novelty, but can hide consensus favorites

## Attribution and usage

- This product uses the TMDB API but is not endorsed or certified by TMDB.
- IGDB data is accessed via Twitch’s API.
- Book data via the Google Books API.
- Logos and trademarks belong to their respective owners.

## License

Mulligan is released under the MIT License. See `LICENSE` for details.

---