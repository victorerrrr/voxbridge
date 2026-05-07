"use client";

import Link from "next/link";
import { AnimatedButton } from "@/components/animated-button";
import { BackgroundGlow } from "@/components/background-glow";

export default function Home() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-black text-white">
      <BackgroundGlow />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 pb-14 pt-8 md:px-10">
        <header className="flex items-center justify-between">
          <Link href="/" className="text-xl font-semibold tracking-tight">
            VoxBridge
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <AnimatedButton
              href="/login"
              variant="secondary"
              className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-zinc-100"
            >
              Sign in
            </AnimatedButton>
            <AnimatedButton
              href="/signup"
              variant="primary"
              className="inline-flex items-center justify-center rounded-lg px-4 py-2 font-medium text-white"
            >
              Sign up
            </AnimatedButton>
          </nav>
        </header>

        <section className="flex flex-1 flex-col items-center justify-center py-16 text-center md:py-20">
          <p className="mb-4 inline-flex rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-zinc-300">
            AI vocal matching platform
          </p>
          <h1 className="max-w-4xl text-balance text-4xl font-semibold tracking-tight md:text-6xl">
            Find the real voice behind your AI vocal
          </h1>
          <p className="mt-6 max-w-2xl text-pretty text-base text-zinc-300 md:text-lg">
            Upload an AI vocal reference and discover real vocalists who match the tone, style, and
            emotion.
          </p>

          <div className="mt-10 w-full max-w-3xl rounded-3xl border border-white/15 bg-zinc-950/70 p-4 shadow-[0_20px_90px_-40px_rgba(168,85,247,0.65)] backdrop-blur-xl md:p-5">
            <div className="flex flex-col gap-3 md:flex-row">
              <AnimatedButton
                href="/search"
                variant="primary"
                className="inline-flex flex-1 items-center justify-center rounded-2xl px-6 py-3.5 text-sm font-semibold"
              >
                Upload AI Vocal
              </AnimatedButton>
              <AnimatedButton
                href="/search?mode=describe"
                variant="secondary"
                className="inline-flex flex-1 items-center justify-center rounded-2xl px-6 py-3.5 text-sm font-medium"
              >
                Describe the voice instead
              </AnimatedButton>
            </div>
          </div>

          <div className="mt-6 flex flex-col items-center gap-3 text-sm text-zinc-300 sm:flex-row">
            <AnimatedButton
              href="/signup?role=producer"
              variant="secondary"
              className="inline-flex items-center justify-center rounded-xl px-4 py-2"
            >
              Continue as Producer
            </AnimatedButton>
            <AnimatedButton
              href="/signup?role=vocalist"
              variant="secondary"
              className="inline-flex items-center justify-center rounded-xl px-4 py-2"
            >
              Join as Vocalist
            </AnimatedButton>
          </div>
        </section>

      </div>
    </main>
  );
}