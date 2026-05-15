"use client";

import { useEffect, useState } from "react";

/** Re-renders when an external store (localStorage + emit) changes. */
export function useStoreRevision(
  subscribe: (onStoreChange: () => void) => () => void
): void {
  const [, setRevision] = useState(0);

  useEffect(() => subscribe(() => setRevision((n) => n + 1)), [subscribe]);
}

/** Subscribes to a store and keeps snapshot in state (read in effect only). */
export function useStoreSnapshot<T>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => T,
  initial: T
): T {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    const sync = () => setValue(getSnapshot());
    queueMicrotask(sync);
    return subscribe(sync);
  }, [subscribe, getSnapshot]);

  return value;
}
