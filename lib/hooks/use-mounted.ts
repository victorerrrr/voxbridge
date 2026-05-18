"use client";

import { useEffect, useState } from "react";

/** True only after the component has mounted (client). Use to gate browser-only markup. */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted;
}
