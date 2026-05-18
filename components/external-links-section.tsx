"use client";

import {
  EXTERNAL_LINK_FIELDS,
  normalizeExternalUrl,
  type ExternalLinks,
} from "@/lib/external-links";

type ExternalLinksEditorProps = {
  links: ExternalLinks;
  onChange: (links: ExternalLinks) => void;
};

export function ExternalLinksEditor({ links, onChange }: ExternalLinksEditorProps) {
  const inputClass =
    "w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-2.5 text-sm outline-none ring-purple-500/50 placeholder:text-zinc-500 focus:ring-2";

  return (
    <section className="space-y-3 rounded-xl border border-white/10 bg-black/30 p-5">
      <div>
        <h3 className="text-lg font-semibold text-zinc-100">External Links</h3>
        <p className="mt-1 text-sm text-zinc-400">Share where people can hear and follow you.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {EXTERNAL_LINK_FIELDS.map(({ key, label, placeholder }) => (
          <label key={key} className="block text-sm">
            <span className="mb-1.5 block text-zinc-300">{label}</span>
            <input
              type="url"
              value={links[key] ?? ""}
              onChange={(e) => onChange({ ...links, [key]: e.target.value })}
              onBlur={(e) => {
                const normalized = normalizeExternalUrl(e.target.value);
                if (normalized !== e.target.value) {
                  onChange({ ...links, [key]: normalized });
                }
              }}
              placeholder={placeholder}
              className={inputClass}
            />
          </label>
        ))}
      </div>
    </section>
  );
}

type ExternalLinksDisplayProps = {
  links?: ExternalLinks | null;
};

export function ExternalLinksDisplay({ links }: ExternalLinksDisplayProps) {
  const items = EXTERNAL_LINK_FIELDS.filter(({ key }) => links?.[key]?.trim());

  if (items.length === 0) return null;

  return (
    <section className="mt-6 rounded-xl border border-white/10 bg-zinc-900/50 p-4">
      <p className="text-sm font-medium text-zinc-200">External Links</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {items.map(({ key, label }) => {
          const href = normalizeExternalUrl(links![key]!);
          return (
            <li key={key}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-100 transition hover:border-cyan-300/50 hover:bg-cyan-500/20"
              >
                {label} ↗
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
