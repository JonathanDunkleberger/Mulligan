"use client";

import { useEffect, useState } from "react";
import { getUserFavorites } from "@/actions/user-data";
import type { MediaItem } from "../_lib/schema";

import Link from "next/link";
import { generateWrappedInsights, type WrappedInsights } from "@/actions/wrapped";

export default function WrappedPage() {
  const [favorites, setFavorites] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<WrappedInsights | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const items = await getUserFavorites();
        setFavorites(items);
        
        // Generate insights in parallel or after? 
        // Let's do it after to ensure we have data
        if (items.length >= 3) {
          const data = await generateWrappedInsights(items);
          setInsights(data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return (
    <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[50vh]">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-400 animate-pulse">Analyzing your multiverse DNA...</p>
      </div>
    </div>
  );

  // Calculate Stats
  const totalItems = favorites.length;
  const genres: Record<string, number> = {};
  const types: Record<string, number> = {};
  
  favorites.forEach(f => {
    types[f.category] = (types[f.category] || 0) + 1;
    f.genres?.forEach(g => {
      genres[g] = (genres[g] || 0) + 1;
    });
  });

  const topGenres = Object.entries(genres)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);

  // Chart Data Calculation
  const typeEntries = Object.entries(types).sort(([,a], [,b]) => b - a);
  const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"];
  let cumulativePercent = 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-6 mb-8 ml-10">
        <Link href="/mymedia" className="text-3xl font-bold text-gray-500 hover:text-white transition-colors">My Media</Link>
        <h1 className="text-3xl font-bold text-white">Wrapped</h1>
      </div>

      {/* AI Insights Hero */}
      {insights && (
        <div className="mb-12 space-y-6">
          <div className="bg-zinc-900 p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="relative z-10 flex-1">
              <p className="text-gray-400 font-medium tracking-widest text-sm uppercase mb-2">Your Media Aura</p>
              <h2 className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight">
                {insights.vibe}
              </h2>
              <p className="text-xl text-gray-200 max-w-3xl leading-relaxed">
                {insights.summary}
              </p>
            </div>

            {/* Donut Chart */}
            <div className="relative w-64 h-64 flex-shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                {typeEntries.map(([label, count], i) => {
                  const percent = count / totalItems;
                  const dashArray = `${percent * 100} ${100 - percent * 100}`;
                  const dashOffset = -cumulativePercent * 100;
                  cumulativePercent += percent;
                  
                  return (
                    <circle
                      key={label}
                      cx="50"
                      cy="50"
                      r="15.9155"
                      fill="transparent"
                      stroke={CHART_COLORS[i % CHART_COLORS.length]}
                      strokeWidth="8"
                      strokeDasharray={dashArray}
                      strokeDashoffset={dashOffset}
                      className="transition-all duration-500 hover:opacity-80"
                    />
                  );
                })}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-black text-white">{totalItems}</span>
                <span className="text-xs text-gray-400 uppercase tracking-wider">Items</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Master Rec Card */}
            <div className="bg-white/5 p-8 rounded-3xl border border-white/10 hover:border-primary/50 transition-colors group">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-gray-400 font-medium uppercase tracking-wider text-sm">The Master Recommendation</h3>
                <span className="bg-primary/20 text-primary text-xs px-3 py-1 rounded-full">99% Match</span>
              </div>
              <div className="text-3xl font-bold text-white mb-3 group-hover:text-primary transition-colors">
                {insights.masterRec.title}
              </div>
              <p className="text-gray-300 leading-relaxed">
                {insights.masterRec.reason}
              </p>
            </div>

            {/* Fun Fact & Era */}
            <div className="space-y-6">
              <div className="bg-emerald-900/20 p-6 rounded-3xl border border-emerald-500/20">
                <h3 className="text-emerald-400 font-medium uppercase tracking-wider text-sm mb-2">Did You Know?</h3>
                <p className="text-lg text-emerald-100 font-medium">
                  {insights.funFact}
                </p>
              </div>
              
              <div className="bg-amber-900/20 p-6 rounded-3xl border border-amber-500/20 flex items-center justify-between">
                <div>
                  <h3 className="text-amber-400 font-medium uppercase tracking-wider text-sm mb-1">Golden Era</h3>
                  <p className="text-2xl text-amber-100 font-bold">{insights.topEra}</p>
                </div>
                <div className="text-4xl opacity-50">⏳</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {/* Hero Stats */}
        <div className="bg-white/5 p-8 rounded-2xl border border-white/10 flex flex-col justify-center items-center text-center">
          <h2 className="text-lg text-gray-300 mb-2">Total Collected</h2>
          <p className="text-6xl font-black text-white">{totalItems}</p>
          <p className="text-sm text-gray-400 mt-2">Across all universes</p>
        </div>

        <div className="bg-white/5 p-8 rounded-2xl border border-white/10 flex flex-col justify-center items-center text-center">
          <h2 className="text-lg text-gray-300 mb-2">Top Vibe</h2>
          <p className="text-4xl font-black text-white">{topGenres[0]?.[0] || "N/A"}</p>
          <p className="text-sm text-gray-400 mt-2">{topGenres[0]?.[1] || 0} items matched</p>
        </div>

        <div className="bg-white/5 p-8 rounded-2xl border border-white/10 flex flex-col justify-center items-center text-center">
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
