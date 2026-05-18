"use client";

import { useEffect, useMemo, useState } from "react";
import { getSavedVocalistIds } from "@/components/home/saved-vocalists";
import { isHomeActiveOrderStatus } from "@/components/home/home-order-status";
import type { UserRole } from "@/lib/auth";
import { getProducerOrders, subscribeProducerOrders } from "@/lib/orders";
import { getVocalistRequests, subscribeVocalistRequests } from "@/lib/vocalist-requests";
import { vocalistIdFromEmail } from "@/lib/vocalist-profile";

export type HomeStats = {
  activeProjects: number;
  savedVocalists: number;
  recentRequests: number;
};

const RECENT_MS = 30 * 24 * 60 * 60 * 1000;

function computeStats(role: UserRole, email: string): HomeStats {
  const savedVocalists = getSavedVocalistIds().length;

  if (role === "producer") {
    const orders = getProducerOrders();
    const activeProjects = orders.filter((o) => isHomeActiveOrderStatus(o.status)).length;
    const cutoff = Date.now() - RECENT_MS;
    const recentRequests = orders.filter(
      (o) => new Date(o.createdAt).getTime() >= cutoff
    ).length;
    return { activeProjects, savedVocalists, recentRequests };
  }

  const vocalistId = vocalistIdFromEmail(email);
  const requests = getVocalistRequests().filter((r) => r.vocalistId === vocalistId);
  const activeProjects = requests.filter(
    (r) => r.status === "accepted" || r.status === "pending"
  ).length;
  const cutoff = Date.now() - RECENT_MS;
  const recentRequests = requests.filter(
    (r) => new Date(r.createdAt).getTime() >= cutoff
  ).length;

  return { activeProjects, savedVocalists, recentRequests };
}

export function useHomeStats(role: UserRole, email: string): HomeStats {
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const bump = () => setRevision((n) => n + 1);
    const unsubOrders = subscribeProducerOrders(bump);
    const unsubRequests = subscribeVocalistRequests(bump);
    const onStorage = (e: StorageEvent) => {
      if (e.key === "voxbridge_saved_vocalists") bump();
    };
    window.addEventListener("storage", onStorage);
    queueMicrotask(bump);
    return () => {
      unsubOrders();
      unsubRequests();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return useMemo(() => computeStats(role, email), [role, email, revision]);
}
