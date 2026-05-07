"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { loginStoredUser } from "@/lib/auth";
import PasswordInput from "@/components/password-input";
import { AnimatedButton } from "@/components/animated-button";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const result = loginStoredUser(identifier, password);
    if (result.error === "account_not_found") {
      setError("No account found. Create account first or sign up again for this frontend demo.");
      return;
    }
    if (result.error === "invalid_credentials") {
      setError("Invalid credentials.");
      return;
    }

    window.setTimeout(() => router.push("/home"), 150);
  };

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white md:px-10">
      <div className="mx-auto max-w-xl">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Login</h1>
        <p className="mt-3 text-zinc-400">Fake auth for MVP frontend flow.</p>

        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-zinc-950/60 p-6"
        >
          <input
            required
            type="text"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="Email or username"
            className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none ring-purple-500/50 placeholder:text-zinc-500 focus:ring-2"
          />
          <PasswordInput
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
          />
          {error && <p className="text-sm text-rose-300">{error}</p>}
          <AnimatedButton
            type="submit"
            variant="primary"
            className="inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium"
          >
            Login
          </AnimatedButton>
          <p className="text-sm text-zinc-400">
            New to VoxBridge?{" "}
            <Link href="/signup" className="text-purple-300 hover:text-purple-200">
              Create account
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
