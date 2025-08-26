# Mulligan

Cross‑media discovery for films, TV, anime, games, and books. Add favorites and get lightweight, personalized recommendations.

## 🧩 Features

- Unified search across TMDB, IGDB (via Twitch), and Google Books
- One favorites list (localStorage; no sign‑in required)
- Recommendations unlock after 5+ favorites
- Trending rails by category
- “My Media” with a quick taste snapshot

## 🚀 Quick start

Prereqs

- Node.js 18+ recommended

Setup

1) Copy env vars
   - Duplicate `.env.local.example` to `.env.local`
   - Fill in keys (see Environment)
2) Install and run

```powershell
# in project root
npm install
npm run dev
```

Open <http://localhost:3000>

## ⚙️ Environment

Server‑side (keep secret):

- TMDB_API_KEY
- TWITCH_CLIENT_ID
- TWITCH_CLIENT_SECRET
- GOOGLE_BOOKS_API_KEY

Client (public):

- NEXT_PUBLIC_FIREBASE_API_KEY
- NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
- NEXT_PUBLIC_FIREBASE_PROJECT_ID
- NEXT_PUBLIC_FIREBASE_APP_ID
- NEXT_PUBLIC_DISCORD_INVITE_URL

Notes

- TMDB is used server‑side via Route Handlers
- IGDB uses Twitch client credentials (server‑side)
- Google Books keys can be domain/localhost restricted

## 🧰 Tech stack

- Next.js 14 (App Router), React 18
- TypeScript
- Next.js Route Handlers for APIs (`app/api`)
- Firebase client optional config (no auth required for MVP)

## 🗺️ Architecture

- Adapters: `app/_lib/adapters.server.ts` (TMDB, IGDB, Google Books)
- Recommender: `app/_lib/recommender.ts` (genre similarity, year proximity, small cross‑category boosts, diversity, light popularity penalty)
- Client state: `app/_state/favorites.ts` (localStorage + pub/sub)

## 🔌 API endpoints

- `GET /api/search?q=…` → unified results (~45 max)
- `GET /api/popular` → trending pools per category
- `GET /api/details` → placeholder for future detail expansion

## 🧪 Data model

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

## 🧭 Try it

- Search and add a few favorites
- Click “Get recommendations” after you reach 5
- Explore Trending rails and compare categories
- Check “My Media” for a quick taste snapshot

## 🗓️ Roadmap (short)

- Details pages with richer metadata
- Optional account sync (Firebase Auth) and cloud favorites
- Shareable profiles and recommendation bundles
- Stronger diversity and ranking tuning
- Caching/rate‑limit and basic metrics
- Accessibility polish

## 🔒 Attribution

- Uses the TMDB API but is not endorsed or certified by TMDB
- IGDB data via Twitch API
- Books via Google Books API
- Logos and trademarks belong to their owners

## 📝 License

MIT — see `LICENSE`.
