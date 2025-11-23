"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

export default function Header() {
  const pathname = usePathname();
  
  const navLinkClass = (path: string) => cn(
    "text-sm font-medium transition-colors hover:text-white",
    pathname === path ? "text-white" : "text-gray-400"
  );

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
          <SignedOut>
            <SignInButton mode="modal">
              <button className="text-sm font-medium text-white bg-primary px-4 py-2 rounded-md hover:bg-accent transition-colors">
                Sign In
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </div>
      </header>
    </>
  );
}

