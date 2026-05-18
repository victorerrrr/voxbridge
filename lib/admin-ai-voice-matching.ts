export const MATCH_REASON_POOL = [
  "Similar tone",
  "Close pitch range",
  "Matching genre",
] as const;

export type VocalistDemoItem = {
  id: string;
  name: string;
  audioUrl: string;
  source: "upload" | "mock";
};

export type AiVoiceMatchResult = {
  id: string;
  vocalistName: string;
  similarity: number;
  reasons: string[];
  demoAudioUrl: string;
};

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandomReasons(): string[] {
  const count = randomInt(1, 3);
  const pool = [...MATCH_REASON_POOL];
  const picked: string[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const index = randomInt(0, pool.length - 1);
    picked.push(pool.splice(index, 1)[0]);
  }
  return picked;
}

/** Mock AI similarity scores for admin lab — no real AI. */
export function generateMockMatchingResults(
  demos: VocalistDemoItem[]
): AiVoiceMatchResult[] {
  return demos
    .map((demo) => ({
      id: demo.id,
      vocalistName: demo.name,
      similarity: randomInt(70, 98),
      reasons: pickRandomReasons(),
      demoAudioUrl: demo.audioUrl,
    }))
    .sort((a, b) => b.similarity - a.similarity);
}
