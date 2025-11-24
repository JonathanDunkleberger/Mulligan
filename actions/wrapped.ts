"use server";

import OpenAI from "openai";
import { MediaItem, Category } from "@/app/_lib/schema";
import { tmdbSearch, igdbSearch, gbooksSearch } from "@/app/_lib/adapters.server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface WrappedInsights {
  vibe: string;
  summary: string;
  masterRecs: {
    item: MediaItem;
    reason: string;
  }[];
  funFact: string;
  topEra: string;
}

export async function generateWrappedInsights(favorites: MediaItem[]): Promise<WrappedInsights | null> {
  if (!favorites || favorites.length < 3) return null;

  // Prepare a lightweight summary of the collection to save tokens
  const collectionSummary = favorites.slice(0, 60).map(f => ({
    title: f.title,
    type: f.category,
    genres: f.genres?.slice(0, 2), // Top 2 genres only
    year: f.year,
    creator: f.creators?.[0] // Primary creator only
  }));

  const prompt = `
    You are a "Spotify Wrapped" style analyst for media (Books, Games, Movies, Anime, TV).
    Analyze this user's collection and generate a fun, insightful personality profile.

    Collection: ${JSON.stringify(collectionSummary)}

    Return a JSON object with these exact fields:
    {
      "vibe": "A short, punchy 3-5 word aesthetic title for their taste (e.g. 'Melancholic Cyberpunk Philosopher' or 'Cozy Cottagecore Gamer')",
      "summary": "A 2-3 sentence deep dive into their specific taste patterns. Be specific about themes (e.g. 'You love stories about AI gaining consciousness, but only if they have a happy ending.'). Connect dots between different media types.",
      "masterRecs": [
        {
          "title": "Title 1",
          "category": "film" | "tv" | "anime" | "game" | "book",
          "reason": "Short pitch why."
        },
        { "title": "Title 2", "category": "...", "reason": "..." },
        { "title": "Title 3", "category": "...", "reason": "..." },
        { "title": "Title 4", "category": "...", "reason": "..." },
        { "title": "Title 5", "category": "...", "reason": "..." }
      ],
      "funFact": "A quirky observation about their data (e.g. '80% of your favorite movies were released in 1999' or 'You have a secret obsession with French directors').",
      "topEra": "The decade or era they gravitate towards most (e.g. 'The Roaring 20s' or 'The Neon 80s')"
    }
  `;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a witty, insightful media analyst. Output valid JSON only." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const content = completion.choices[0].message.content;
    if (!content) return null;
    
    const rawData = JSON.parse(content);

    // Hydrate recommendations with real data
    const hydratedRecs = await Promise.all(rawData.masterRecs.map(async (rec: any) => {
      try {
        let results: MediaItem[] = [];
        if (rec.category === 'game') results = await igdbSearch(rec.title);
        else if (rec.category === 'book') results = await gbooksSearch(rec.title);
        else results = await tmdbSearch(rec.title, rec.category);

        const bestMatch = results[0];
        if (!bestMatch) return null;

        return {
          item: bestMatch,
          reason: rec.reason
        };
      } catch (e) {
        return null;
      }
    }));

    return {
      ...rawData,
      masterRecs: hydratedRecs.filter(Boolean)
    } as WrappedInsights;

  } catch (error) {
    console.error("Error generating wrapped insights:", error);
    return null;
  }
}
