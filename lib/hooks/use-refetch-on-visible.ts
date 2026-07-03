"use client";

import { useEffect } from "react";

/** Re-run fetch when the user returns to this browser tab. */
export function useRefetchOnVisible(refetch: () => void): void {
  useEffect(() => {
    const run = () => {
      if (document.visibilityState === "visible") refetch();
    };
    document.addEventListener("visibilitychange", run);
    window.addEventListener("focus", run);
    return () => {
      document.removeEventListener("visibilitychange", run);
      window.removeEventListener("focus", run);
    };
  }, [refetch]);
}
