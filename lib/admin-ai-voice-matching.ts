export const VOICE_MATCH_API_URL =
  process.env.NEXT_PUBLIC_VOICE_MATCH_API_URL ?? "http://127.0.0.1:8000";

/** Full POST URL for multipart voice matching (lab + API client). */
export const VOICE_MATCH_REQUEST_URL = `${VOICE_MATCH_API_URL.replace(/\/$/, "")}/voice-match`;

export type VocalistDemoItem = {
  id: string;
  name: string;
  /** Original uploaded basename (used for MANUAL_DEMO_GENDER_SUBSTRINGS on the API). */
  originalFileName: string;
  audioUrl: string;
  source: "upload";
  file: File;
};

export type VoiceMatchScoreBreakdown = {
  speakerScore: number | null;
  timbreScore: number | null;
  pitchScore: number | null;
  qualityScore: number | null;
};

export type AiVoiceMatchResult = {
  id: string;
  /** Final API list index (0 = top match). */
  index: number;
  /** True only for index 0 when returned by the voice-match API. */
  isTopMatch: boolean;
  filename: string;
  vocalistName: string;
  /** Raw API similarity (lab debug only). */
  similarity: number;
  /** Inverted min–max of final_ranking_score (lower score → higher %, display). */
  matchPercent: number;
  /** Backend rank score (sort key for ordering and matchPercent). */
  finalRankingScore: number;
  /** True when pitch-MIDI vocal types align with the AI reference. */
  vocalTypeMatch: boolean;
  /** Median F0 as MIDI note (pitch_avg from API). */
  pitchAvg: number | null;
  /** male | female | unknown from pitch_avg thresholds. */
  detectedVocalType: string;
  /** Admin filename override (null when none). */
  manualGender: string | null;
  /** Ranking gender: manualGender ?? detectedVocalType. */
  finalVocalType: string;
  /** Russian label for UI from finalVocalType (+ highPitchedMale). */
  displayVocalType: string;
  /** True when timbre/pitch matches real_voice_1 male prototype. */
  similarityToRealVoice1?: boolean;
  /** High-pitched male reclassified as male for ranking. */
  highPitchedMale?: boolean;
  /** True when hard gender partition demoted this row from #1. */
  hardGenderBlockApplied?: boolean;
  /** True when real_voice_1.wav was force-demoted (never top match). */
  forceDemotedRealVoice1?: boolean;
  /** API flag: same speaker identity as the AI reference. */
  exactVoiceMatch?: boolean;
  aiDetectedVocalType?: string;
  /** Median F0 MIDI of the AI reference vocal (same on all rows). */
  aiPitchAvg?: number | null;
  confidence: number | null;
  explanation?: string;
  reasons: string[];
  /** All voice feature tags for lab/debug (match + mismatch; no recording). */
  featureTags: string[];
  /** Match-only tags for «Best match because» / feature chips (display). */
  matchFeatureTags?: string[];
  /** Mismatch tags for debug or «Что отличается» tooling (display). */
  mismatchFeatureTags?: string[];
  demoAudioUrl: string;
  breakdown: VoiceMatchScoreBreakdown;
};

export type MatchConfidenceLevel =
  | "very-strong"
  | "good"
  | "partial"
  | "weak";

/** Display confidence tiers from capped matchPercent (does not affect ranking). */
export function resolveMatchConfidenceLevel(
  result: Pick<AiVoiceMatchResult, "confidence" | "matchPercent" | "similarity">
): MatchConfidenceLevel {
  const score = result.matchPercent ?? result.confidence ?? result.similarity;
  if (score >= 87) return "very-strong";
  if (score >= 75) return "good";
  if (score >= 60) return "partial";
  return "weak";
}

export function formatMatchConfidenceLabel(level: MatchConfidenceLevel): string {
  const labels: Record<MatchConfidenceLevel, string> = {
    "very-strong": "Very strong match",
    good: "Good match",
    partial: "Partial match",
    weak: "Weak match",
  };
  return labels[level];
}

/** Max displayed match % for non–exact-same-voice rows. */
export const MAX_DISPLAY_MATCH_PERCENT = 92;

/** Vocal type mismatch (male vs female AI, etc.) — display cap; weak band (<50%). */
export const VOCAL_TYPE_MISMATCH_MAX_PERCENT = 49;

/** @deprecated All vocal-type mismatches use VOCAL_TYPE_MISMATCH_MAX_PERCENT (49). */
export const HIGH_PITCHED_MALE_FEMALE_AI_MAX_PERCENT = 49;

/** When % ≥70 but fewer than 2 matched bullets, reduce to this partial band. */
export const MATCH_PERCENT_INSUFFICIENT_EVIDENCE_CAP = 65;

/** Threshold for exact-same-voice heuristic (similarity / speaker). */
export const EXACT_VOICE_THRESHOLD = 99.5;

/** True when API or scores indicate the demo is the same voice identity as the AI reference. */
export function isExactSameVoice(
  row: Pick<
    AiVoiceMatchResult,
    "similarity" | "breakdown" | "exactVoiceMatch"
  >
): boolean {
  if (row.exactVoiceMatch === true) return true;
  const speaker = row.breakdown.speakerScore;
  if (speaker == null) return false;
  if (speaker >= 99 && row.similarity >= 99) return true;
  if (row.similarity >= EXACT_VOICE_THRESHOLD && speaker >= 98) return true;
  return false;
}

/** Score at or above this → dimension listed under «Что совпало» (legacy). */
export const MATCH_SECTION_STRONG_THRESHOLD = 60;

/** Per-dimension thresholds for lab comparison bullets (display only). */
export const MATCH_COMPARISON_CLOSE = {
  speaker: 12,
  timbre: 70,
  pitch: 70,
  quality: 65,
} as const;

export const MATCH_COMPARISON_PARTIAL = {
  speaker: 8,
  timbre: 50,
  pitch: 50,
  quality: 50,
} as const;

const REAL_VOICE_1_BASENAME = "real_voice_1.wav";

export function isRealVoice1Filename(filename: string): boolean {
  const base = filename.split(/[/\\]/).pop() ?? filename;
  return base.toLowerCase() === REAL_VOICE_1_BASENAME;
}

export type ComparisonCategory =
  | "vocal_type"
  | "vocal_range"
  | "timbre"
  | "brightness"
  | "recording_quality"
  | "voice_character";

export type MatchLevel = "close" | "partial" | "mismatch";

export interface CategoryComparison {
  category: ComparisonCategory;
  level: MatchLevel;
  aiLabel: string;
  demoLabel: string;
  matchedLine?: string;
  /** Softer wording for partial / gender-mismatch secondary matches. */
  matchedLineSoft?: string;
  differentLine?: string;
}

/** Lab comparison thresholds (display only; does not affect ranking). */
export const CATEGORY_COMPARISON_THRESHOLDS = {
  vocalRangeMidi: { lowMax: 58, highMin: 66 },
  pitchDeltaClose: 2,
  pitchDeltaPartial: 5,
  scoreClose: MATCH_COMPARISON_CLOSE,
  scorePartial: MATCH_COMPARISON_PARTIAL,
  timbreLabel: { denseMin: 75, softMin: 55 },
  brightnessLabel: { brightTimbreMin: 72, darkTimbreMax: 52 },
  qualityLabel: { cleanMin: 70, acceptableMin: 50 },
  voiceCharacterLabel: {
    verySimilarMin: 85,
    similarMin: 70,
    partialMin: 50,
  },
} as const;

export type MatchComparisonAiContext = {
  aiDetectedVocalType?: string;
  aiPitchAvg?: number | null;
  /** Pre-classified AI labels (optional; computed when missing). */
  categoryLabels?: Partial<Record<ComparisonCategory, string>>;
};

function scoreMatchLevel(
  score: number | null | undefined,
  close: number,
  partial: number
): MatchLevel {
  if (score == null || !Number.isFinite(score)) return "mismatch";
  if (score >= close) return "close";
  if (score >= partial) return "partial";
  return "mismatch";
}

function matchReasonSet(row: Pick<AiVoiceMatchResult, "reasons">): Set<string> {
  return new Set(row.reasons.map((r) => r.trim().toLowerCase()));
}

function demoFilenameStem(filename: string): string {
  return (filename.split(/[/\\]/).pop() ?? filename).replace(/\.[^.]+$/, "");
}

function resolveAiContext(
  row: AiVoiceMatchResult,
  aiContext?: MatchComparisonAiContext
) {
  const aiType =
    aiContext?.aiDetectedVocalType ?? row.aiDetectedVocalType ?? "unknown";
  const aiPitch = aiContext?.aiPitchAvg ?? row.aiPitchAvg ?? null;
  const labels = aiContext?.categoryLabels;
  return {
    aiDetectedVocalType: aiType,
    aiPitchAvg: aiPitch,
    aiLabels: {
      vocal_type:
        labels?.vocal_type ?? classifyVocalTypeLabel(aiType, false),
      vocal_range:
        labels?.vocal_range ?? classifyVocalRangeLabel(aiPitch),
      timbre: labels?.timbre ?? classifyTimbreLabel(null, aiPitch),
      brightness:
        labels?.brightness ?? classifyBrightnessLabel(null, aiPitch),
      recording_quality:
        labels?.recording_quality ?? "clean",
      voice_character:
        labels?.voice_character ?? "similar",
    },
  };
}

/**
 * Display label only — uses API `detected_vocal_type` / `final_vocal_type`;
 * does not re-classify from pitch on the client.
 */
export function classifyVocalTypeLabel(
  rawType: string,
  highPitchedMale: boolean
): string {
  if (highPitchedMale) return "high-pitched male";
  const t = (rawType ?? "").toLowerCase();
  if (t === "female" || t === "male") return t;
  return "unknown";
}

/** low | mid | high from pitch_avg MIDI. */
export function classifyVocalRangeLabel(
  pitchAvg: number | null | undefined
): string {
  if (typeof pitchAvg !== "number" || !Number.isFinite(pitchAvg) || pitchAvg <= 0) {
    return "unknown";
  }
  const { lowMax, highMin } = CATEGORY_COMPARISON_THRESHOLDS.vocalRangeMidi;
  if (pitchAvg < lowMax) return "low";
  if (pitchAvg >= highMin) return "high";
  return "mid";
}

/** soft | sharp | dense from timbre_score (+ pitch fallback when score missing). */
export function classifyTimbreLabel(
  timbreScore: number | null | undefined,
  pitchAvg: number | null | undefined
): string {
  const { denseMin, softMin } = CATEGORY_COMPARISON_THRESHOLDS.timbreLabel;
  if (timbreScore != null && Number.isFinite(timbreScore)) {
    if (timbreScore >= denseMin) return "dense";
    if (timbreScore >= softMin) return "soft";
    return "sharp";
  }
  if (typeof pitchAvg === "number" && pitchAvg >= 64) return "soft";
  if (typeof pitchAvg === "number" && pitchAvg < 58) return "sharp";
  return "soft";
}

