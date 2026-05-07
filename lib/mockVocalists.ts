export interface Vocalist {
  id: string;
  name: string;
  tagline: string;
  match: number;
  genres: string[];
  priceUsd: number;
  deliveryDays: number;
  location: string;
  description: string;
  tags: string[];
  demoUrl: string;
}

export const mockVocalists: Vocalist[] = [
  {
    id: "anna-voice",
    name: "Anna Voice",
    tagline: "Warm toplines for melodic house and pop",
    match: 94,
    genres: ["Melodic House", "Pop"],
    priceUsd: 180,
    deliveryDays: 4,
    location: "Berlin, DE",
    description:
      "Session vocalist with a clean emotional tone. Strong in radio-ready hooks and airy doubles.",
    tags: ["Female", "Warm", "Airy", "Hook-focused"],
    demoUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  },
  {
    id: "luna-sky",
    name: "Luna Sky",
    tagline: "Cinematic texture vocals with indie character",
    match: 89,
    genres: ["Cinematic", "Indie Pop"],
    priceUsd: 150,
    deliveryDays: 5,
    location: "Warsaw, PL",
    description:
      "Specializes in layered harmonies and expressive ad-libs. Works great for emotional storytelling tracks.",
    tags: ["Female", "Textured", "Soulful", "Harmonies"],
    demoUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
  },
  {
    id: "mike-soul",
    name: "Mike Soul",
    tagline: "Powerful male EDM and afro-house vocals",
    match: 82,
    genres: ["EDM", "Afro House"],
    priceUsd: 130,
    deliveryDays: 6,
    location: "Belgrade, RS",
    description:
      "Deep modern tone built for festival records. Delivers lead takes, doubles, and simple mix-ready stems.",
    tags: ["Male", "Deep", "Energetic", "Festival-ready"],
    demoUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
  },
];

export function getVocalistById(id: string): Vocalist | undefined {
  return mockVocalists.find((vocalist) => vocalist.id === id);
}
