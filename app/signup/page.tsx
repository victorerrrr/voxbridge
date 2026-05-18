"use client";

import Link from "next/link";
import { FormEvent, Suspense, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { registerStoredUser } from "@/lib/auth";
import PasswordInput from "@/components/password-input";
import { AnimatedButton } from "@/components/animated-button";

type Role = "producer" | "vocalist";

const roleLabels: Record<Role, string> = {
  producer: "Producer",
  vocalist: "Vocalist",
};

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-black text-zinc-300">
          Loading...
        </main>
      }
    >
      <SignupPageContent />
    </Suspense>
  );
}

function SignupPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRoleParam = searchParams.get("role");

  const initialRole = useMemo<Role>(() => {
    return initialRoleParam === "vocalist" ? "vocalist" : "producer";
  }, [initialRoleParam]);

  const [role, setRole] = useState<Role>(initialRole);
  const [form, setForm] = useState({
    email: "",
    username: "",
    password: "",
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    registerStoredUser({
      email: form.email.trim(),
      username: form.username.trim(),
      role,
      password: form.password,
    });

    const destination = role === "vocalist" ? "/vocalist/onboarding" : "/home";
    window.setTimeout(() => router.push(destination), 150);
  };

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white md:px-10">
      <div className="mx-auto max-w-xl">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Create your account</h1>
        <p className="mt-3 text-zinc-400">Simple frontend signup for the MVP demo.</p>

        <form
          key={initialRole}
          onSubmit={handleSubmit}
          className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-zinc-950/60 p-6"
        >
          <input
            required
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            placeholder="Email"
            className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none ring-purple-500/50 placeholder:text-zinc-500 focus:ring-2"
          />
          <input
            required
            value={form.username}
            onChange={(event) => setForm({ ...form, username: event.target.value })}
            placeholder="Username"
            className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none ring-purple-500/50 placeholder:text-zinc-500 focus:ring-2"
          />
          <PasswordInput
            required
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            placeholder="Password"
          />

          <div className="space-y-2">
            <p className="text-sm text-zinc-300">I am a</p>
            <div className="grid grid-cols-2 gap-2">
              {(["producer", "vocalist"] as const).map((option) => {
                const active = role === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setRole(option)}
                    className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${
                      active
                        ? option === "producer"
                          ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-100 ring-1 ring-cyan-400/30"
                          : "border-purple-400/50 bg-purple-500/20 text-white ring-1 ring-purple-400/40"
                        : "border-white/10 bg-zinc-900/80 text-zinc-400 hover:border-white/25 hover:text-zinc-200"
                    }`}
                  >
                    {roleLabels[option]}
                  </button>
                );
              })}
            </div>
          </div>

          <AnimatedButton
            type="submit"
            variant="primary"
            className="inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium"
          >
            Create account
          </AnimatedButton>
          <p className="text-sm text-zinc-400">
            Already have an account?{" "}
            <Link href="/login" className="text-purple-300 hover:text-purple-200">
              Login
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
