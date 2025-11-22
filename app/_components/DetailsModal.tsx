// app/_components/DetailsModal.tsx

"use client";

import { MediaItem } from "../_lib/schema";
import { FavoritesStore } from "../_state/favorites";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

import { Play } from "lucide-react";

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
}: {
  item: MediaItem;
  onClose: () => void;
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
      <DialogContent className="sm:max-w-4xl w-full h-[85vh] p-0 overflow-hidden bg-background text-white border-border flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="relative h-[50vh] w-full shrink-0">
            {(item.backdropUrl || item.imageUrl) && (
              <Image
                src={item.backdropUrl || item.imageUrl!}
                alt={item.title}
                fill
                className="object-cover opacity-60"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
            <div className="absolute bottom-0 left-0 p-8 w-full">
              <motion.h1 
                className="text-5xl font-extrabold tracking-tight mb-4 text-white drop-shadow-lg"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {item.title}
              </motion.h1>
              <motion.div 
                className="flex flex-wrap gap-3 items-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Pill>{item.category.toUpperCase()}</Pill>
                {item.year && <span className="text-gray-300 font-medium">{item.year}</span>}
                {item.rating != null && <span className="text-green-400 font-bold">{(item.rating * 10).toFixed(0)}% Match</span>}
                {item.runtime && <span className="text-gray-300">{item.runtime}</span>}
                {item.status && <span className="text-gray-400 text-sm">({item.status})</span>}
              </motion.div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 p-8 pt-4">
            <div className="md:col-span-2 space-y-6">
              <div className="flex gap-4">
                 <Button size="lg" className="bg-white text-black hover:bg-gray-200 font-bold px-8" onClick={() => FavoritesStore.add(item)}>
                  + My List
                </Button>
                {/* Placeholder for "Play" or "Buy" links if we had them */}
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">Overview</h3>
                <p className="text-gray-300 leading-relaxed text-lg">
                  {item.summary || "No summary available."}
                </p>
              </div>
            </div>

            <div className="space-y-6 text-sm text-gray-400">
              <div>
                <span className="block text-gray-500 mb-1">Genres</span>
                <div className="flex flex-wrap gap-2">
                  {item.genres?.map(g => <span key={g} className="text-white hover:underline cursor-pointer">{g}</span>)}
                </div>
              </div>

              {item.creators && item.creators.length > 0 && (
                <div>
                  <span className="block text-gray-500 mb-1">Creatives</span>
                  <div className="flex flex-wrap gap-2">
                    {item.creators.map(c => <span key={c} className="text-white">{c}</span>)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Videos Section */}
          {item.videos && item.videos.length > 0 && (
            <div className="p-8 pt-0">
              <h3 className="text-xl font-bold mb-4">Videos</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                    <p className="text-sm font-medium line-clamp-2 text-gray-300 group-hover:text-white transition-colors">
                      {video.title}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
