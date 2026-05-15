"use client";

import { useEffect, useState } from "react";
import {
  getUploadContext,
  subscribeUploadContext,
  type UploadContext,
} from "@/lib/upload-context";

export function useUploadContext(): UploadContext | null {
  const [context, setContext] = useState<UploadContext | null>(null);

  useEffect(() => {
    const sync = () => setContext(getUploadContext());
    queueMicrotask(sync);
    return subscribeUploadContext(sync);
  }, []);

  return context;
}