/** dark | balanced | bright from timbre_score + pitch. */
export function classifyBrightnessLabel(
  timbreScore: number | null | undefined,
  pitchAvg: number | null | undefined
): string {
  const { brightTimbreMin, darkTimbreMax } =
    CATEGORY_COMPARISON_THRESHOLDS.brightnessLabel;
  if (timbreScore != null && Number.isFinite(timbreScore)) {
    if (timbreScore >= brightTimbreMin) return "bright";
    if (timbreScore <= darkTimbreMax) return "dark";
    return "balanced";
  }
  if (typeof pitchAvg === "number" && pitchAvg >= 66) return "bright";
  if (typeof pitchAvg === "number" && pitchAvg < 58) return "dark";
  return "balanced";
}

/** poor | acceptable | clean from quality_score. */
export function classifyRecordingQualityLabel(
  qualityScore: number | null | undefined
): string {
  const { cleanMin, acceptableMin } = CATEGORY_COMPARISON_THRESHOLDS.qualityLabel;
  if (qualityScore == null || !Number.isFinite(qualityScore)) return "acceptable";
  if (qualityScore >= cleanMin) return "clean";
  if (qualityScore >= acceptableMin) return "acceptable";
  return "poor";
}

/** Speaker-identity character tier from speaker_score. */
export function classifyVoiceCharacterLabel(
  speakerScore: number | null | undefined
): string {
  const { verySimilarMin, similarMin, partialMin } =
    CATEGORY_COMPARISON_THRESHOLDS.voiceCharacterLabel;
  if (speakerScore == null || !Number.isFinite(speakerScore)) return "partial";
  if (speakerScore >= verySimilarMin) return "very similar";
  if (speakerScore >= similarMin) return "similar";
  if (speakerScore >= partialMin) return "partially distinct";
  return "distinct";
}

const VOCAL_TYPE_RU: Record<string, string> = {
  female: "женский",
  male: "мужской",
  "high-pitched male": "высокий мужской",
  unknown: "неизвестный",
};

const VOCAL_RANGE_RU: Record<string, string> = {
  low: "низкий",
  mid: "средний",
  high: "высокий",
  unknown: "неизвестный",
};

const TIMBRE_RU: Record<string, string> = {
  soft: "мягкий",
  sharp: "резкий",
  dense: "плотный",
};

const BRIGHTNESS_RU: Record<string, string> = {
  dark: "тёмный",
  balanced: "сбалансированный",
  bright: "яркий",
};

const QUALITY_RU: Record<string, string> = {
  poor: "шумная",
  acceptable: "средняя",
  clean: "чистая",
};

const CHARACTER_RU: Record<string, string> = {
  "very similar": "очень похожий",
  similar: "похожий",
  "partially distinct": "частично иной",
  distinct: "другой диктор",
  partial: "частично иной",
};

function labelRu(
  map: Record<string, string>,
  key: string
): string {
  return map[key] ?? key;
}

function demoVocalType(
  row: Pick<AiVoiceMatchResult, "finalVocalType" | "detectedVocalType">
): string {
  return row.finalVocalType || row.detectedVocalType || "unknown";
}

/** Display-only: vocal type is a hard blocker (no partial «Что совпало»). */
export function isGenderCriticalMismatch(
  row: MatchFeatureTagRowContext,
  aiContext?: MatchComparisonAiContext
): boolean {
  if (row.vocalTypeMatch === false) return true;
  const aiType =
    aiContext?.aiDetectedVocalType ?? row.aiDetectedVocalType ?? "unknown";
  const demoType = classifyVocalTypeLabel(
    demoVocalType(row),
    row.highPitchedMale === true
  );
  return isVocalTypeGenderMismatch(row, aiType, demoType);
}

function isVocalTypeGenderMismatch(
  row: MatchFeatureTagRowContext,
  aiType: string,
  demoTypeLabel: string
): boolean {
  if (row.highPitchedMale && aiType === "female") return true;
  if (row.vocalTypeMatch === false) return true;
  if (row.hardGenderBlockApplied === true) return true;
  if (matchReasonSet(row).has("vocal type mismatch")) return true;
  const aiNorm = classifyVocalTypeLabel(aiType, false);
  if (demoTypeLabel === "high-pitched male" && aiNorm === "female") return true;
  if (
    aiNorm !== "unknown" &&
    demoTypeLabel !== "unknown" &&
    demoTypeLabel !== "high-pitched male" &&
    aiNorm !== demoTypeLabel
  ) {
    return true;
  }
  if (demoTypeLabel === "male" && aiNorm === "female") return true;
  return false;
}

function compareVocalRangeLevel(
  row: AiVoiceMatchResult,
  demoPitch: number | null,
  aiPitch: number | null
): MatchLevel {
  const pitchLevel = scoreMatchLevel(
    row.breakdown.pitchScore,
    MATCH_COMPARISON_CLOSE.pitch,
    MATCH_COMPARISON_PARTIAL.pitch
  );
  if (demoPitch != null && aiPitch != null) {
    const delta = Math.abs(demoPitch - aiPitch);
    const { pitchDeltaClose, pitchDeltaPartial } = CATEGORY_COMPARISON_THRESHOLDS;
    if (delta <= pitchDeltaClose) return "close";
    if (delta <= pitchDeltaPartial) return "partial";
    return "mismatch";
  }
  return pitchLevel;
}

/**
 * Per-category voice feature comparison vs AI reference (lab display only).
 */
export function compareVoiceCategories(
  row: AiVoiceMatchResult,
  aiContext?: MatchComparisonAiContext
): CategoryComparison[] {
  const stem = demoFilenameStem(row.filename);
  const ai = resolveAiContext(row, aiContext);
  const { speakerScore, timbreScore, pitchScore, qualityScore } = row.breakdown;
  const demoPitch = row.pitchAvg;
  const aiPitch = ai.aiPitchAvg;
  const demoTypeLabel = classifyVocalTypeLabel(
    demoVocalType(row),
    row.highPitchedMale === true
  );
  const aiTypeLabel = ai.aiLabels.vocal_type;
  const genderMismatch = isVocalTypeGenderMismatch(
    row,
    ai.aiDetectedVocalType,
    demoTypeLabel
  );

  const demoRangeLabel = classifyVocalRangeLabel(demoPitch);
  const aiRangeLabel = ai.aiLabels.vocal_range;
  const rangeLevel = compareVocalRangeLevel(row, demoPitch, aiPitch);

  const demoTimbreLabel = classifyTimbreLabel(timbreScore, demoPitch);
  const aiTimbreLabel = ai.aiLabels.timbre;
  let timbreLevel = scoreMatchLevel(
    timbreScore,
    MATCH_COMPARISON_CLOSE.timbre,
    MATCH_COMPARISON_PARTIAL.timbre
  );
  if (genderMismatch && timbreLevel === "close") {
    timbreLevel = "partial";
  }

  const demoBrightnessLabel = classifyBrightnessLabel(timbreScore, demoPitch);
  const aiBrightnessLabel = ai.aiLabels.brightness;
  let brightnessLevel = scoreMatchLevel(
    timbreScore,
    MATCH_COMPARISON_CLOSE.timbre,
    MATCH_COMPARISON_PARTIAL.timbre
  );
  if (genderMismatch) {
    if (brightnessLevel === "close") brightnessLevel = "partial";
    if (row.highPitchedMale && ai.aiDetectedVocalType === "female") {
      brightnessLevel = "mismatch";
    }
  }

  const demoQualityLabel = classifyRecordingQualityLabel(qualityScore);
  const aiQualityLabel = ai.aiLabels.recording_quality;
  const qualityLevel = scoreMatchLevel(
    qualityScore,
    MATCH_COMPARISON_CLOSE.quality,
    MATCH_COMPARISON_PARTIAL.quality
  );

  const demoCharacterLabel = classifyVoiceCharacterLabel(speakerScore);
  const aiCharacterLabel = ai.aiLabels.voice_character;
  const characterLevel = scoreMatchLevel(
    speakerScore,
    MATCH_COMPARISON_CLOSE.speaker,
    MATCH_COMPARISON_PARTIAL.speaker
  );

  let vocalTypeLevel: MatchLevel;
  if (row.highPitchedMale && ai.aiDetectedVocalType === "female") {
    vocalTypeLevel = "mismatch";
  } else if (!genderMismatch && demoTypeLabel === aiTypeLabel) {
    vocalTypeLevel = "close";
  } else if (
    demoTypeLabel !== "unknown" &&
    aiTypeLabel !== "unknown" &&
    demoTypeLabel === aiTypeLabel
  ) {
    vocalTypeLevel = "close";
  } else if (genderMismatch) {
    vocalTypeLevel = "mismatch";
  } else {
    vocalTypeLevel = "partial";
  }

  const comparisons: CategoryComparison[] = [];

  const vocalTypeComp: CategoryComparison = {
    category: "vocal_type",
    level: vocalTypeLevel,
    aiLabel: aiTypeLabel,
    demoLabel: demoTypeLabel,
  };
  if (vocalTypeLevel === "close") {
    const demoTypeRu = resolveDisplayVocalType({
      finalVocalType: row.finalVocalType ?? demoVocalType(row),
      highPitchedMale: row.highPitchedMale,
    });
    vocalTypeComp.matchedLine =
      `[${stem}] Тип голоса совпадает: ${demoTypeRu}.`;
  } else if (row.highPitchedMale && ai.aiDetectedVocalType === "female") {
    vocalTypeComp.differentLine =
      `[${stem}] Высокий мужской тип голоса не подходит под женский AI-референс.`;
  } else if (isRealVoice1Filename(row.filename) && demoTypeLabel === "male") {
    vocalTypeComp.differentLine =
      `[${stem}] Мужской тип голоса не подходит под женский AI-референс.`;
  } else {
    if (aiTypeLabel === "female" && demoTypeLabel === "male") {
      vocalTypeComp.differentLine =
        `[${stem}] Мужской тип голоса не подходит под женский AI-референс.`;
    } else {
      vocalTypeComp.differentLine =
        `[${stem}] Тип голоса не совпадает с AI-референсом.`;
    }
  }
  comparisons.push(vocalTypeComp);

  const rangeComp: CategoryComparison = {
    category: "vocal_range",
    level: rangeLevel,
    aiLabel: aiRangeLabel,
    demoLabel: demoRangeLabel,
  };
  if (rangeLevel === "close") {
    rangeComp.matchedLine =
      `[${stem}] Диапазон звучит близко к референсу.`;
  } else if (rangeLevel === "partial") {
    rangeComp.matchedLineSoft =
      `[${stem}] Диапазон частично совпадает с референсом.`;
    rangeComp.differentLine =
      `[${stem}] По диапазону есть заметная разница.`;
  } else {
    rangeComp.differentLine =
      `[${stem}] Диапазон не совпадает с референсом.`;
  }
  comparisons.push(rangeComp);

  const timbreComp: CategoryComparison = {
    category: "timbre",
    level: timbreLevel,
    aiLabel: aiTimbreLabel,
    demoLabel: demoTimbreLabel,
  };
  if (timbreLevel === "close" && !genderMismatch) {
    timbreComp.matchedLine =
      `[${stem}] Тембр звучит очень похоже на референс.`;
  } else if (genderMismatch && timbreLevel !== "mismatch") {
    timbreComp.matchedLineSoft = `[${stem}] Частично похожий тембр.`;
    timbreComp.differentLine =
      `[${stem}] Тембр местами похож, но тип голоса другой.`;
  } else if (timbreLevel === "partial") {
    timbreComp.matchedLineSoft = `[${stem}] Тембр частично совпадает.`;
    timbreComp.differentLine =
      `[${stem}] Тембр совпадает только частично.`;
  } else {
    timbreComp.differentLine =
      `[${stem}] Тембр заметно отличается от референса.`;
  }
  comparisons.push(timbreComp);

  const brightnessComp: CategoryComparison = {
    category: "brightness",
    level: brightnessLevel,
    aiLabel: aiBrightnessLabel,
    demoLabel: demoBrightnessLabel,
  };
  if (brightnessLevel === "close" && !genderMismatch) {
    brightnessComp.matchedLine =
      `[${stem}] Похожая яркость подачи.`;
  } else if (row.highPitchedMale && ai.aiDetectedVocalType === "female") {
    brightnessComp.matchedLineSoft = `[${stem}] Похожая яркость подачи.`;
    brightnessComp.differentLine =
      `[${stem}] Высокий мужской тип голоса не подходит под женский AI-референс.`;
  } else if (brightnessLevel === "partial") {
    brightnessComp.matchedLineSoft = `[${stem}] Яркость частично совпадает.`;
    brightnessComp.differentLine =
      `[${stem}] По яркости есть заметная разница.`;
  } else {
    brightnessComp.differentLine =
      `[${stem}] Яркость отличается от референса.`;
  }
  comparisons.push(brightnessComp);

  const qualityComp: CategoryComparison = {
    category: "recording_quality",
    level: qualityLevel,
    aiLabel: aiQualityLabel,
    demoLabel: demoQualityLabel,
  };
  if (qualityLevel === "close") {
    qualityComp.matchedLine =
      `[${stem}] Качество записи ${labelRu(QUALITY_RU, demoQualityLabel)}.`;
  } else if (qualityLevel === "partial") {
    qualityComp.differentLine =
      `[${stem}] Качество записи ${labelRu(QUALITY_RU, demoQualityLabel)}.`;
  } else {
    qualityComp.differentLine =
      `[${stem}] Качество записи ${labelRu(QUALITY_RU, demoQualityLabel)}.`;
  }
  comparisons.push(qualityComp);

  const characterComp: CategoryComparison = {
    category: "voice_character",
    level: characterLevel,
    aiLabel: aiCharacterLabel,
    demoLabel: demoCharacterLabel,
  };
  if (characterLevel === "close") {
    characterComp.matchedLine =
      `[${stem}] Характер подачи близок к референсу.`;
  } else if (characterLevel === "partial") {
    characterComp.matchedLineSoft = `[${stem}] Характер подачи частично совпадает.`;
    characterComp.differentLine =
      `[${stem}] Манера подачи отличается в деталях.`;
  } else {
    characterComp.differentLine =
      `[${stem}] Характер подачи заметно другой.`;
  }
  comparisons.push(characterComp);

  return comparisons;
}

