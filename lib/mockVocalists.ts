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
  isDemo?: boolean;
}

export const mockVocalists: Vocalist[] = [
  {
    id: "sofia-demo",
    name: "Sofia",
    tagline: "Bright pop vocals with clean, agile delivery",
    match: 88,
    genres: ["Pop", "Melodic House"],
    priceUsd: 140,
    deliveryDays: 5,
    location: "London, UK",
    description:
      "Versatile female vocalist with a bright, agile tone. Comfortable across pop and melodic house references, with clean pitch control on uptempo lines.",
    tags: ["Female", "Bright", "Agile", "Pop"],
    demoUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
    isDemo: true,
  },
  {
    id: "mia-demo",
    name: "Mia",
    tagline: "Sustained, controlled tone for emotive midtempo tracks",
    match: 85,
    genres: ["Pop", "Cinematic"],
    priceUsd: 135,
    deliveryDays: 5,
    location: "Manchester, UK",
    description:
      "Female vocalist known for sustained, controlled notes and an even, emotive tone. Strong fit for midtempo and cinematic-leaning pop references.",
    tags: ["Female", "Controlled", "Emotive", "Midtempo"],
    demoUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
    isDemo: true,
  },
  {
    id: "elena-demo",
    name: "Elena",
    tagline: "Warm Spanish-language vocals with soulful phrasing",
    match: 87,
    genres: ["Pop", "R&B"],
    priceUsd: 145,
    deliveryDays: 6,
    location: "Madrid, ES",
    description:
      "Native Spanish-speaking vocalist with a warm, soulful delivery. Strong phrasing on R&B-leaning pop references, comfortable in both Spanish and English.",
    tags: ["Female", "Spanish", "Warm", "Soulful"],
    demoUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
    isDemo: true,
  },
  {
    id: "marcus-demo",
    name: "Marcus",
    tagline: "Deep, grounded male vocals for Afro-leaning productions",
    match: 84,
    genres: ["Afro House", "R&B"],
    priceUsd: 150,
    deliveryDays: 6,
    location: "Lagos, NG",
    description:
      "Male vocalist with a deep, grounded tone. Strong fit for Afro House and R&B references that call for weight and warmth in the lower register.",
    tags: ["Male", "Deep", "Grounded", "Afro House"],
    demoUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3",
    isDemo: true,
  },
  {
    id: "aria-demo",
    name: "Aria",
    tagline: "High, airy female vocals with strong head-voice control",
    match: 86,
    genres: ["Pop", "Cinematic"],
    priceUsd: 160,
    deliveryDays: 5,
    location: "Stockholm, SE",
    description:
      "Female vocalist with a high, airy tone and strong head-voice control. Suited to pop and cinematic references that sit in the upper register.",
    tags: ["Female", "High", "Airy", "Head Voice"],
    demoUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
    isDemo: true,
  },
  {
    id: "ryan-demo",
    name: "Ryan",
    tagline: "Versatile male vocals with clean mid-range delivery",
    match: 83,
    genres: ["Pop", "Indie Pop"],
    priceUsd: 130,
    deliveryDays: 5,
    location: "Austin, US",
    description:
      "Male vocalist with a clean, versatile mid-range delivery. Comfortable across pop and indie pop references without heavy stylistic coloring.",
    tags: ["Male", "Versatile", "Clean", "Mid-range"],
    demoUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3",
    isDemo: true,
  },
  {
    id: "zara-demo",
    name: "Zara",
    tagline: "Rich Afrikaans-language vocals with rhythmic phrasing",
    match: 82,
    genres: ["Afro House", "Pop"],
    priceUsd: 140,
    deliveryDays: 6,
    location: "Cape Town, ZA",
    description:
      "Native Afrikaans-speaking vocalist with rich tone and strong rhythmic phrasing. Well suited to Afro House and uptempo pop references.",
    tags: ["Female", "Afrikaans", "Rhythmic", "Rich"],
    demoUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3",
    isDemo: true,
  },
  {
    id: "priya-demo",
    name: "Priya",
    tagline: "Expressive Hindi-language vocals with melodic ornamentation",
    match: 85,
    genres: ["Pop", "Cinematic"],
    priceUsd: 145,
    deliveryDays: 6,
    location: "Mumbai, IN",
    description:
      "Native Hindi-speaking vocalist with expressive, melodically ornamented delivery. Strong fit for cinematic and pop references with melodic runs.",
    tags: ["Female", "Hindi", "Expressive", "Melodic"],
    demoUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3",
    isDemo: true,
  },
];

export function getVocalistById(id: string): Vocalist | undefined {
  return mockVocalists.find((vocalist) => vocalist.id === id);
}
