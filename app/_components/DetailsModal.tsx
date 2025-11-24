// app/_components/DetailsModal.tsx

"use client";

import { MediaItem } from "../_lib/schema";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

import { Play, Heart, Star, Calendar, Clock, Globe, BookOpen, Gamepad2 } from "lucide-react";

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-secondary text-secondary-foreground text-xs font-semibold px-3 py-1 rounded-full">
      {children}
    </span>
  );
}

export default function DetailsModal({
  item: initialItem,
  onClose,
  isFavorited,
  onToggleFavorite
}: {
  item: MediaItem;
  onClose: () => void;
  isFavorited?: boolean;
  onToggleFavorite?: (item: MediaItem) => void;
}) {
  const [item, setItem] = useState<MediaItem>(initialItem);
  const [loading, setLoading] = useState(true);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    // Fetch full details
    fetch(`/api/details?source=${initialItem.source}&sourceId=${initialItem.sourceId}&category=${initialItem.category}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (active && data) {
          setItem(data);
        }
        if (active) setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [initialItem]);

  return (
  <Dialog open onOpenChange={(isOpen: boolean) => { if (!isOpen) onClose(); }}>
      <DialogContent className="sm:max-w-5xl w-full h-[90vh] p-0 overflow-hidden bg-[#0a0a0a] text-white border-white/10 flex flex-col">
        <DialogTitle className="sr-only">{item.title}</DialogTitle>
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {/* Hero Section */}
          <div className="relative h-[50vh] w-full shrink-0">
            {(item.imageUrl || item.backdropUrl) && (
              <Image
                src={item.backdropUrl || item.imageUrl!}
                alt={item.title}
                fill
                className="object-cover opacity-60"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/60 to-transparent" />
            <div className="absolute bottom-0 left-0 p-8 w-full">
              <motion.h1 
                className="text-4xl md:text-6xl font-black tracking-tight mb-4 text-white drop-shadow-xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {item.title}
              </motion.h1>
              <motion.div 
                className="flex flex-wrap gap-4 items-center text-sm md:text-base"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <span className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider border border-white/10">
                  {item.category}
                </span>
                {item.year && (
                  <div className="flex items-center gap-2 text-gray-300">
                    <Calendar size={16} />
                    <span>{item.year}</span>
                  </div>
                )}
                {item.rating != null && (
                  <div className="flex items-center gap-2 text-green-400 font-bold">
                    <Star className="fill-current" size={16} />
                    <span>{Math.round(item.rating * 10)}% Match</span>
                  </div>
                )}
                {item.runtime && (
                  <div className="flex items-center gap-2 text-gray-300">
                    <Clock size={16} />
                    <span>{item.runtime}</span>
                  </div>
                )}
              </motion.div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 p-8">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-8">
              <div className="flex flex-wrap gap-4">
                 <Button 
                  size="lg" 
                  className={`font-bold px-8 flex items-center gap-2 ${isFavorited ? "bg-red-600 hover:bg-red-700 text-white" : "bg-white text-black hover:bg-gray-200"}`}
                  onClick={() => onToggleFavorite?.(item)}
                >
                  <Heart className={isFavorited ? "fill-white" : ""} size={20} />
                  {isFavorited ? "Saved" : "My List"}
                </Button>
                
                {item.previewLink && (
                  <a 
                    href={item.previewLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-6 py-2 rounded-md font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                  >
                    <BookOpen size={20} />
                    Read Preview
                  </a>
                )}
                
                {item.websites?.find(w => w.category === "13") && (
                  <a 
                    href={item.websites.find(w => w.category === "13")?.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-6 py-2 rounded-md font-bold bg-[#1b2838] hover:bg-[#2a475e] text-white transition-colors border border-white/10"
                  >
                    <Gamepad2 size={20} />
                    View on Steam
                  </a>
                )}
              </div>

              <div>
                <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
                  <span className="w-1 h-6 bg-primary rounded-full" />
                  Overview
                </h3>
                <p className="text-gray-300 leading-relaxed text-lg whitespace-pre-line">
                  {item.summary || "No summary available."}
                </p>
              </div>

              {/* Cast */}
              {item.cast && item.cast.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold mb-4">Top Cast</h3>
                  <div className="flex overflow-x-auto pb-4 gap-4 scrollbar-hide -mx-2 px-2">
                    {item.cast.map((actor) => (
                      <div key={actor.id} className="flex-shrink-0 w-28 group">
                        <div className="aspect-[2/3] relative rounded-lg overflow-hidden bg-zinc-800 mb-2">
                          {actor.imageUrl ? (
                            <Image 
                              src={actor.imageUrl} 
                              alt={actor.name} 
                              fill 
                              className="object-cover transition-transform duration-500 group-hover:scale-110" 
                            />
                          ) : (
                            <div className="w-full h-full grid place-items-center text-zinc-600">
                              <Star size={20} />
                            </div>
                          )}
                        </div>
                        <p className="font-bold text-xs truncate">{actor.name}</p>
                        <p className="text-[10px] text-gray-400 truncate">{actor.character}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Seasons */}
              {item.seasons && item.seasons.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold mb-4">Seasons</h3>
                  <div className="space-y-3">
                    {item.seasons.map((season) => (
                      <div key={season.id} className="bg-zinc-900/50 border border-white/5 rounded-lg p-3 flex gap-4 hover:bg-zinc-900 transition-colors">
                        <div className="w-12 h-16 relative rounded bg-zinc-800 flex-shrink-0 overflow-hidden">
                          {season.poster_path ? (
                            <Image src={season.poster_path} alt={season.name} fill className="object-cover" />
                          ) : (
                            <div className="w-full h-full grid place-items-center text-[10px] text-gray-500">No Art</div>
                          )}
                        </div>
                        <div className="flex-1 py-1">
                          <div className="flex justify-between items-start mb-1">
                            <h4 className="font-bold text-base">{season.name}</h4>
                            <span className="text-[10px] font-mono bg-white/10 px-2 py-0.5 rounded text-gray-300">
                              {season.episode_count} Eps
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 line-clamp-2">
                            {season.overview || "No overview available."}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Videos */}
              {item.videos && item.videos.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold mb-4">Media</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {item.videos.map((video) => (
                      <div key={video.id} className="space-y-2">
                        <div 
                          className="aspect-video relative rounded-md overflow-hidden bg-black/50 cursor-pointer group border border-white/10 hover:border-white/30 transition-colors"
                          onClick={() => setPlayingVideo(video.id)}
                        >
                          {playingVideo === video.id ? (
                            <iframe 
                              src={`https://www.youtube.com/embed/${video.id}?autoplay=1`} 
                              title={video.title}
                              className="w-full h-full"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                              allowFullScreen
                            />
                          ) : (
                            <>
                              <Image 
                                src={video.thumbnail} 
                                alt={video.title} 
                                fill 
                                className="object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                              />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform">
                                  <Play className="fill-white text-white ml-1" size={20} />
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                        <p className="text-xs font-medium line-clamp-1 text-gray-300 group-hover:text-white transition-colors">
                          {video.title}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column (Sidebar) */}
            <div className="space-y-6">
              
              {/* Watch Providers */}
              {item.watchProviders && item.watchProviders.length > 0 && (
                <div className="bg-zinc-900/50 rounded-xl p-5 border border-white/5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Where to Watch</h4>
                  <div className="flex flex-wrap gap-2">
                    {item.watchProviders.map((provider) => (
                      <div key={provider.provider_id} className="relative w-10 h-10 rounded-md overflow-hidden shadow-lg tooltip-trigger group">
                        {provider.logo_path ? (
                          <Image src={provider.logo_path} alt={provider.provider_name} fill className="object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gray-700" />
                        )}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-[10px] rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">
                          {provider.provider_name}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ratings */}
              {(item.imdbRating || item.rottenTomatoesRating || item.metacriticRating || item.malScore) && (
                <div className="bg-zinc-900/50 rounded-xl p-5 border border-white/5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Ratings</h4>
                  <div className="space-y-2">
                    {item.imdbRating && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-300">IMDb</span>
                        <span className="font-bold text-yellow-400">{item.imdbRating}</span>
                      </div>
                    )}
                    {item.rottenTomatoesRating && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-300">Rotten Tomatoes</span>
                        <span className="font-bold text-red-400">{item.rottenTomatoesRating}</span>
                      </div>
                    )}
                    {item.metacriticRating && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-300">Metacritic</span>
                        <span className="font-bold text-green-400">{item.metacriticRating}</span>
                      </div>
                    )}
                    {item.malScore && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-300">MyAnimeList</span>
                        <span className="font-bold text-blue-400">{item.malScore}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Info Grid */}
              <div className="bg-zinc-900/50 rounded-xl p-5 border border-white/5 space-y-4 text-sm">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Information</h4>
                
                <div>
                  <span className="block text-gray-500 mb-1">Genres</span>
                  <div className="flex flex-wrap gap-2">
                    {item.genres?.map(g => <span key={g} className="text-white bg-white/10 px-2 py-0.5 rounded text-xs">{g}</span>)}
                  </div>
                </div>

                {item.creators && item.creators.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">
                      {item.category === "film" ? "Director" : item.category === "book" ? "Author" : "Creator"}
                    </p>
                    <p className="font-medium text-white">{item.creators.join(", ")}</p>
                  </div>
                )}

                {item.platforms && item.platforms.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Platforms</p>
                    <div className="flex flex-wrap gap-1">
                      {item.platforms.map(p => (
                        <span key={p} className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-gray-300">{p}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* External Links */}
              {item.websites && item.websites.length > 0 && (
                <div className="bg-zinc-900/50 rounded-xl p-5 border border-white/5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Links</h4>
                  <div className="flex flex-col gap-2">
                    {item.websites.map((w, i) => (
                      <a 
                        key={i} 
                        href={w.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        <Globe size={12} />
                        <span className="truncate">{w.url}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