/** Russian labels for lab feature-tag chips (from buildFeatureTags). */
export const FEATURE_TAG_LABELS: Record<string, string> = {
  female_match: "женский тип голоса совпадает",
  male_mismatch: "мужской тип не подходит",
  high_pitched_male: "высокий мужской голос",
  vocal_type_mismatch: "тип голоса не совпадает",
  range_match_low: "низкий диапазон совпадает",
  range_match_mid: "диапазон совпадает",
  range_match_high: "высокий диапазон совпадает",
  range_mismatch_mid_vs_low: "диапазон: средний vs низкий",
  range_mismatch_high_vs_mid: "диапазон: высокий vs средний",
  range_mismatch_high_vs_low: "диапазон: высокий vs низкий",
  range_mismatch_low_vs_mid: "диапазон: низкий vs средний",
  range_mismatch_low_vs_high: "диапазон: низкий vs высокий",
  range_mismatch_mid_vs_high: "диапазон: средний vs высокий",
  range_mismatch_low: "низкий диапазон отличается",
  range_mismatch_mid: "диапазон отличается",
  range_mismatch_high: "высокий диапазон отличается",
  timbre_close_soft: "мягкий тембр близок",
  timbre_close_dense: "плотный тембр близок",
  timbre_mismatch_sharp: "тембр более резкий",
  timbre_mismatch_dense: "тембр плотный, не как у AI",
  timbre_mismatch_soft: "тембр мягкий, не как у AI",
  brightness_match: "яркость совпадает",
  brightness_partial: "яркость частично совпадает",
  brightness_mismatch_dark: "яркость темнее AI",
  brightness_mismatch_bright: "яркость ярче AI",
  brightness_mismatch_balanced: "яркость отличается",
  clean_recording: "чистая запись",
  acceptable_recording: "средняя запись",
  noisy_recording: "шумная запись",
  character_match: "характер диктора близок",
  character_partial: "характер диктора частично",
  character_different: "другой диктор",
};

/** Legacy English API `reasons` strings → canonical feature tag ids. */
const API_REASON_TO_FEATURE_TAG: Record<string, string> = {
  "similar timbre": "timbre_close_dense",
  "similar vocal brightness": "brightness_match",
  "similar vocal register": "range_match_mid",
  "clean demo recording": "clean_recording",
  "vocal type mismatch": "vocal_type_mismatch",
  "distinct voice character": "character_different",
  "noisy recording": "noisy_recording",
  "acceptable recording": "acceptable_recording",
};

/** Normalize tag id from API feature_tags or legacy reason strings. */
export function normalizeFeatureTagId(tag: string): string {
  const trimmed = tag.trim();
  if (!trimmed) return trimmed;
  const mapped = API_REASON_TO_FEATURE_TAG[trimmed.toLowerCase()];
  return mapped ?? trimmed;
}

