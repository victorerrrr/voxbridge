"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import InternalShell from "@/components/internal-shell";
import { HomeAudioProvider } from "@/components/home/home-audio-provider";
import { HomeFeed } from "@/components/home/home-feed";
import { HomeMiniPlayer } from "@/components/home/home-mini-player";
import { getStoredUser, type AuthUser } from "@/lib/auth";

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
      <HomeAudioProvider>
        <div className="relative pb-28">
          <HomeFeed user={user} />
        </div>
        <HomeMiniPlayer />
      </HomeAudioProvider>
    </InternalShell>
  );
}
