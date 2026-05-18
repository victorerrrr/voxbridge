"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import InternalShell from "@/components/internal-shell";
import { HomeAudioProvider } from "@/components/home/home-audio-provider";
import { HomeFeed } from "@/components/home/home-feed";
import { HomeMiniPlayer } from "@/components/home/home-mini-player";
import { useClientAuth } from "@/lib/hooks/use-client-auth";

export default function HomePage() {
  const router = useRouter();
  const { user, role, isAdmin, inAdminCenter, isReady, isAuthenticated, refresh } =
    useClientAuth();

  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated) {
      router.replace("/signup");
      return;
    }
    if (inAdminCenter) {
      router.replace("/admin");
    }
  }, [isReady, isAuthenticated, inAdminCenter, router]);

  if (!isReady || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-zinc-300">
        Loading home...
      </main>
    );
  }

  return (
    <InternalShell
      role={role}
      isAdmin={isAdmin}
      onAdminRoleChange={refresh}
      activeItem="home"
    >
      <HomeAudioProvider>
        <div className="relative pb-28">
          <HomeFeed user={{ ...user, role }} />
        </div>
        <HomeMiniPlayer />
      </HomeAudioProvider>
    </InternalShell>
  );
}