export function normalizeFeatureTagIds(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    if (typeof raw !== "string" || !raw.trim()) continue;
    const id = normalizeFeatureTagId(raw);
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/** Feature tag ids for recording quality only (excluded from voice-match chips). */
export const RECORDING_FEATURE_TAG_IDS = new Set([
  "clean_recording",
  "acceptable_recording",
  "noisy_recording",
]);

export function isRecordingFeatureTag(tagId: string): boolean {
  return RECORDING_FEATURE_TAG_IDS.has(normalizeFeatureTagId(tagId));
}

/** Exact mismatch tag ids (plus any id containing `_mismatch`). */
export const MISMATCH_FEATURE_TAG_IDS = new Set([
  "male_mismatch",
  "female_mismatch",
  "vocal_type_mismatch",
  "high_pitched_male",
  "character_different",
  "range_mismatch_low",
  "range_mismatch_mid",
  "range_mismatch_high",
  "range_mismatch_mid_vs_low",
  "range_mismatch_high_vs_mid",
  "range_mismatch_high_vs_low",
  "range_mismatch_low_vs_mid",
  "range_mismatch_low_vs_high",
  "range_mismatch_mid_vs_high",
  "timbre_mismatch_sharp",
  "timbre_mismatch_dense",
  "timbre_mismatch_soft",
  "brightness_mismatch_dark",
  "brightness_mismatch_bright",
  "brightness_mismatch_balanced",
]);

/** True when tag describes a mismatch (must not appear in match chips). */
export function isMismatchFeatureTag(tagId: string): boolean {
  const id = normalizeFeatureTagId(tagId);
  if (MISMATCH_FEATURE_TAG_IDS.has(id)) return true;
  if (id.includes("_mismatch")) return true;
  return false;
}

export type MatchFeatureTagRowContext = Pick<
  AiVoiceMatchResult,
  | "vocalTypeMatch"
  | "highPitchedMale"
  | "aiDetectedVocalType"
  | "finalVocalType"
  | "detectedVocalType"
  | "reasons"
  | "filename"
  | "hardGenderBlockApplied"
>;

/** True when tag may appear in «Best match because» / match chips. */
export function isMatchFeatureTag(
  tagId: string,
  row?: MatchFeatureTagRowContext
): boolean {
  const id = normalizeFeatureTagId(tagId);
  if (row && isGenderCriticalMismatch(row)) {
    return false;
  }
  if (!id || isRecordingFeatureTag(id) || isMismatchFeatureTag(id)) {
    return false;
  }
  if (id === "female_match" && row) {
    if (row.vocalTypeMatch !== true) return false;
    const aiType = (row.aiDetectedVocalType ?? "").toLowerCase();
    const demoType = (row.finalVocalType ?? "").toLowerCase();
    if (aiType === "female" && demoType !== "female") return false;
    if (row.highPitchedMale === true) return false;
  }
  return true;
}

/** Match-only voice tags for chips (excludes recording + mismatch tags). */
export function filterMatchFeatureTags(
  tags: string[],
  row?: MatchFeatureTagRowContext
): string[] {
  return normalizeFeatureTagIds(tags).filter((id) => isMatchFeatureTag(id, row));
}

/** Voice tags excluding recording quality (includes match + mismatch). */
export function filterVoiceMatchFeatureTags(tags: string[]): string[] {
  return normalizeFeatureTagIds(tags).filter((id) => !isRecordingFeatureTag(id));
}

function splitVoiceFeatureTags(
  tags: string[],
  row: MatchFeatureTagRowContext
): { match: string[]; mismatch: string[] } {
  const voice = filterVoiceMatchFeatureTags(tags);
  const match: string[] = [];
  const mismatch: string[] = [];
  const seenMatch = new Set<string>();
  const seenMismatch = new Set<string>();
  for (const id of voice) {
    if (isMatchFeatureTag(id, row)) {
      if (!seenMatch.has(id)) {
        seenMatch.add(id);
        match.push(id);
      }
    } else if (isMismatchFeatureTag(id)) {
      if (!seenMismatch.has(id)) {
        seenMismatch.add(id);
        mismatch.push(id);
      }
    }
  }
  return { match, mismatch };
}

export function formatFeatureTagLabel(tagId: string): string {
  const id = normalizeFeatureTagId(tagId);
  if (id in FEATURE_TAG_LABELS) {
    return FEATURE_TAG_LABELS[id];
  }
  if (id.startsWith("voice_")) {
    const stem = id.slice("voice_".length).replace(/_/g, " ");
    return stem ? `голос: ${stem}` : id;
  }
  if (id.startsWith("pitch_")) {
    const midi = id.slice("pitch_".length);
    return midi ? `высота MIDI ~${midi}` : id;
  }
  return id.replace(/_/g, " ");
}

function vocalTypeFeatureTag(
  c: CategoryComparison,
  row: AiVoiceMatchResult
): string | null {
  if (row.highPitchedMale === true) {
    const aiType = (row.aiDetectedVocalType ?? c.aiLabel ?? "").toLowerCase();
    if (aiType === "female" || c.aiLabel === "female") {
      return "high_pitched_male";
    }
    return null;
  }
  if (c.level === "close") {
    if (
      c.demoLabel === "female" &&
      c.aiLabel === "female" &&
      row.vocalTypeMatch !== false
    ) {
      return "female_match";
    }
    return null;
  }
  if (c.level === "mismatch") {
    if (
      c.demoLabel === "male" &&
      (c.aiLabel === "female" || row.aiDetectedVocalType === "female")
    ) {
      return "male_mismatch";
    }
    return "vocal_type_mismatch";
  }
  return null;
}

function rangeFeatureTag(c: CategoryComparison): string | null {
  const d = c.demoLabel;
  const a = c.aiLabel;
  const rangeKeys = new Set(["low", "mid", "high"]);
  if (c.level === "close" && rangeKeys.has(d)) {
    return `range_match_${d}`;
  }
  if (c.level === "mismatch") {
    if (rangeKeys.has(d) && rangeKeys.has(a) && d !== a) {
      return `range_mismatch_${d}_vs_${a}`;
    }
    if (rangeKeys.has(d) && d === a) {
      return `range_mismatch_${d}`;
    }
    if (d === "high" || a === "high") return "range_mismatch_high";
    if (d === "low" && a !== "low") return `range_mismatch_low_vs_${a}`;
    if (a === "low" && d !== "low") return `range_mismatch_${d}_vs_low`;
    return null;
  }
  return null;
}

function timbreFeatureTag(c: CategoryComparison): string | null {
  const d = c.demoLabel;
  if (c.level === "close") {
    if (d === "dense") return "timbre_close_dense";
    if (d === "soft") return "timbre_close_soft";
    return "timbre_close_soft";
  }
  if (c.level === "mismatch") {
    if (d === "sharp") return "timbre_mismatch_sharp";
    if (d === "dense") return "timbre_mismatch_dense";
    if (d === "soft") return "timbre_mismatch_soft";
    return "timbre_mismatch_sharp";
  }
  return null;
}

function brightnessFeatureTag(c: CategoryComparison): string | null {
  if (c.level === "close") return "brightness_match";
  if (c.level === "partial") return "brightness_partial";
  if (c.level === "mismatch") {
    if (c.demoLabel === "dark") return "brightness_mismatch_dark";
    if (c.demoLabel === "bright") return "brightness_mismatch_bright";
    return "brightness_mismatch_balanced";
  }
  return null;
}

function recordingQualityFeatureTag(c: CategoryComparison): string | null {
  if (c.level === "close" && c.demoLabel === "clean") return "clean_recording";
  if (
    c.level === "partial" ||
    (c.level === "close" && c.demoLabel === "acceptable")
  ) {
    return "acceptable_recording";
  }
  if (c.level === "mismatch" || c.demoLabel === "poor") {
    return "noisy_recording";
  }
  if (c.demoLabel === "clean") return "clean_recording";
  if (c.demoLabel === "acceptable") return "acceptable_recording";
  return "noisy_recording";
}

function voiceCharacterFeatureTag(c: CategoryComparison): string | null {
  if (c.level === "close") return "character_match";
  if (c.level === "partial") return "character_partial";
  return "character_different";
}

function categoryToFeatureTag(
  c: CategoryComparison,
  row: AiVoiceMatchResult
): string | null {
  switch (c.category) {
    case "vocal_type":
      return vocalTypeFeatureTag(c, row);
    case "vocal_range":
      return rangeFeatureTag(c);
    case "timbre":
      return timbreFeatureTag(c);
    case "brightness":
      return brightnessFeatureTag(c);
    case "recording_quality":
      return recordingQualityFeatureTag(c);
    case "voice_character":
      return voiceCharacterFeatureTag(c);
    default:
      return null;
  }
}

const FEATURE_LEVEL_RANK: Record<MatchLevel, number> = {
  mismatch: 0,
  partial: 1,
  close: 2,
};

function weakestCategoryExtraTag(
  row: AiVoiceMatchResult,
  aiContext?: MatchComparisonAiContext,
  preferMatchOnly = false
): string | null {
  const categories = compareVoiceCategories(row, aiContext);
  const sorted = [...categories].sort(
    (a, b) => FEATURE_LEVEL_RANK[a.level] - FEATURE_LEVEL_RANK[b.level]
  );
  for (const c of sorted) {
    const tag = categoryToFeatureTag(c, row);
    if (!tag) continue;
    if (preferMatchOnly && !isMatchFeatureTag(tag, row)) continue;
    return tag;
  }
  return null;
}

function featureTagSetSignature(tags: string[]): string {
  return JSON.stringify([...tags].sort());
}

/**
 * Machine feature tags for lab chips, derived from compareVoiceCategories().
 */
export function buildFeatureTags(
  row: AiVoiceMatchResult,
  aiContext?: MatchComparisonAiContext
): string[] {
  const categories = compareVoiceCategories(row, aiContext);

  if (isGenderCriticalMismatch(row, aiContext)) {
    const tags: string[] = [];
    const vocalType = categories.find((c) => c.category === "vocal_type");
    if (vocalType) {
      const tag = categoryToFeatureTag(vocalType, row);
      if (tag && isMismatchFeatureTag(tag)) {
        tags.push(tag);
      }
    }
    return tags;
  }

  const tags: string[] = [];
  const seen = new Set<string>();

  for (const c of categories) {
    if (c.category === "recording_quality") continue;
    const tag = categoryToFeatureTag(c, row);
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      tags.push(tag);
    }
  }

  return tags;
}

/**
 * Ensures each row has a distinct featureTags set within a batch.
 * Adds a weakest-category or voice_stem tag only when duplicates remain.
 */
export function assignUniqueFeatureTagsToResults(
  results: AiVoiceMatchResult[],
  aiContext?: MatchComparisonAiContext
): AiVoiceMatchResult[] {
  const ctx =
    aiContext ?? buildMatchComparisonAiContext(results) ?? undefined;

  let tagged: AiVoiceMatchResult[] = results.map((row) => {
    const fromApi = normalizeFeatureTagIds(row.featureTags ?? []);
    const built =
      fromApi.length > 0 ? fromApi : buildFeatureTags(row, ctx);
    const featureTags = filterVoiceMatchFeatureTags(built);
    const { match, mismatch } = splitVoiceFeatureTags(featureTags, row);
    return {
      ...row,
      featureTags,
      matchFeatureTags: match,
      mismatchFeatureTags: mismatch,
    };
  });

  const groups = new Map<string, number[]>();
  tagged.forEach((row, index) => {
    const sig = featureTagSetSignature(row.featureTags);
    const list = groups.get(sig) ?? [];
    list.push(index);
    groups.set(sig, list);
  });

  for (const indices of groups.values()) {
    if (indices.length < 2) continue;

    for (const index of indices) {
      const row = tagged[index];
      if (isGenderCriticalMismatch(row, ctx)) continue;
      const extra =
        weakestCategoryExtraTag(row, ctx, true) ??
        weakestCategoryExtraTag(row, ctx) ??
        `voice_${demoFilenameStem(row.filename)}`;
      if (!row.featureTags.includes(extra)) {
        tagged[index] = {
          ...row,
          featureTags: [...row.featureTags, extra],
        };
      }
    }

    const stillDup = new Map<string, number[]>();
    for (const index of indices) {
      const sig = featureTagSetSignature(tagged[index].featureTags);
      const list = stillDup.get(sig) ?? [];
      list.push(index);
      stillDup.set(sig, list);
    }

    for (const dupIndices of stillDup.values()) {
      if (dupIndices.length < 2) continue;
      for (const index of dupIndices) {
        const row = tagged[index];
        const stemTag = `voice_${demoFilenameStem(row.filename)}`;
        if (!row.featureTags.includes(stemTag)) {
          tagged[index] = {
            ...row,
            featureTags: [...row.featureTags, stemTag],
          };
        } else if (
          row.pitchAvg != null &&
          Number.isFinite(row.pitchAvg) &&
          !row.featureTags.includes(`pitch_${Math.round(row.pitchAvg)}`)
        ) {
          const pitchTag = `pitch_${Math.round(row.pitchAvg)}`;
          tagged[index] = {
            ...row,
            featureTags: [...row.featureTags, pitchTag],
          };
        }
      }
    }
  }

  return tagged.map((row) => {
    const { match, mismatch } = splitVoiceFeatureTags(row.featureTags, row);
    return {
      ...row,
      matchFeatureTags: match,
      mismatchFeatureTags: mismatch,
    };
  });
}

/** Match tags for lab chips (prefers pre-split matchFeatureTags). */
export function resolveMatchFeatureTagsForDisplay(
  row: Pick<
    AiVoiceMatchResult,
    "featureTags" | "matchFeatureTags" | "vocalTypeMatch" | "highPitchedMale" | "aiDetectedVocalType" | "finalVocalType"
  >
): string[] {
  if (row.matchFeatureTags) return row.matchFeatureTags;
  return filterMatchFeatureTags(row.featureTags ?? [], row);
}

/** Join feature tag labels into a short winner explanation. */
export function formatFeatureTagsExplanation(tags: string[]): string {
  const labels = normalizeFeatureTagIds(tags)
    .map(formatFeatureTagLabel)
    .filter(Boolean);
  if (labels.length === 0) {
    return "Лучший ранг по итоговому скору и типу голоса.";
  }
  if (labels.length <= 3) {
    return labels.join("; ");
  }
  return `${labels.slice(0, 3).join("; ")}; ещё ${labels.length - 3}`;
}

/** Voice dimensions only — recording_quality is display-only via recordingQualityNote. */
const VOICE_MATCH_COMPARISON_CATEGORIES = new Set<ComparisonCategory>([
  "vocal_type",
  "vocal_range",
  "timbre",
  "brightness",
  "voice_character",
]);

function vocalTypeRejectionLine(
  categories: CategoryComparison[]
): string | undefined {
  return categories.find((c) => c.category === "vocal_type")?.differentLine;
}

const VOCAL_TYPE_INCOMPATIBILITY_NOTE =
  "Голоса принципиально несовместимы по типу.";

function secondaryCriticalMismatchDifferentLines(
  categories: CategoryComparison[],
  max = 2
): string[] {
  const out: string[] = [];
  for (const category of ["vocal_range", "timbre"] as const) {
    if (out.length >= max) break;
    const c = categories.find((x) => x.category === category);
    if (c?.differentLine && !out.includes(c.differentLine)) {
      out.push(c.differentLine);
    }
  }
  return out;
}

