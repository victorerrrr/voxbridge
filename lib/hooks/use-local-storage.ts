"use client";

import { useEffect, useState } from "react";

/** Raw localStorage value for a key — read once on mount, never parsed during render. */
export function useLocalStorage(key: string): string | null {
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setValue(window.localStorage.getItem(key));
    });
  }, [key]);

  return value;
}
