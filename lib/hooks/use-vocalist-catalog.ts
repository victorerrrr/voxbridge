"use client";

import { useEffect, useState } from "react";
import {
  listRegisteredVocalists,
  type RegisteredVocalistSummary,
} from "@/lib/vocalist-profile";

const EMPTY: RegisteredVocalistSummary[] = [];

export function useVocalistCatalog() {
  const [catalog, setCatalog] = useState<RegisteredVocalistSummary[]>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listRegisteredVocalists()
      .then((list) => {
        if (!cancelled) setCatalog(list);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { catalog, loading };
}