/**
 * Human-readable Russian «Что совпало / Что отличается» for lab match rows.
 * matched: voice categories only (type, range, timbre, brightness, character).
 * recording_quality → recordingQualityNote only.
 */
export function buildMatchComparisonSections(
  row: AiVoiceMatchResult,
  aiContext?: MatchComparisonAiContext
): {
  matched: string[];
  different: string[];
  recordingQualityNote: string;
} {
  const categories = compareVoiceCategories(row, aiContext);
  const criticalMismatch = isGenderCriticalMismatch(row, aiContext);

  const qualityLabel = labelRu(
    QUALITY_RU,
    classifyRecordingQualityLabel(row.breakdown.qualityScore)
  );
  const recordingQualityNote = `Качество записи: ${qualityLabel}`;

  if (criticalMismatch) {
    const stem = demoFilenameStem(row.filename);
    const typeRejectionLine =
      vocalTypeRejectionLine(categories) ??
      `[${stem}] Тип голоса не совпадает с AI-референсом.`;
    const different: string[] = [
      typeRejectionLine,
      VOCAL_TYPE_INCOMPATIBILITY_NOTE,
      ...secondaryCriticalMismatchDifferentLines(categories, 2),
    ];

    if (isRealVoice1Filename(row.filename)) {
      const note =
        "real_voice_1: принудительно мужской для ранжирования при женском AI-референсе";
      if (!different.some((s) => s.includes("real_voice_1"))) {
        different.push(note);
      }
    }

    return {
      matched: [],
      different: [...new Set(different)],
      recordingQualityNote,
    };
  }

  const matched: string[] = [];
  const different: string[] = [];

  for (const c of categories) {
    if (
      c.category === "recording_quality" ||
      !VOICE_MATCH_COMPARISON_CATEGORIES.has(c.category)
    ) {
      continue;
    }

    if (c.level === "close" && c.matchedLine) {
      matched.push(c.matchedLine);
    }
    if (c.level === "partial" && c.matchedLineSoft) {
      matched.push(c.matchedLineSoft);
    }
    if ((c.level === "partial" || c.level === "mismatch") && c.differentLine) {
      different.push(c.differentLine);
    }
  }

  if (row.matchPercent >= 70 && matched.length < 2) {
    const partialCandidates = categories
      .filter(
        (c) =>
          VOICE_MATCH_COMPARISON_CATEGORIES.has(c.category) &&
          c.level === "partial"
      )
      .map((c) => c.matchedLineSoft)
      .filter((line): line is string => Boolean(line));

    for (const line of partialCandidates) {
      if (matched.length >= 3) break;
      if (!matched.includes(line)) matched.push(line);
    }
  }

  const qualityCat = categories.find((c) => c.category === "recording_quality");
  if (
    qualityCat &&
    (qualityCat.level === "partial" || qualityCat.level === "mismatch") &&
    qualityCat.differentLine &&
    !different.includes(qualityCat.differentLine)
  ) {
    different.push(qualityCat.differentLine);
  }

  return { matched: matched.slice(0, 3), different, recordingQualityNote };
}

/** @deprecated Prefer featureTags chips + formatFeatureTagLabel in the lab UI. */
export function formatBestMatchExplanation(reasons: string[]): string {
  return formatFeatureTagsExplanation(normalizeFeatureTagIds(reasons));
}

/** Filename-only: real_voice_1.wav never top match; moved to list bottom. */
export function applyRealVoice1Demotion(
  results: AiVoiceMatchResult[]
): AiVoiceMatchResult[] {
  const rv1 = results.filter((r) => isRealVoice1Filename(r.filename));
  if (rv1.length === 0) {
    return results;
  }
  const others = results.filter((r) => !isRealVoice1Filename(r.filename));
  const reordered = [
    ...others,
    ...rv1.map((r) => ({
      ...r,
      forceDemotedRealVoice1: true,
      isTopMatch: false,
    })),
  ];
  return reordered.map((row, index) => ({
    ...row,
    index,
    isTopMatch: index === 0,
  }));
}

/** When max−min final_ranking_score is below this, use rank-order % instead of min–max. */
export const MATCH_PERCENT_EQUAL_SCORE_THRESHOLD = 0.01;

/** Below this spread (but above equal threshold), nudge scores by rank before min–max. */
const MATCH_PERCENT_SOFT_SPREAD_THRESHOLD = 5;

/** Per-index penalty added in soft-spread mode (lower score = better; index 0 unchanged). */
const MATCH_PERCENT_SOFT_SPREAD_EPSILON = 0.001;

function roundMatchPercent(pct: number): number {
  return Math.round(pct * 10) / 10;
}

/**
 * Rank-order fallback when scores are identical or too close for min–max.
 * API order = rank order; only index 0 receives 100%.
 *
 * | index | length ≤ 4 | length > 4 (e.g. 10) |
 * |-------|------------|----------------------|
 * | 0     | 100%       | 100%                 |
 * | 1     | 75%        | ~88.9%               |
 * | 2     | 50%        | ~77.8%               |
 * | 3     | 25%        | ~66.7%               |
 * | 4+    | max(0, 100−25×n) or linear decay |
 */
export function rankFallbackMatchPercent(index: number, length: number): number {
  if (length <= 1) return 100;
  if (length <= 4) return Math.max(0, 100 - index * 25);
  return Math.max(0, (100 * (length - 1 - index)) / (length - 1));
}

/** Ensure display % strictly decreases by rank (only row 0 may be 100%). */
function enforceStrictlyDecreasingMatchPercents(
  percents: number[],
  length: number
): number[] {
  if (length <= 1) return percents;

  const out = percents.map(roundMatchPercent);
  for (let i = 1; i < out.length; i++) {
    if (out[i] >= out[i - 1]) {
      const rankCap = rankFallbackMatchPercent(i, length);
      out[i] = roundMatchPercent(
        Math.min(out[i], rankCap, Math.max(0, out[i - 1] - 0.1))
      );
      if (out[i] >= out[i - 1]) {
        out[i] = roundMatchPercent(Math.max(0, out[i - 1] - 0.1));
      }
    }
  }
  return out;
}

/**
 * Map final_ranking_score to 0–100% for display (min–max over the result set).
 * Backend sorts descending by final_ranking_score (higher = better match).
 * Preserves row order; single row → 100%.
 *
 * Verification:
 * - [50, 50, 50] → 100%, 75%, 50% (equal-score rank fallback)
 * - [80, 70, 60] → 100%, 50%, 0% (higher score = higher %)
 */
export function normalizeFinalRankingScoresForDisplay(
  results: AiVoiceMatchResult[]
): AiVoiceMatchResult[] {
  if (results.length === 0) return results;
  if (results.length === 1) {
    return [{ ...results[0], matchPercent: 100 }];
  }

  const length = results.length;
  const scores = results.map((r) => r.finalRankingScore);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const spread = max - min;

  let percents: number[];

  if (spread < MATCH_PERCENT_EQUAL_SCORE_THRESHOLD) {
    percents = results.map((_, index) =>
      rankFallbackMatchPercent(index, length)
    );
  } else {
    const useSoftSpread = spread < MATCH_PERCENT_SOFT_SPREAD_THRESHOLD;
    const effectiveScores = useSoftSpread
      ? results.map(
          (row, index) =>
            row.finalRankingScore - index * MATCH_PERCENT_SOFT_SPREAD_EPSILON
        )
      : scores;

    const adjMin = Math.min(...effectiveScores);
    const adjMax = Math.max(...effectiveScores);
    const adjSpread = adjMax - adjMin;

    if (adjSpread < MATCH_PERCENT_EQUAL_SCORE_THRESHOLD) {
      percents = results.map((_, index) =>
        rankFallbackMatchPercent(index, length)
      );
    } else {
      percents = results.map((row, index) => {
        const raw = useSoftSpread
          ? effectiveScores[index]
          : row.finalRankingScore;
        return ((raw - adjMin) / adjSpread) * 100;
      });
    }
  }

  const finalized = enforceStrictlyDecreasingMatchPercents(percents, length);

  return results.map((row, index) => ({
    ...row,
    matchPercent: finalized[index],
  }));
}

/**
 * Cap display match % at 92% unless exact same voice (then 100%).
 * Runs after normalizeFinalRankingScoresForDisplay; re-applies strict decrease if needed.
 */
export function applyMatchPercentDisplayCap(
  results: AiVoiceMatchResult[]
): AiVoiceMatchResult[] {
  if (results.length === 0) return results;

  const length = results.length;
  const percents = results.map((row) => {
    if (isExactSameVoice(row)) return 100;
    return roundMatchPercent(
      Math.min(row.matchPercent, MAX_DISPLAY_MATCH_PERCENT)
    );
  });

  const finalized = enforceStrictlyDecreasingMatchPercents(percents, length);

  return results.map((row, index) => ({
    ...row,
    matchPercent: finalized[index],
  }));
}

/** Re-apply strict rank-order decrease after per-row display adjustments. */
function applyStrictDecreaseToResults(
  results: AiVoiceMatchResult[]
): AiVoiceMatchResult[] {
  if (results.length <= 1) return results;
  const percents = enforceStrictlyDecreasingMatchPercents(
    results.map((r) => r.matchPercent),
    results.length
  );
  return results.map((row, index) => ({
    ...row,
    matchPercent: percents[index],
  }));
}

/** Display-only cap from vocal-type alignment (does not affect ranking order). */
export function resolveVocalTypeMatchPercentCap(
  row: AiVoiceMatchResult,
  aiType: string
): number | null {
  const demoType = classifyVocalTypeLabel(
    demoVocalType(row),
    row.highPitchedMale === true
  );
  const genderMismatch = isVocalTypeGenderMismatch(row, aiType, demoType);
  if (!genderMismatch && row.vocalTypeMatch !== false) return null;

  return VOCAL_TYPE_MISMATCH_MAX_PERCENT;
}

/**
 * Cap matchPercent by vocal type (male vs female AI, high-pitched male, etc.).
 * Display only — does not change final_ranking_score sort order.
 */
export function applyVocalTypeMatchPercentCap(
  results: AiVoiceMatchResult[],
  aiContext?: MatchComparisonAiContext
): AiVoiceMatchResult[] {
  if (results.length === 0) return results;

  const ctx =
    aiContext ?? buildMatchComparisonAiContext(results) ?? undefined;
  const aiType =
    ctx?.aiDetectedVocalType ?? results[0]?.aiDetectedVocalType ?? "unknown";

  const capped = results.map((row) => {
    const cap = resolveVocalTypeMatchPercentCap(row, aiType);
    if (cap == null) return row;
    return {
      ...row,
      matchPercent: roundMatchPercent(Math.min(row.matchPercent, cap)),
    };
  });

  return applyStrictDecreaseToResults(capped);
}

