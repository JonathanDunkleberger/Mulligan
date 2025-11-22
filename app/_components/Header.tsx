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

  return (
    <>
      <header className="flex items-center justify-between px-8 h-[60px] bg-black/50 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 text-purple-500 hover:text-purple-400 transition-colors">
            <Image 
              src="/Signal to Noise.png" 
              alt="Feyris Logo" 
              width={32} 
              height={32} 
              className="object-contain brightness-0 invert"
            />
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

