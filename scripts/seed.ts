// scripts/seed.ts
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// 1. Setup Clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 2. The Gold Standard Data (Rich Descriptions = Better Vectors)
const seedData = [
  {
    title: "Elden Ring",
    type: "game",
    description: "A vast open-world dark fantasy RPG. Players explore the Lands Between, a realm filled with decay, obscure lore, and difficult combat. Themes of ambition, fallen gods, and the cycle of order and chaos. Vibes: Melancholy, Grandiose, Unforgiving."
  },
  {
    title: "Dune",
    type: "book",
    description: "A sci-fi epic set on the desert planet Arrakis. Follows Paul Atreides as he navigates political betrayal, ecology, and destiny. Themes of messianic figures, resource scarcity, and human evolution. Vibes: Dry, Political, Philosophical."
  },
  {
    title: "Berserk (1997)",
    type: "anime",
    description: "A dark fantasy series following Guts, a lone mercenary, and Griffith, the charismatic leader of the Band of the Hawk. Themes of camaraderie, ambition, betrayal, and struggling against fate. Vibes: Gritty, Violent, Tragic."
  },
  {
    title: "The Witcher 3: Wild Hunt",
    type: "game",
    description: "A story-driven RPG following Geralt of Rivia, a monster slayer for hire. Set in a war-torn world filled with moral ambiguity. Themes of fatherhood, lesser evils, and consequences. Vibes: Atmospheric, Mature, Folkloric."
  },
  {
    title: "Nausicaä of the Valley of the Wind",
    type: "anime",
    description: "A post-apocalyptic film about a princess trying to stop warring nations from destroying the last of the world's toxic jungles. Themes of environmentalism, pacifism, and understanding nature. Vibes: Hopeful, Beautiful, Environmental."
  },
  {
    title: "Hyperion",
    type: "book",
    description: "A complex sci-fi novel structured like the Canterbury Tales. Seven pilgrims travel to the Time Tombs on the planet Hyperion. Themes of religion, time travel, and the pain of memory. Vibes: Literary, Mysterious, Complex."
  },
  {
    title: "Cyberpunk 2077",
    type: "game",
    description: "An action RPG set in Night City, a megalopolis obsessed with power, glamour, and body modification. Themes of transhumanism, corporate greed, and identity. Vibes: Neon, Dystopian, Rebellious."
  },
  {
    title: "Neuromancer",
    type: "book",
    description: "The seminal cyberpunk novel about a washed-up computer hacker hired for one last job. Themes of artificial intelligence, virtual reality, and corporate control. Vibes: Gritty, Tech-noir, Fast-paced."
  },
  {
    title: "Neon Genesis Evangelion",
    type: "anime",
    description: "Mecha anime that deconstructs the genre. Teenagers pilot giant robots to fight angels, but the real focus is on their psychological trauma. Themes of depression, hedgehog's dilemma, and human connection. Vibes: Psychological, Surreal, Depressing."
  }
];

async function seed() {
  console.log('🌱 Starting Seed...');

  for (const item of seedData) {
    console.log(`Generating vector for: ${item.title}...`);
    
    // A. Generate Embedding
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: item.description,
    });
    const embedding = embeddingResponse.data[0].embedding;

    // B. Insert into Supabase
    const { error } = await supabase.from('media_items').insert({
      title: item.title,
      type: item.type,
      description: item.description,
      embedding: embedding,
      metadata: { seeded: true }
    });

    if (error) console.error('Error inserting:', error);
  }

  console.log('✅ Seeding Complete! The tank is full.');
}

seed();