/**
 * Align display matchPercent with explanation bullets (display only).
 *
 * Bands (reference):
 * - 90%+ exact same voice only (applyMatchPercentDisplayCap)
 * - 70–85 multiple strong matched lines
 * - 50–69 partial
 * - <50 weak (vocal type mismatch capped at 49)
 */
export function reconcileMatchPercentWithExplanation(
  row: AiVoiceMatchResult,
  sections: {
    matched: string[];
    different: string[];
    recordingQualityNote: string;
  }
): AiVoiceMatchResult {
  let matchPercent = row.matchPercent;
  const closeCount = sections.matched.length;

  if (matchPercent >= 70 && closeCount < 2) {
    matchPercent = Math.min(matchPercent, MATCH_PERCENT_INSUFFICIENT_EVIDENCE_CAP);
  }

  const aiType = row.aiDetectedVocalType ?? "unknown";
  const vocalCap = resolveVocalTypeMatchPercentCap(row, aiType);
  if (vocalCap != null) {
    matchPercent = Math.min(matchPercent, vocalCap);
  } else if (row.vocalTypeMatch === false) {
    matchPercent = Math.min(matchPercent, VOCAL_TYPE_MISMATCH_MAX_PERCENT);
  }

  if (isExactSameVoice(row)) {
    matchPercent = 100;
  } else {
    matchPercent = roundMatchPercent(
      Math.min(matchPercent, MAX_DISPLAY_MATCH_PERCENT)
    );
  }

  return { ...row, matchPercent };
}

/**
 * Final display pass: vocal-type cap + reconcile % with comparison bullets.
 * Call after normalize + applyMatchPercentDisplayCap + buildMatchComparisonSections.
 */
export function finalizeMatchDisplayForResults(
  results: AiVoiceMatchResult[],
  aiContext?: MatchComparisonAiContext
): AiVoiceMatchResult[] {
  if (results.length === 0) return results;

  const ctx =
    aiContext ?? buildMatchComparisonAiContext(results) ?? undefined;
  const vocalCapped = applyVocalTypeMatchPercentCap(results, ctx);
  const reconciled = vocalCapped.map((row) => {
    const sections = buildMatchComparisonSections(row, ctx);
    let updated = reconcileMatchPercentWithExplanation(row, sections);
    if (isGenderCriticalMismatch(row, ctx)) {
      updated = {
        ...updated,
        matchPercent: roundMatchPercent(
          Math.min(updated.matchPercent, VOCAL_TYPE_MISMATCH_MAX_PERCENT)
        ),
      };
    }
    return updated;
  });
  return applyStrictDecreaseToResults(reconciled);
}

/** Pick backend rank/score field (higher = better match; matches API sort). */
export function resolveApiRankingScore(row: VoiceMatchApiRow): number {
  const candidates: unknown[] = [
    row.final_ranking_score,
    row.final_score,
    row.score,
    row.similarity,
  ];
  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return 0;
}

/** Use API match_percent when present and finite. */
export function resolveApiMatchPercent(row: VoiceMatchApiRow): number | null {
  if (
    typeof row.match_percent === "number" &&
    Number.isFinite(row.match_percent)
  ) {
    return roundMatchPercent(
      Math.max(0, Math.min(100, row.match_percent))
    );
  }
  return null;
}

/** One row from POST /voice-match (pre-sorted by backend rank; do not re-sort). */
export type VoiceMatchApiRow = {
  index?: number;
  is_top_match?: boolean;
  filename: string;
  /** Client upload label when multipart filenames are generic (demo_0.wav). */
  original_filename?: string;
  similarity: number;
  final_ranking_score?: number;
  final_score?: number;
  score?: number;
  match_percent?: number;
  vocal_type_match?: boolean;
  pitch_avg?: number;
  detected_vocal_type?: string;
  manual_gender?: string | null;
  final_vocal_type?: string;
  similarity_to_real_voice_1?: boolean;
  high_pitched_male?: boolean;
  prototype_pitch_timbre_similarity?: number;
  hard_gender_block_applied?: boolean;
  force_demoted_real_voice_1?: boolean;
  exact_voice_match?: boolean;
  ai_detected_vocal_type?: string;
  ai_pitch_avg?: number;
  explanation?: string;
  chunks_used?: number;
  confidence?: number;
  speaker_score?: number;
  timbre_score?: number;
  pitch_score?: number;
  quality_score?: number;
  vocal_character_score?: number;
  feedback_boost?: number;
  reasons: string[];
  feature_tags?: string[];
};

export type VoiceMatchApiResponse = VoiceMatchApiRow[];

/** Partial / degraded match when the service ran out of time budget. */
export type VoiceMatchApiEnvelope = {
  results: VoiceMatchApiRow[];
  partial?: boolean;
  top_match_index?: number;
  top_match_filename?: string;
  hard_gender_rule_active?: boolean;
  ai_reference?: {
    pitch_avg?: number;
    vocal_type?: string;
    timbre_score_baseline?: number;
  };
};

/** AI reference context for per-row comparison bullets (from first result or envelope). */
export function buildMatchComparisonAiContext(
  results: Pick<AiVoiceMatchResult, "aiDetectedVocalType" | "aiPitchAvg">[]
): MatchComparisonAiContext | undefined {
  const first = results[0];
  if (!first) return undefined;
  const aiType = first.aiDetectedVocalType ?? "unknown";
  const aiPitch = first.aiPitchAvg ?? null;
  return {
    aiDetectedVocalType: aiType,
    aiPitchAvg: aiPitch,
    categoryLabels: {
      vocal_type: classifyVocalTypeLabel(aiType, false),
      vocal_range: classifyVocalRangeLabel(aiPitch),
      timbre: classifyTimbreLabel(null, aiPitch),
      brightness: classifyBrightnessLabel(null, aiPitch),
      recording_quality: "clean",
      voice_character: "similar",
    },
  };
}

export type VoiceMatchDemoInput = {
  id: string;
  name: string;
  originalFileName: string;
  audioUrl: string;
  file: File;
};

async function resolveDemoFile(demo: VocalistDemoItem): Promise<File> {
  if (demo.file) return demo.file;

  const response = await fetch(demo.audioUrl);
  if (!response.ok) {
    throw new Error(`Could not load demo audio for "${demo.name}".`);
  }
  const blob = await response.blob();
  const ext =
    demo.audioUrl.match(/\.(wav|mp3|ogg|m4a|flac|aac)(\?|$)/i)?.[1]?.toLowerCase() ??
    "mp3";
  return new File([blob], demo.originalFileName || `${demo.name}.${ext}`, {
    type: blob.type || `audio/${ext}`,
  });
}

function matchDemoToApiRow(
  demo: VoiceMatchDemoInput,
  row: VoiceMatchApiRow
): boolean {
  const original =
    typeof row.original_filename === "string" && row.original_filename
      ? row.original_filename
      : row.filename;
  return (
    original === demo.originalFileName ||
    row.filename === demo.originalFileName ||
    row.filename === demo.file.name ||
    row.filename.startsWith(`${demo.name}.`) ||
    row.filename.replace(/\.[^.]+$/, "") === demo.name
  );
}

function formatApiDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === "object" && "msg" in item) {
          return String((item as { msg: unknown }).msg);
        }
        return JSON.stringify(item);
      })
      .join("; ");
  }
  if (detail != null) return JSON.stringify(detail);
  return "";
}

