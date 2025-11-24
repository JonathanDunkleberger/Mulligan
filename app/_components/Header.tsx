"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState } from "react";
import ProfileModal from "./ProfileModal";

export default function Header() {
  const pathname = usePathname();
  const [showProfile, setShowProfile] = useState(false);
  
  const navLinkClass = (path: string) => cn(
    "text-sm font-medium transition-colors hover:text-white",
    pathname === path ? "text-white" : "text-gray-400"
  );

  const isMyMediaSection = pathname === "/mymedia" || pathname === "/wrapped";

  return (
    <>
      <header className="flex items-center justify-between px-8 h-[60px] bg-background/50 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 text-primary hover:text-accent transition-colors">
            <Image 
              src="/cat-silhouette-on-transparent-background-free-png.webp" 
              alt="Feyris Logo" 
              width={48} 
              height={48} 
              className="object-contain brightness-0 invert"
            />
            {!isMyMediaSection && (
              <span className="text-xl font-black tracking-tight">Feyris</span>
            )}
          </Link>
          
          {isMyMediaSection ? (
            <div className="flex items-center gap-6">
              <Link 
                href="/mymedia" 
                className={cn(
                  "text-xl font-black tracking-tight transition-colors",
                  pathname === "/mymedia" ? "text-white" : "text-gray-500 hover:text-gray-300"
                )}
              >
                My Media
              </Link>
              <Link 
                href="/wrapped" 
                className={cn(
                  "text-xl font-black tracking-tight transition-colors",
                  pathname === "/wrapped" ? "text-white" : "text-gray-500 hover:text-gray-300"
                )}
              >
                Wrapped
              </Link>
            </div>
          ) : (
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/" className={navLinkClass("/")}>Home</Link>
              <Link href="/mymedia" className={navLinkClass("/mymedia")}>My Media</Link>
            </nav>
          )}
          
          {isMyMediaSection && (
             <nav className="hidden md:flex items-center gap-6 ml-4 border-l border-white/10 pl-6">
                <Link href="/" className={navLinkClass("/")}>Home</Link>
             </nav>
          )}
        </div>

        <div className="flex items-center gap-4">
          <a 
            href="https://discord.gg/wes8Euv9" 
            target="_blank" 
            rel="noreferrer" 
            className="text-xs font-medium text-gray-400 hover:text-white transition-colors"
          >
            Join Discord
          </a>
          <button 
            className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-black font-bold text-xs hover:bg-accent transition-colors"
            onClick={() => setShowProfile(true)}
          >
            JD
          </button>
        </div>
      </header>
      <ProfileModal isOpen={showProfile} onClose={() => setShowProfile(false)} />
    </>
  );
}

