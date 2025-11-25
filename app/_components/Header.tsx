"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState } from "react";
import ProfileModal from "./ProfileModal";
import { Menu, X } from "lucide-react";

export default function Header() {
  const pathname = usePathname();
  const [showProfile, setShowProfile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const navLinkClass = (path: string) => cn(
    "text-sm font-medium transition-colors hover:text-white",
    pathname === path ? "text-white" : "text-gray-400"
  );

  return (
    <>
      <header className="flex items-center justify-between px-4 md:px-8 h-[60px] bg-background/50 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="flex items-center gap-4 md:gap-8">
          <Link href="/" className="flex items-center gap-2 text-primary hover:text-accent transition-colors">
            <Image 
              src="/cat-silhouette-on-transparent-background-free-png.webp" 
              alt="Feyris Logo" 
              width={48} 
              height={48} 
              className="object-contain brightness-0 invert"
            />
            <span className="text-xl font-black tracking-tight hidden sm:inline">Feyris</span>
          </Link>
          
          {/* Desktop Nav */}
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
            className="hidden md:block text-xs font-medium text-gray-400 hover:text-white transition-colors"
          >
            Join Discord
          </a>
          <button 
            className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-black font-bold text-xs hover:bg-accent transition-colors"
            onClick={() => setShowProfile(true)}
          >
            JD
          </button>
          
          {/* Mobile Menu Toggle */}
          <button 
            className="md:hidden text-gray-400 hover:text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      {/* Mobile Nav Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-[60px] left-0 w-full bg-zinc-950 border-b border-white/10 p-4 flex flex-col gap-4 z-40 shadow-2xl">
          <Link 
            href="/" 
            className={cn("text-lg font-medium p-2 rounded-md hover:bg-white/5", pathname === "/" ? "text-white" : "text-gray-400")}
            onClick={() => setMobileMenuOpen(false)}
          >
            Home
          </Link>
          <Link 
            href="/mymedia" 
            className={cn("text-lg font-medium p-2 rounded-md hover:bg-white/5", pathname === "/mymedia" ? "text-white" : "text-gray-400")}
            onClick={() => setMobileMenuOpen(false)}
          >
            My Media
          </Link>
          <a 
            href="https://discord.gg/wes8Euv9" 
            target="_blank" 
            rel="noreferrer" 
            className="text-lg font-medium text-gray-400 p-2 rounded-md hover:bg-white/5"
            onClick={() => setMobileMenuOpen(false)}
          >
            Join Discord
          </a>
        </div>
      )}

      <ProfileModal isOpen={showProfile} onClose={() => setShowProfile(false)} />
    </>
  );
}

