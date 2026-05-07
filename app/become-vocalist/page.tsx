"use client";

import { FormEvent, useState } from "react";
import { AnimatedButton } from "@/components/animated-button";

export default function BecomeVocalistPage() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    genres: "",
    tags: "",
    demoLink: "",
    about: "",
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
  };

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white md:px-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Become a Vocalist</h1>
        <p className="mt-3 text-zinc-400">
          Fill a short profile form. Data is local-only for this MVP demo.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-zinc-950/60 p-6"
        >
          <input
            required
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="Artist name"
            className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none ring-purple-500/50 placeholder:text-zinc-500 focus:ring-2"
          />
          <input
            required
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            placeholder="Email"
            className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none ring-purple-500/50 placeholder:text-zinc-500 focus:ring-2"
          />
          <input
            value={form.genres}
            onChange={(event) => setForm({ ...form, genres: event.target.value })}
            placeholder="Genres (e.g. EDM, Pop, House)"
            className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none ring-purple-500/50 placeholder:text-zinc-500 focus:ring-2"
          />
          <input
            value={form.tags}
            onChange={(event) => setForm({ ...form, tags: event.target.value })}
            placeholder="Voice tags (e.g. warm, airy, powerful)"
            className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none ring-purple-500/50 placeholder:text-zinc-500 focus:ring-2"
          />
          <input
            value={form.demoLink}
            onChange={(event) => setForm({ ...form, demoLink: event.target.value })}
            placeholder="Demo link (SoundCloud, Drive, etc.)"
            className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none ring-purple-500/50 placeholder:text-zinc-500 focus:ring-2"
          />
          <textarea
            rows={4}
            value={form.about}
            onChange={(event) => setForm({ ...form, about: event.target.value })}
            placeholder="Short bio"
            className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none ring-purple-500/50 placeholder:text-zinc-500 focus:ring-2"
          />

          <AnimatedButton
            type="submit"
            variant="primary"
            className="inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium"
          >
            Submit Profile
          </AnimatedButton>

          {submitted && (
            <p className="text-sm text-emerald-300">
              Profile submitted locally. Backend integration is intentionally disabled for MVP.
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
