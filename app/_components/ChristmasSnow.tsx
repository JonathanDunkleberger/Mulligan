"use client";

import { useEffect, useState } from "react";

const ICONS = ["❄️", "❄️", "❄️", "🎅", "🎄", "⛄", "❄️", "❄️"];

export default function ChristmasSnow() {
  const [flakes, setFlakes] = useState<{ id: number; left: number; delay: number; duration: number; icon: string }[]>([]);

  useEffect(() => {
    // Generate flakes only on client to avoid hydration mismatch
    const newFlakes = Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100, // 0-100vw
      delay: Math.random() * 5, // 0-5s delay
      duration: 10 + Math.random() * 10, // 10-20s fall duration
      icon: ICONS[Math.floor(Math.random() * ICONS.length)]
    }));
    setFlakes(newFlakes);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden" aria-hidden="true">
      {flakes.map((flake) => (
        <div
          key={flake.id}
          className="absolute top-0 text-xl opacity-80 select-none"
          style={{
            left: `${flake.left}%`,
            animation: `fall ${flake.duration}s linear infinite`,
            animationDelay: `-${flake.delay}s`,
            textShadow: "0 0 5px rgba(255,255,255,0.8)"
          }}
        >
          <div style={{ animation: `sway ${3 + Math.random() * 2}s ease-in-out infinite alternate` }}>
            {flake.icon}
          </div>
        </div>
      ))}
    </div>
  );
}
