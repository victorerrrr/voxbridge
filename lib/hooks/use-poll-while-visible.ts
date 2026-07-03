"use client";

import { useEffect } from "react";

/** Light polling while the tab is visible (e.g. second browser window updated Supabase). */
export function usePollWhileVisible(refetch: () => void, intervalMs = 10_000): void {
  useEffect(() => {
    let timer: number | undefined;

    const start = () => {
      if (timer !== undefined) return;
      timer = window.setInterval(refetch, intervalMs);
    };

    const stop = () => {
      if (timer === undefined) return;
      window.clearInterval(timer);
      timer = undefined;
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refetch();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") {
      start();
    }

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refetch, intervalMs]);
}
