"use client";

import type { AuthUser, UserRole } from "@/lib/auth";
import { HomeWorkspace } from "@/components/home/home-workspace";

type HomeFeedProps = {
  user: AuthUser & { role: UserRole };
};

export function HomeFeed({ user }: HomeFeedProps) {
  return <HomeWorkspace user={user} />;
}
