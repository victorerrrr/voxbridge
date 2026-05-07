"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import InternalShell from "@/components/internal-shell";
import { AnimatedButton } from "@/components/animated-button";
import { getStoredUser, type AuthUser } from "@/lib/auth";

const featuredVocalists = [
  { name: "Mia Nova", tags: ["Ethereal", "Pop", "Cinematic"], vibe: "Breathy hooks with modern topline texture." },
  { name: "Ari Voss", tags: ["Indie", "Soul", "Alt-RnB"], vibe: "Warm low-mid tone for emotional drops." },
  { name: "Lex Halo", tags: ["EDM", "Hyperpop", "Vocal chops"], vibe: "Bright transients and clean phrase control." },
];

const beforeAfterDemos = [
  { title: "Raw phone memo -> Radio-ready lead", meta: "Pitch cleanup + doubles + AI harmonies" },
  { title: "Dry chorus -> Wide festival stack", meta: "Stereo width + saturation + timing micro-edits" },
];

const updates = [
  { title: "New matching tags", body: "Added style filters for texture, grit, and falsetto intensity in mock matching flow." },
  { title: "Faster dashboard routing", body: "Internal nav now keeps producer/vocalist shortcuts available from one sidebar." },
];

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const authUser = getStoredUser();
    if (!authUser || !authUser.isAuthenticated) {
      router.replace("/signup");
      return;
    }
    setUser(authUser);
    setIsLoading(false);
  }, [router]);

  if (isLoading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-zinc-300">
        Loading home...
      </main>
    );
  }

  return (
    <InternalShell role={user.role} activeItem="home">
      <div className="space-y-6">
        <section className="rounded-2xl border border-white/10 bg-black/30 p-5">
          <h1 className="text-2xl font-semibold md:text-3xl">Explore the VoxBridge feed</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-300 md:text-base">
            Fresh voices, transformation demos, and product updates in one internal home stream.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-black/30 p-4 xl:col-span-2">
            <h2 className="mb-3 text-lg font-semibold">Featured vocalists</h2>
            <div className="space-y-3">
              {featuredVocalists.map((item) => (
                <article key={item.name} className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <h3 className="font-medium">{item.name}</h3>
                  <p className="mt-1 text-sm text-zinc-300">{item.vibe}</p>
                  <p className="mt-2 text-xs text-purple-200">{item.tags.join(" • ")}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <h2 className="mb-3 text-lg font-semibold">Before / After demos</h2>
            <div className="space-y-3">
              {beforeAfterDemos.map((demo) => (
                <article key={demo.title} className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <h3 className="text-sm font-medium text-zinc-100">{demo.title}</h3>
                  <p className="mt-1 text-xs text-zinc-300">{demo.meta}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <h2 className="mb-3 text-lg font-semibold">Platform updates</h2>
            <div className="space-y-3">
              {updates.map((item) => (
                <article key={item.title} className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <h3 className="text-sm font-medium">{item.title}</h3>
                  <p className="mt-1 text-xs text-zinc-300">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-xl border border-white/10 bg-black/30 p-5">
            <h2 className="text-lg font-semibold">Upload vocal</h2>
            <p className="mt-2 text-sm text-zinc-300">Drop new demos and keep your sonic profile active in matching results.</p>
            <AnimatedButton href="/upload" variant="primary" className="mt-4 inline-flex rounded-lg px-5 py-2.5 text-sm font-medium">
              Upload now
            </AnimatedButton>
          </article>

          <article className="rounded-xl border border-white/10 bg-black/30 p-5">
            <h2 className="text-lg font-semibold">Complete profile</h2>
            <p className="mt-2 text-sm text-zinc-300">Add tags, tone references, and account details to improve discovery quality.</p>
            <AnimatedButton
              href="/dashboard?tab=profile"
              variant="secondary"
              className="mt-4 inline-flex rounded-lg px-5 py-2.5 text-sm font-medium"
            >
              Open profile
            </AnimatedButton>
          </article>
        </section>
      </div>
    </InternalShell>
  );
}
