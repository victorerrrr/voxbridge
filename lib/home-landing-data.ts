import { mockVocalists } from "@/lib/mockVocalists";

const AI_DEMO_URL = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3";

export type HomeDemoTransformation = {
  id: string;
  title: string;
  aiLabel: string;
  vocalLabel: string;
  aiUrl: string;
  vocalUrl: string;
};

export type HomeFeedTransformation = {
  id: string;
  title: string;
  description: string;
  producer: string;
  aiLabel: string;
  vocalLabel: string;
  aiUrl: string;
  vocalUrl: string;
};

export const HOME_DEMO_TRANSFORMATIONS: HomeDemoTransformation[] = [
  {
    id: "demo-midnight",
    title: "Midnight Drive",
    aiLabel: "AI vocal",
    vocalLabel: "Anna Voice — real take",
    aiUrl: AI_DEMO_URL,
    vocalUrl: mockVocalists[0].demoUrl,
  },
  {
    id: "demo-neon",
    title: "Neon Pulse",
    aiLabel: "AI vocal",
    vocalLabel: "Luna Sky — real take",
    aiUrl: AI_DEMO_URL,
    vocalUrl: mockVocalists[1].demoUrl,
  },
];

export const HOME_FEED_TRANSFORMATIONS: HomeFeedTransformation[] = [
  {
    id: "feed-1",
    title: "Glass Horizon",
    description: "Melodic house hook swapped from AI grit to warm human tone.",
    producer: "Kai M.",
    aiLabel: "AI draft",
    vocalLabel: "Anna Voice",
    aiUrl: AI_DEMO_URL,
    vocalUrl: mockVocalists[0].demoUrl,
  },
  {
    id: "feed-2",
    title: "Velvet Sky",
    description: "Indie-pop verse — cinematic texture from Luna Sky.",
    producer: "Nova Studio",
    aiLabel: "AI draft",
    vocalLabel: "Luna Sky",
    aiUrl: AI_DEMO_URL,
    vocalUrl: mockVocalists[1].demoUrl,
  },
  {
    id: "feed-3",
    title: "Solar Drift",
    description: "Festival drop with Mike Soul’s powerful real vocal.",
    producer: "Pulse Lab",
    aiLabel: "AI draft",
    vocalLabel: "Mike Soul",
    aiUrl: AI_DEMO_URL,
    vocalUrl: mockVocalists[2].demoUrl,
  },
  {
    id: "feed-4",
    title: "Echo Chamber",
    description: "Dark pop bridge — emotional lift after human replacement.",
    producer: "Rin K.",
    aiLabel: "AI draft",
    vocalLabel: "Anna Voice",
    aiUrl: AI_DEMO_URL,
    vocalUrl: mockVocalists[0].demoUrl,
  },
];

export const HOME_FEATURED_VOCALISTS = mockVocalists;
