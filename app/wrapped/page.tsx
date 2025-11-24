"use client";

import { useEffect, useState } from "react";
import { getUserFavorites } from "@/actions/user-data";
import type { MediaItem } from "../_lib/schema";

export default function WrappedPage() {
  const [favorites, setFavorites] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const items = await getUserFavorites();
        setFavorites(items);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="container mx-auto px-4 py-8 text-gray-500">Loading your wrapped...</div>;

  // Calculate Stats
  const totalItems = favorites.length;
  const genres: Record<string, number> = {};
  const types: Record<string, number> = {};
  
  favorites.forEach(f => {
    // Count Types
    types[f.category] = (types[f.category] || 0) + 1;
    
    // Count Genres
    f.genres?.forEach(g => {
      genres[g] = (genres[g] || 0) + 1;
    });
  });

  const topGenres = Object.entries(genres)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {/* Hero Stats */}
        <div className="bg-gradient-to-br from-purple-900/50 to-blue-900/50 p-8 rounded-2xl border border-white/10 flex flex-col justify-center items-center text-center">
          <h2 className="text-lg text-gray-300 mb-2">Total Collected</h2>
          <p className="text-6xl font-black text-white">{totalItems}</p>
          <p className="text-sm text-gray-400 mt-2">Across all universes</p>
        </div>

        <div className="bg-gradient-to-br from-pink-900/50 to-red-900/50 p-8 rounded-2xl border border-white/10 flex flex-col justify-center items-center text-center">
          <h2 className="text-lg text-gray-300 mb-2">Top Vibe</h2>
          <p className="text-4xl font-black text-white">{topGenres[0]?.[0] || "N/A"}</p>
          <p className="text-sm text-gray-400 mt-2">{topGenres[0]?.[1] || 0} items matched</p>
        </div>

        <div className="bg-gradient-to-br from-green-900/50 to-emerald-900/50 p-8 rounded-2xl border border-white/10 flex flex-col justify-center items-center text-center">
          <h2 className="text-lg text-gray-300 mb-2">Favorite Format</h2>
          <p className="text-4xl font-black text-white capitalize">
            {Object.entries(types).sort(([,a], [,b]) => b - a)[0]?.[0] || "N/A"}
          </p>
        </div>
      </div>

      {/* Genre Breakdown */}
      <div className="bg-white/5 rounded-2xl p-8 border border-white/10">
        <h3 className="text-2xl font-bold mb-6">Genre DNA</h3>
        <div className="space-y-4">
          {topGenres.map(([genre, count]) => (
            <div key={genre} className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{genre}</span>
                <span className="text-gray-400">{count}</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary" 
                  style={{ width: `${(count / totalItems) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
