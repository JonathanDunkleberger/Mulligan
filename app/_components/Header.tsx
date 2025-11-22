"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState } from "react";
import ProfileModal from "./ProfileModal";

function DiscordIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 4a16 16 0 0 0-4-1l-.2.4A13 13 0 0 1 16 6c-1.2-.5-2.4-.8-4-.8s-2.8.3-4 .8a13 13 0 0 1 .2-2.6L8 3a16 16 0 0 0-4 1C2 7 1 10 1 13c0 0 2 3 7 3a5 5 0 0 1-3-2c.6.3 1.3.4 2 .4 1 0 2-.2 3-.6a9 9 0 0 1-5-3c.8.3 1.6.5 2.5.6a9 9 0 0 1 9 0c.9-.1 1.7-.3 2.5-.6a9 9 0 0 1-5 3c1 .4 2 .6 3 .6.8 0 1.5-.1 2-.4a5 5 0 0 1-3 2c5 0 7-3 7-3 0-3-1-6-3-9Z"/>
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
            <DiscordIcon />
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

