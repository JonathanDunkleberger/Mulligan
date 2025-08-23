# create_shell.ps1
$ErrorActionPreference = "Stop"

$dirs = @(
  "app/_components",
  "app/_lib",
  "app/_state",
  "app/api/search",
  "app/api/details",
  "app/api/popular",
  "app/browse",
  "app/detail/[source]/[category]/[sourceId]",
  "app/mymedia",
  "public"
)
foreach ($d in $dirs) { New-Item -ItemType Directory -Force -Path $d | Out-Null }

$files = @(
  "package.json",
  "tsconfig.json",
  "next.config.js",
  ".env.local",
  "app/globals.css",
  "app/layout.tsx",
  "app/page.tsx",
  "app/browse/page.tsx",
  "app/mymedia/page.tsx",
  "app/detail/[source]/[category]/[sourceId]/page.tsx",
  "app/_components/Header.tsx",
  "app/_components/MediaCarousel.tsx",
  "app/_components/MediaTile.tsx",
  "app/_components/FavoritesBar.tsx",
  "app/_lib/schema.ts",
  "app/_lib/env.ts",
  "app/_lib/firebase.client.ts",
  "app/_lib/debounce.ts",
  "app/_lib/recommender.ts",
  "app/_lib/format.ts",
  "app/_lib/adapters.server.ts",
  "app/_state/favorites.ts",
  "app/api/search/route.ts",
  "app/api/details/route.ts",
  "app/api/popular/route.ts"
)
foreach ($f in $files) { New-Item -ItemType File -Force -Path $f | Out-Null }

"Shell created. Paste code next." | Write-Host
