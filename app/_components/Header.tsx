"use client";

import Link from "next/link";

function DiscordIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 4a16 16 0 0 0-4-1l-.2.4A13 13 0 0 1 16 6c-1.2-.5-2.4-.8-4-.8s-2.8.3-4 .8a13 13 0 0 1 .2-2.6L8 3a16 16 0 0 0-4 1C2 7 1 10 1 13c0 0 2 3 7 3a5 5 0 0 1-3-2c.6.3 1.3.4 2 .4 1 0 2-.2 3-.6a9 9 0 0 1-5-3c.8.3 1.6.5 2.5.6a9 9 0 0 1 9 0c.9-.1 1.7-.3 2.5-.6a9 9 0 0 1-5 3c1 .4 2 .6 3 .6.8 0 1.5-.1 2-.4a5 5 0 0 1-3 2c5 0 7-3 7-3 0-3-1-6-3-9Z"/>
    </svg>
  );
}

export default function Header() {
  return (
    <>
      <div className="logo">
        <a href={process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || "#"} target="_blank" rel="noreferrer" title="Join Discord" className="badlink">
          <DiscordIcon />
        </a>
        <span className="word">Mulligan</span>
      </div>
      <nav className="nav">
        <Link href="/" className="btn">Home</Link>
        <Link href="/browse" className="btn">Browse</Link>
        <Link href="/mymedia" className="btn">My Media</Link>
      </nav>
      <div>
        <Link href="#" className="btn">Profile</Link>
      </div>
    </>
  );
}
