"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState } from "react";
import ProfileModal from "./ProfileModal";

function CatGirlIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z" opacity="0.2"/>
      <path d="M12 6C13.5 6 14.8 6.5 15.9 7.3C16.8 6.4 18.2 6 18.2 6C18.2 6 17.8 8.5 16.5 9.5C16.8 10.3 17 11.1 17 12C17 15.3 14.8 18 12 18C9.2 18 7 15.3 7 12C7 11.1 7.2 10.3 7.5 9.5C6.2 8.5 5.8 6 5.8 6C5.8 6 7.2 6.4 8.1 7.3C9.2 6.5 10.5 6 12 6Z" />
    </svg>
  );
}

export default function Header() {
  const pathname = usePathname();
  const [showProfile, setShowProfile] = useState(false);
  
  const navLinkClass = (path: string) => cn(
    "text-sm font-medium transition-colors hover:text-white",
    pathname === path ? "text-white" : "text-gray-400"
  );

  return (
    <>
      <header className="flex items-center justify-between px-8 h-[60px] bg-black/50 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 text-purple-500 hover:text-purple-400 transition-colors">
            <CatGirlIcon />
            <span className="text-xl font-black tracking-tight">Feyris</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/" className={navLinkClass("/")}>Home</Link>
            <Link href="/mymedia" className={navLinkClass("/mymedia")}>My Media</Link>
          </nav>
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
            className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-xs hover:bg-purple-500 transition-colors"
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

