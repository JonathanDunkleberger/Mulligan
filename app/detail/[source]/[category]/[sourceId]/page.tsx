import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { tmdbGetDetails, igdbGetDetails, gbooksGetDetails } from "@/app/_lib/adapters.server";
import { getUserFavorites } from "@/actions/user-data";
import FavoriteButton from "@/app/_components/FavoriteButton";
import type { MediaItem } from "@/app/_lib/schema";
import { Play, Calendar, Clock, Star, Globe, BookOpen, Gamepad2, Tv, Film } from "lucide-react";

interface PageProps {
  params: {
    source: string;
    category: string;
    sourceId: string;
  };
}

export default async function DetailPage({ params }: PageProps) {
  const { source, category, sourceId } = params;
  
  let item: MediaItem | null = null;

  // 1. Fetch Data
  try {
    if (source === "tmdb") {
      item = await tmdbGetDetails(category as any, sourceId);
    } else if (source === "igdb") {
      item = await igdbGetDetails(sourceId);
    } else if (source === "gbooks") {
      item = await gbooksGetDetails(sourceId);
    }
  } catch (e) {
    console.error("Error fetching details:", e);
  }

  if (!item) return notFound();

  // 2. Check Favorite Status
  const favorites = await getUserFavorites();
  const isFavorited = favorites.some(f => f.id === item?.id);

  // Helper for formatting dates
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "TBA";
    return new Date(dateStr).toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-20">
      {/* --- HERO SECTION --- */}
      <div className="relative w-full h-[70vh] md:h-[85vh]">
        {/* Backdrop */}
        <div className="absolute inset-0">
          {item.backdropUrl ? (
            <Image
              src={item.backdropUrl}
              alt="Backdrop"
              fill
              className="object-cover opacity-40"
              priority
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-900 to-black" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/40 to-transparent" />
        </div>

        {/* Hero Content */}
        <div className="absolute inset-0 container mx-auto px-4 flex flex-col justify-end pb-12 md:pb-20">
          <div className="flex flex-col md:flex-row gap-8 items-end">
            {/* Poster (Hidden on mobile, visible on desktop) */}
            <div className="hidden md:block w-64 aspect-[2/3] relative rounded-xl overflow-hidden shadow-2xl border border-white/10 flex-shrink-0">
              {item.imageUrl ? (
                <Image src={item.imageUrl} alt={item.title} fill className="object-cover" />
              ) : (
                <div className="w-full h-full bg-gray-800 grid place-items-center">No Image</div>
              )}
            </div>

            {/* Text Info */}
            <div className="flex-1 space-y-6">
              {/* Breadcrumbs / Badges */}
              <div className="flex flex-wrap gap-3 items-center">
                <span className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider border border-white/10">
                  {item.category}
                </span>
                {item.status && (
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                    item.status === "Ended" || item.status === "Released" ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                  }`}>
                    {item.status}
                  </span>
                )}
                {item.contentRating && (
                  <span className="px-2 py-1 border border-white/40 rounded text-xs font-mono text-gray-300">
                    {item.contentRating}
                  </span>
                )}
              </div>

              <h1 className="text-4xl md:text-6xl lg:text-7xl font-black leading-tight tracking-tight drop-shadow-xl">
                {item.title}
              </h1>

              {item.tagline && (
                <p className="text-xl md:text-2xl text-gray-300 italic font-light max-w-3xl">
                  "{item.tagline}"
                </p>
              )}

              {/* Meta Row */}
              <div className="flex flex-wrap items-center gap-6 text-sm md:text-base text-gray-300">
                {item.rating && (
                  <div className="flex items-center gap-2 text-green-400 font-bold">
                    <Star className="fill-current" size={18} />
                    <span>{Math.round(item.rating * 10)}% Match</span>
                  </div>
                )}
                {item.year && (
                  <div className="flex items-center gap-2">
                    <Calendar size={18} />
                    <span>{item.year}</span>
                  </div>
                )}
                {item.runtime && (
                  <div className="flex items-center gap-2">
                    <Clock size={18} />
                    <span>{item.runtime}</span>
                  </div>
                )}
                {item.genres.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-gray-500 rounded-full" />
                    <span>{item.genres.slice(0, 3).join(", ")}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-4 pt-4">
                <FavoriteButton item={item} initialIsFavorited={isFavorited} />
                
                {item.previewLink && (
                  <a 
                    href={item.previewLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-6 py-3 rounded-full font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                  >
                    <BookOpen size={20} />
                    Read Preview
                  </a>
                )}
                
                {item.websites?.find(w => w.category === "13") && ( // Steam
                  <a 
                    href={item.websites.find(w => w.category === "13")?.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-6 py-3 rounded-full font-bold bg-[#1b2838] hover:bg-[#2a475e] text-white transition-colors border border-white/10"
                  >
                    <Gamepad2 size={20} />
                    View on Steam
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- MAIN CONTENT GRID --- */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          
          {/* LEFT COLUMN (Details) */}
          <div className="lg:col-span-2 space-y-12">
            
            {/* Synopsis */}
            <section>
              <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <span className="w-1 h-8 bg-primary rounded-full" />
                Overview
              </h3>
              <p className="text-lg text-gray-300 leading-relaxed whitespace-pre-line">
                {item.summary || "No summary available."}
              </p>
            </section>

            {/* Cast & Crew (Scrollable) */}
            {item.cast && item.cast.length > 0 && (
              <section>
                <h3 className="text-2xl font-bold mb-6">Top Cast</h3>
                <div className="flex overflow-x-auto pb-6 gap-4 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
                  {item.cast.map((actor) => (
                    <div key={actor.id} className="flex-shrink-0 w-32 md:w-40 group">
                      <div className="aspect-[2/3] relative rounded-lg overflow-hidden bg-zinc-800 mb-3">
                        {actor.imageUrl ? (
                          <Image 
                            src={actor.imageUrl} 
                            alt={actor.name} 
                            fill 
                            className="object-cover transition-transform duration-500 group-hover:scale-110" 
                          />
                        ) : (
                          <div className="w-full h-full grid place-items-center text-zinc-600">
                            <Star size={24} />
                          </div>
                        )}
                      </div>
                      <p className="font-bold text-sm truncate">{actor.name}</p>
                      <p className="text-xs text-gray-400 truncate">{actor.character}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Seasons (Accordion Style) */}
            {item.seasons && item.seasons.length > 0 && (
              <section>
                <h3 className="text-2xl font-bold mb-6">Seasons</h3>
                <div className="space-y-4">
                  {item.seasons.map((season) => (
                    <div key={season.id} className="bg-zinc-900/50 border border-white/5 rounded-xl p-4 flex gap-4 hover:bg-zinc-900 transition-colors">
                      <div className="w-16 h-24 relative rounded bg-zinc-800 flex-shrink-0 overflow-hidden">
                        {season.poster_path ? (
                          <Image src={season.poster_path} alt={season.name} fill className="object-cover" />
                        ) : (
                          <div className="w-full h-full grid place-items-center text-xs text-gray-500">No Art</div>
                        )}
                      </div>
                      <div className="flex-1 py-1">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-bold text-lg">{season.name}</h4>
                          <span className="text-xs font-mono bg-white/10 px-2 py-1 rounded text-gray-300">
                            {season.episode_count} Eps
                          </span>
                        </div>
                        <p className="text-sm text-gray-400 mb-2">
                          {season.air_date ? `Aired ${new Date(season.air_date).getFullYear()}` : "TBA"}
                        </p>
                        <p className="text-sm text-gray-500 line-clamp-2">
                          {season.overview || "No overview available for this season."}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Videos / Trailers */}
            {item.videos && item.videos.length > 0 && (
              <section>
                <h3 className="text-2xl font-bold mb-6">Media</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {item.videos.map((video) => (
                    <a 
                      key={video.id}
                      href={`https://www.youtube.com/watch?v=${video.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative aspect-video rounded-xl overflow-hidden bg-black border border-white/10"
                    >
                      <Image 
                        src={video.thumbnail} 
                        alt={video.title} 
                        fill 
                        className="object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-xl">
                          <Play className="fill-white text-white ml-1" size={20} />
                        </div>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 to-transparent">
                        <p className="text-sm font-medium truncate">{video.title}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* RIGHT COLUMN (Sidebar Info) */}
          <div className="space-y-8">
            
            {/* Watch Providers */}
            {item.watchProviders && item.watchProviders.length > 0 && (
              <div className="bg-zinc-900/50 rounded-2xl p-6 border border-white/5">
                <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Where to Watch</h4>
                <div className="flex flex-wrap gap-3">
                  {item.watchProviders.map((provider) => (
                    <div key={provider.provider_id} className="relative w-12 h-12 rounded-lg overflow-hidden shadow-lg tooltip-trigger group">
                      {provider.logo_path ? (
                        <Image src={provider.logo_path} alt={provider.provider_name} fill className="object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gray-700" />
                      )}
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">
                        {provider.provider_name}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-4">
                  Streaming data provided by JustWatch via TMDB.
                </p>
              </div>
            )}

            {/* Information Grid */}
            <div className="bg-zinc-900/50 rounded-2xl p-6 border border-white/5 space-y-6">
              <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400">Information</h4>
              
              <div className="space-y-4">
                {item.creators && item.creators.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">
                      {item.category === "film" ? "Director" : item.category === "book" ? "Author" : "Creator/Developer"}
                    </p>
                    <p className="font-medium">{item.creators.join(", ")}</p>
                  </div>
                )}

                {item.publisher && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Publisher</p>
                    <p className="font-medium">{item.publisher}</p>
                  </div>
                )}

                {item.publisherName && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Publisher</p>
                    <p className="font-medium">{item.publisherName}</p>
                  </div>
                )}

                {item.platforms && item.platforms.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Platforms</p>
                    <div className="flex flex-wrap gap-2">
                      {item.platforms.map(p => (
                        <span key={p} className="text-xs bg-white/10 px-2 py-1 rounded">{p}</span>
                      ))}
                    </div>
                  </div>
                )}

                {item.isbn && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">ISBN</p>
                    <p className="font-mono text-sm">{item.isbn}</p>
                  </div>
                )}

                {item.pageCount && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Length</p>
                    <p className="font-medium">{item.pageCount} Pages</p>
                  </div>
                )}
              </div>
            </div>

            {/* External Links */}
            {item.websites && item.websites.length > 0 && (
              <div className="bg-zinc-900/50 rounded-2xl p-6 border border-white/5">
                <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Links</h4>
                <div className="flex flex-col gap-2">
                  {item.websites.map((w, i) => (
                    <a 
                      key={i} 
                      href={w.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <Globe size={14} />
                      <span className="truncate">{w.url}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

