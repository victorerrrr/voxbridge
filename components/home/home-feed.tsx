"use client";

import type { AuthUser } from "@/lib/auth";
import { HomeWorkspace } from "@/components/home/home-workspace";

type HomeFeedProps = {
  user: AuthUser;
};

export function HomeFeed({ user }: HomeFeedProps) {
  return <HomeWorkspace user={user} />;
}
