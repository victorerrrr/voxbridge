export type ExternalLinkKey =
  | "spotify"
  | "soundcloud"
  | "youtube"
  | "instagram"
  | "website";

export type ExternalLinks = Partial<Record<ExternalLinkKey, string>>;

export const EXTERNAL_LINK_FIELDS: {
  key: ExternalLinkKey;
  label: string;
  placeholder: string;
}[] = [
  { key: "spotify", label: "Spotify", placeholder: "https://open.spotify.com/..." },
  { key: "soundcloud", label: "SoundCloud", placeholder: "https://soundcloud.com/..." },
  { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/..." },
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/..." },
  { key: "website", label: "Website", placeholder: "https://yoursite.com" },
];

export function normalizeExternalUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function hasExternalLinks(links?: ExternalLinks | null): boolean {
  if (!links) return false;
  return EXTERNAL_LINK_FIELDS.some(({ key }) => Boolean(links[key]?.trim()));
}