function finiteScore(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Pitch label for lab UI from pitch_avg (MIDI); "unknown" when not measured. */
export function formatVoiceMatchPitchLabel(
  pitchAvg: number | null | undefined
): string {
  if (typeof pitchAvg === "number" && Number.isFinite(pitchAvg) && pitchAvg > 0) {
    return pitchAvg % 1 === 0
      ? String(Math.round(pitchAvg))
      : pitchAvg.toFixed(1);
  }
  return "unknown";
}

/** Russian UI label from final_vocal_type (source of truth), not detected. */
export function resolveDisplayVocalType(
  result: Pick<AiVoiceMatchResult, "finalVocalType" | "highPitchedMale">
): string {
  if (result.highPitchedMale === true) {
    return "высокий мужской";
  }
  const t = (result.finalVocalType ?? "unknown").toLowerCase();
  if (t === "female") return "женский";
  if (t === "male") return "мужской";
  return "неопределён";
}

/** User-facing vocal type line for lab rows. */
export function formatDisplayVocalType(
  result: Pick<AiVoiceMatchResult, "displayVocalType">
): string {
  return `Тип голоса: ${result.displayVocalType}`;
}

/** DEV-only: detected, manual, final, pitch_avg (no hi-male / rank shorthand). */
export function formatVoiceMatchGenderDebugLine(
  result: Pick<
    AiVoiceMatchResult,
    | "detectedVocalType"
    | "manualGender"
    | "finalVocalType"
    | "pitchAvg"
    | "highPitchedMale"
    | "hardGenderBlockApplied"
    | "forceDemotedRealVoice1"
  >
): string {
  const manual =
    result.manualGender === "male" || result.manualGender === "female"
      ? result.manualGender
      : "—";
  const parts = [
    `detected: ${result.detectedVocalType || "unknown"}`,
    `manual: ${manual}`,
    `final: ${result.finalVocalType || "unknown"}`,
    `pitch_avg: ${formatVoiceMatchPitchLabel(result.pitchAvg)}`,
  ];
  if (result.highPitchedMale) {
    parts.push("high_pitched_male: true");
  }
  if (result.hardGenderBlockApplied) {
    parts.push("hard_gender_block: true");
  }
  if (result.forceDemotedRealVoice1) {
    parts.push("force_demoted_rv1: true");
  }
  return parts.join(" · ");
}

function mapScoreBreakdown(row: VoiceMatchApiRow): VoiceMatchScoreBreakdown {
  return {
    speakerScore: finiteScore(row.speaker_score),
    timbreScore: finiteScore(row.timbre_score),
    pitchScore: finiteScore(row.pitch_score),
    qualityScore: finiteScore(row.quality_score),
      vocalCharacterScore: finiteScore(row.vocal_character_score),
  };
}

function voiceMatchHttpError(status: number, detail: string): Error {
  return new Error(
    `Voice match API error (HTTP ${status})${detail ? `: ${detail}` : ""}`
  );
}

function logFormDataPayload(
  aiVocalFile: File,
  demoInputs: VoiceMatchDemoInput[]
): void {
  console.log("[voice-match] FormData:", {
    ai_vocal: aiVocalFile.name,
    ai_vocal_size: aiVocalFile.size,
    demos_count: demoInputs.length,
    demo_display_names: demoInputs.map((d) => d.originalFileName),
    demo_upload_filenames: demoInputs.map((d) => d.file.name),
  });
}

/** Build multipart body: field `ai_vocal` + repeated `demos`. */
export function buildVoiceMatchFormData(
  aiVocalFile: File,
  demos: VocalistDemoItem[],
  queryTags?: Record<string, string[]>,
  genderOverride?: string
): { formData: FormData; demoInputs: VoiceMatchDemoInput[] } {
  if (!aiVocalFile.size) {
    throw new Error("AI vocal file is empty.");
  }
  if (demos.length === 0) {
    throw new Error("Add at least one vocalist demo file.");
  }

  const demoInputs: VoiceMatchDemoInput[] = demos.map((demo) => {
    if (!demo.file?.size) {
      throw new Error(`Demo file is missing or empty: ${demo.name}`);
    }
    const originalFileName =
      demo.originalFileName?.trim() || demo.file.name || demo.name;
    return {
      id: demo.id,
      name: demo.name,
      originalFileName,
      audioUrl: demo.audioUrl,
      file: demo.file,
    };
  });

  const formData = new FormData();
  formData.append("ai_vocal", aiVocalFile, aiVocalFile.name);
  formData.append(
    "demo_display_names",
    JSON.stringify(demoInputs.map((d) => d.originalFileName))
  );
  for (const demo of demoInputs) {
    formData.append("demos", demo.file, demo.originalFileName);
  }

  if (queryTags && Object.keys(queryTags).length > 0) {
    formData.append("query_tags", JSON.stringify(queryTags));
  }
  if (genderOverride && genderOverride !== "auto") {
    formData.append("gender_override", genderOverride);
  }
  return { formData, demoInputs };
}

function parseVoiceMatchResponseText(
  responseText: string,
  status: number
): { rows: VoiceMatchApiResponse; aiReference?: VoiceMatchApiEnvelope["ai_reference"] } {
  if (!responseText.trim()) {
    throw voiceMatchHttpError(status, "Empty response body");
  }

  let parsed: VoiceMatchApiResponse | VoiceMatchApiEnvelope;
  try {
    parsed = JSON.parse(responseText) as
      | VoiceMatchApiResponse
      | VoiceMatchApiEnvelope;
  } catch {
    throw new Error(
      `Voice match API returned invalid JSON (HTTP ${status}).`
    );
  }

  if (Array.isArray(parsed)) {
    return { rows: parsed };
  }
  if (parsed && Array.isArray(parsed.results)) {
    if (parsed.partial) {
      console.warn("[voice-match] partial results (degraded mode)");
    }
    return { rows: parsed.results, aiReference: parsed.ai_reference };
  }
  throw new Error("Voice match API returned unexpected JSON shape.");
}

function formatVoiceMatchHttpErrorDetail(
  responseText: string,
  status: number
): string {
  if (!responseText.trim()) return `HTTP ${status}`;
  try {
    const json = JSON.parse(responseText) as {
      detail?: unknown;
      message?: string;
      error?: string;
      step?: string;
    };
    if (typeof json.error === "string" && json.error) {
      const step =
        typeof json.step === "string" && json.step ? ` (step: ${json.step})` : "";
      return `${json.error}${step}`;
    }
    const fromDetail = formatApiDetail(json.detail);
    if (fromDetail) return fromDetail;
    if (typeof json.message === "string" && json.message) return json.message;
    return responseText;
  } catch {
    return responseText;
  }
}

/** Map API JSON rows to lab display models (preserves backend order). */
export function mapVoiceMatchResultsFromApi(
  responseText: string,
  status: number,
  demoInputs: VoiceMatchDemoInput[]
): AiVoiceMatchResult[] {
  if (status < 200 || status >= 300) {
    throw voiceMatchHttpError(
      status,
      formatVoiceMatchHttpErrorDetail(responseText, status)
    );
  }

  const { rows, aiReference } = parseVoiceMatchResponseText(responseText, status);

  console.log("[voice-match] API results (raw):", rows);
  console.log(
    "[voice-match] score fields per row:",
    rows.map((row) => ({
      filename: row.filename,
      final_ranking_score: row.final_ranking_score,
      final_score: row.final_score,
      score: row.score,
      similarity: row.similarity,
      match_percent: row.match_percent,
      resolved_rank: resolveApiRankingScore(row),
    }))
  );

  // Preserve backend order; do not re-sort client-side.
  const mapped = rows.map((row, listIndex) => {
      const demo =
        demoInputs.find((d) => matchDemoToApiRow(d, row)) ??
        demoInputs.find((d) => row.filename.includes(d.name));

      const finalRankingScore = resolveApiRankingScore(row);
      const apiMatchPercent = resolveApiMatchPercent(row);

      const index =
        typeof row.index === "number" && Number.isFinite(row.index)
          ? row.index
          : listIndex;
      const isTopMatch = row.is_top_match === true;

      const detectedVocalType =
        typeof row.detected_vocal_type === "string"
          ? row.detected_vocal_type
          : "unknown";
      const finalVocalType =
        typeof row.final_vocal_type === "string" && row.final_vocal_type
          ? row.final_vocal_type
          : detectedVocalType;
      const highPitchedMale =
        row.high_pitched_male === true ? true : undefined;

      const resultFilename =
        typeof row.original_filename === "string" && row.original_filename
          ? row.original_filename
          : row.filename;

      return {
        id: demo?.id ?? `result-${resultFilename}`,
        index,
        isTopMatch,
        filename: resultFilename,
        vocalistName:
          demo?.name ?? resultFilename.replace(/\.[^.]+$/, ""),
        similarity: row.similarity,
        matchPercent: apiMatchPercent ?? 0,
        finalRankingScore,
        vocalTypeMatch: row.vocal_type_match !== false,
        pitchAvg: finiteScore(row.pitch_avg),
        detectedVocalType,
        manualGender:
          row.manual_gender === "male" || row.manual_gender === "female"
            ? row.manual_gender
            : null,
        finalVocalType,
        similarityToRealVoice1:
          row.similarity_to_real_voice_1 === true ? true : undefined,
        highPitchedMale,
        displayVocalType: resolveDisplayVocalType({
          finalVocalType,
          highPitchedMale,
        }),
        hardGenderBlockApplied:
          row.hard_gender_block_applied === true ? true : undefined,
        forceDemotedRealVoice1:
          row.force_demoted_real_voice_1 === true ? true : undefined,
        exactVoiceMatch: row.exact_voice_match === true ? true : undefined,
        aiDetectedVocalType:
          typeof row.ai_detected_vocal_type === "string"
            ? row.ai_detected_vocal_type
            : typeof aiReference?.vocal_type === "string"
              ? aiReference.vocal_type
              : undefined,
        aiPitchAvg:
          finiteScore(row.ai_pitch_avg) ?? finiteScore(aiReference?.pitch_avg),
        confidence:
          typeof row.confidence === "number" && Number.isFinite(row.confidence)
            ? row.confidence
            : null,
        reasons: Array.isArray(row.reasons) ? row.reasons : [],
        featureTags: normalizeFeatureTagIds(
          Array.isArray(row.feature_tags) ? row.feature_tags : []
        ),
        explanation:
          typeof row.explanation === "string" && row.explanation.trim()
            ? row.explanation.trim()
            : undefined,
        demoAudioUrl: demo?.audioUrl ?? "",
        breakdown: mapScoreBreakdown(row),
      };
    });
  const demoted = applyRealVoice1Demotion(mapped);
  const useApiMatchPercents =
    rows.length > 0 && rows.every((row) => resolveApiMatchPercent(row) !== null);
  const normalized = useApiMatchPercents
    ? demoted.map((row) => {
        const apiPct = resolveApiMatchPercent(
          rows.find((r) => r.filename === row.filename) ?? rows[0]
        );
        return apiPct != null ? { ...row, matchPercent: apiPct } : row;
      })
    : normalizeFinalRankingScoresForDisplay(demoted);
  console.log(
    "[voice-match] matchPercent after normalize:",
    normalized.map((r) => ({
      filename: r.filename,
      finalRankingScore: r.finalRankingScore,
      matchPercent: r.matchPercent,
    }))
  );
  const capped = applyMatchPercentDisplayCap(normalized);
  const aiContext = buildMatchComparisonAiContext(capped) ?? undefined;
  const displayFinalized = finalizeMatchDisplayForResults(capped, aiContext);
  return assignUniqueFeatureTagsToResults(displayFinalized, aiContext);
}

/** POST AI vocal + demos to the voice-matching service. */
export async function runVoiceMatching(
  aiVocalFile: File,
  demos: VocalistDemoItem[],
  selectedQueryTags: string[] = [],
  genderOverride: string = "auto"
): Promise<AiVoiceMatchResult[]> {
  const { formData, demoInputs } = buildVoiceMatchFormData(aiVocalFile, demos, selectedQueryTags, genderOverride);
  logFormDataPayload(aiVocalFile, demoInputs);
  console.log("sending voice-match request");
  console.log("[voice-match] POST", VOICE_MATCH_REQUEST_URL);

  let response: Response;
  try {
    response = await fetch(VOICE_MATCH_REQUEST_URL, {
      method: "POST",
      body: formData,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Network request failed";
    console.error("[voice-match] fetch failed:", err);
    throw new Error(
      `Voice match request failed (network/CORS?): ${message}. Target: ${VOICE_MATCH_REQUEST_URL}. If the browser console shows a CORS error, open the Next app at http://localhost:3000 or http://127.0.0.1:3000 (ports 3000–3002 are allowed).`
    );
  }

  console.log("[voice-match] response status:", response.status);
  const responseText = await response.text();
  console.log("[voice-match] response body:", responseText.slice(0, 500));

  return mapVoiceMatchResultsFromApi(responseText, response.status, demoInputs);
}

function mockComparisonRow(
  filename: string,
  overrides: Partial<AiVoiceMatchResult> = {}
): AiVoiceMatchResult {
  const row: AiVoiceMatchResult = {
    id: filename,
    index: 0,
    isTopMatch: false,
    filename,
    vocalistName: filename.replace(/\.[^.]+$/, ""),
    similarity: 70,
    matchPercent: 70,
    finalRankingScore: 70,
    vocalTypeMatch: true,
    pitchAvg: 64,
    detectedVocalType: "female",
    manualGender: null,
    finalVocalType: "female",
    displayVocalType: "женский",
    reasons: [],
    featureTags: [],
    confidence: null,
    demoAudioUrl: "",
    breakdown: {
      speakerScore: 75,
      timbreScore: 75,
      pitchScore: 75,
      qualityScore: 80,
    },
    aiDetectedVocalType: "female",
    aiPitchAvg: 65,
    ...overrides,
  };
  return {
    ...row,
    displayVocalType: resolveDisplayVocalType(row),
  };
}

/** Signature string for uniqueness checks (matched + different bullets). */
export function structuredComparisonSignature(sections: {
  matched: string[];
  different: string[];
}): string {
  return JSON.stringify(sections);
}

/**
 * Dev check: mock real_voice_1/2/3 must produce distinct comparison signatures.
 * Does not affect ranking or matchPercent.
 */
export function verifyStructuredComparisonUniqueness(): {
  real_voice_1: ReturnType<typeof buildMatchComparisonSections>;
  real_voice_2: ReturnType<typeof buildMatchComparisonSections>;
  real_voice_3: ReturnType<typeof buildMatchComparisonSections>;
} {
  const aiContext = buildMatchComparisonAiContext([
    { aiDetectedVocalType: "female", aiPitchAvg: 65 },
  ])!;

  const real_voice_1 = buildMatchComparisonSections(
    mockComparisonRow("real_voice_1.wav", {
      vocalTypeMatch: false,
      pitchAvg: 63.9,
      detectedVocalType: "female",
      finalVocalType: "male",
      manualGender: "male",
      similarityToRealVoice1: true,
      breakdown: {
        speakerScore: 92,
        timbreScore: 90,
        pitchScore: 88,
        qualityScore: 87,
      },
    }),
    aiContext
  );

  const real_voice_2 = buildMatchComparisonSections(
    mockComparisonRow("real_voice_2.wav", {
      pitchAvg: 64,
      breakdown: {
        speakerScore: 85,
        timbreScore: 82,
        pitchScore: 78,
        qualityScore: 90,
      },
    }),
    aiContext
  );

  const real_voice_3 = buildMatchComparisonSections(
    mockComparisonRow("real_voice_3.wav", {
      pitchAvg: 58,
      breakdown: {
        speakerScore: 48,
        timbreScore: 52,
        pitchScore: 45,
        qualityScore: 55,
      },
    }),
    aiContext
  );

  const sig = structuredComparisonSignature;
  if (
    sig(real_voice_1) === sig(real_voice_2) ||
    sig(real_voice_1) === sig(real_voice_3) ||
    sig(real_voice_2) === sig(real_voice_3)
  ) {
    throw new Error(
      "Structured comparison signatures must differ across real_voice_1/2/3"
    );
  }

  return { real_voice_1, real_voice_2, real_voice_3 };
}

/** @deprecated Use verifyStructuredComparisonUniqueness */
export function verifyMatchComparisonExampleVoices(): ReturnType<
  typeof verifyStructuredComparisonUniqueness
> {
  return verifyStructuredComparisonUniqueness();
}

/**
 * Dev check: mock real_voice_1/2/3 must produce distinct featureTags sets.
 * Does not affect ranking or matchPercent.
 */
export function verifyFeatureTagUniqueness(): {
  real_voice_1: string[];
  real_voice_2: string[];
  real_voice_3: string[];
} {
  const aiContext = buildMatchComparisonAiContext([
    { aiDetectedVocalType: "female", aiPitchAvg: 65 },
  ])!;

  const rows: AiVoiceMatchResult[] = [
    mockComparisonRow("real_voice_1.wav", {
      vocalTypeMatch: false,
      pitchAvg: 63.9,
      detectedVocalType: "female",
      finalVocalType: "male",
      manualGender: "male",
      similarityToRealVoice1: true,
      breakdown: {
        speakerScore: 92,
        timbreScore: 90,
        pitchScore: 88,
        qualityScore: 87,
      },
    }),
    mockComparisonRow("real_voice_2.wav", {
      pitchAvg: 64,
      breakdown: {
        speakerScore: 85,
        timbreScore: 82,
        pitchScore: 78,
        qualityScore: 90,
      },
    }),
    mockComparisonRow("real_voice_3.wav", {
      pitchAvg: 58,
      breakdown: {
        speakerScore: 48,
        timbreScore: 52,
        pitchScore: 45,
        qualityScore: 55,
      },
    }),
  ];

  const tagged = assignUniqueFeatureTagsToResults(rows, aiContext);
  const sig = featureTagSetSignature;
  const t1 = tagged[0].featureTags;
  const t2 = tagged[1].featureTags;
  const t3 = tagged[2].featureTags;

  if (
    sig(t1) === sig(t2) ||
    sig(t1) === sig(t3) ||
    sig(t2) === sig(t3)
  ) {
    throw new Error(
      "Feature tag sets must differ across real_voice_1/2/3 mock rows"
    );
  }

  return { real_voice_1: t1, real_voice_2: t2, real_voice_3: t3 };
}

/**
 * Dev check: display % and explanations align with vocal-type rules.
 * Does not affect ranking or backend sort order.
 */
export function verifyMatchDisplaySanity(): {
  maleVsFemaleAi: {
    matchPercent: number;
    sections: ReturnType<typeof buildMatchComparisonSections>;
  };
  femaleMatch75: {
    matchPercent: number;
    matchedCount: number;
  };
} {
  const aiContext = buildMatchComparisonAiContext([
    { aiDetectedVocalType: "female", aiPitchAvg: 65 },
  ])!;

  const maleRow = mockComparisonRow("male_demo.wav", {
    vocalTypeMatch: false,
    detectedVocalType: "male",
    finalVocalType: "male",
    pitchAvg: 55,
    matchPercent: 88,
    breakdown: {
      speakerScore: 80,
      timbreScore: 78,
      pitchScore: 70,
      qualityScore: 90,
    },
  });

  const femaleRow = mockComparisonRow("female_demo.wav", {
    matchPercent: 75,
    breakdown: {
      speakerScore: 85,
      timbreScore: 82,
      pitchScore: 80,
      qualityScore: 85,
    },
  });

  const pipelineRows = finalizeMatchDisplayForResults(
    applyMatchPercentDisplayCap(
      normalizeFinalRankingScoresForDisplay([maleRow, femaleRow])
    ),
    aiContext
  );

  const maleResult = pipelineRows[0];
  const femaleResult = pipelineRows.find((r) => r.filename === "female_demo.wav")!;
  const maleSections = buildMatchComparisonSections(maleResult, aiContext);
  const femaleSections = buildMatchComparisonSections(femaleResult, aiContext);

  if (maleResult.matchPercent > VOCAL_TYPE_MISMATCH_MAX_PERCENT) {
    throw new Error(
      `female AI + male demo: matchPercent must be <= ${VOCAL_TYPE_MISMATCH_MAX_PERCENT}, got ${maleResult.matchPercent}`
    );
  }
  if (maleSections.matched.length > 0) {
    throw new Error(
      `female AI + male demo: matched must be empty, got ${maleSections.matched.length}`
    );
  }
  if (
    !maleSections.different.some(
      (s) =>
        s.includes("не подходит") ||
        s.includes("Мужской тип голоса") ||
        s.includes("не совпадает с AI-референсом")
    )
  ) {
    throw new Error(
      "female AI + male demo: different must include vocal type rejection"
    );
  }
  if (
    !maleSections.different.includes(
      "Голоса принципиально несовместимы по типу."
    )
  ) {
    throw new Error(
      "female AI + male demo: different must include incompatibility note"
    );
  }
  if (
    maleSections.matched.some((s) => s.includes("Качество записи")) ||
    maleSections.different.some((s) => s.includes("Качество записи"))
  ) {
    throw new Error("recording quality must not appear in matched/different");
  }
  if (maleSections.recordingQualityNote !== "Качество записи: чистая") {
    throw new Error(
      `recordingQualityNote expected clean label, got ${maleSections.recordingQualityNote}`
    );
  }
  if (filterVoiceMatchFeatureTags(buildFeatureTags(maleRow, aiContext)).some(isRecordingFeatureTag)) {
    throw new Error("recording tags must be excluded from voice-match chips");
  }
  const maleMatchChips = filterMatchFeatureTags(
    buildFeatureTags(maleResult, aiContext),
    maleResult
  );
  if (maleMatchChips.length > 0) {
    throw new Error(
      `male vs female AI: match chips must be empty, got ${maleMatchChips.join(", ")}`
    );
  }

  if (femaleSections.matched.length < 2) {
    throw new Error(
      `female match 75%: need >= 2 matched lines, got ${femaleSections.matched.length}`
    );
  }

  return {
    maleVsFemaleAi: {
      matchPercent: maleResult.matchPercent,
      sections: maleSections,
    },
    femaleMatch75: {
      matchPercent: femaleResult.matchPercent,
      matchedCount: femaleSections.matched.length,
    },
  };
}

/** Dev check: female top match must not show mismatch tags in match chips. */
export function verifyMatchFeatureTagFiltering(): {
  mismatchTagIds: string[];
  femaleTopMatchChips: string[];
  highPitchedMaleInChips: boolean;
} {
  const aiContext = buildMatchComparisonAiContext([
    { aiDetectedVocalType: "female", aiPitchAvg: 65 },
  ])!;

  const femaleTop = mockComparisonRow("female_top.wav", {
    index: 0,
    isTopMatch: true,
    vocalTypeMatch: true,
    matchPercent: 82,
    breakdown: {
      speakerScore: 88,
      timbreScore: 85,
      pitchScore: 82,
      qualityScore: 90,
    },
  });

  const highPitchedMale = mockComparisonRow("high_male.wav", {
    index: 1,
    isTopMatch: false,
    highPitchedMale: true,
    vocalTypeMatch: false,
    detectedVocalType: "male",
    finalVocalType: "male",
    pitchAvg: 68,
    matchPercent: 40,
    breakdown: {
      speakerScore: 70,
      timbreScore: 72,
      pitchScore: 65,
      qualityScore: 80,
    },
  });

  const tagged = assignUniqueFeatureTagsToResults(
    [femaleTop, highPitchedMale],
    aiContext
  );
  const top = tagged[0];
  const chips =
    top.matchFeatureTags ?? filterMatchFeatureTags(top.featureTags, top);

  const mismatchTagIds = [
    ...MISMATCH_FEATURE_TAG_IDS,
    "range_mismatch_*",
    "timbre_mismatch_*",
    "brightness_mismatch_*",
  ];

  const highPitchedMaleInChips = chips.includes("high_pitched_male");
  if (highPitchedMaleInChips) {
    throw new Error(
      "female top match: high_pitched_male must not appear in filterMatchFeatureTags output"
    );
  }
  if (chips.some((t) => isMismatchFeatureTag(t))) {
    throw new Error(
      `female top match: match chips must not include mismatch tags: ${chips.join(", ")}`
    );
  }

  const hpBuilt = buildFeatureTags(highPitchedMale, aiContext);
  if (!hpBuilt.includes("high_pitched_male")) {
    throw new Error(
      "high-pitched male vs female AI: buildFeatureTags must still emit high_pitched_male"
    );
  }
  const hpChips = filterMatchFeatureTags(hpBuilt, highPitchedMale);
  if (hpChips.includes("high_pitched_male")) {
    throw new Error(
      "high-pitched male row: high_pitched_male must be excluded from match chips"
    );
  }

  return {
    mismatchTagIds,
    femaleTopMatchChips: chips,
    highPitchedMaleInChips,
  };
}
