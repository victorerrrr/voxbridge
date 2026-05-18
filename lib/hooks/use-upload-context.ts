"use client";

import { useEffect, useState } from "react";
import {
  getUploadContext,
  hasAiVocalUpload,
  subscribeUploadContext,
  type UploadContext,
} from "@/lib/upload-context";

export function useUploadContext(): UploadContext | null {
  const [context, setContext] = useState<UploadContext | null>(null);

  useEffect(() => {
    const sync = () => setContext(getUploadContext());
    sync();
    return subscribeUploadContext(sync);
  }, []);

  return context;
}

export function useAiVocalExists(): boolean {
  const [exists, setExists] = useState(false);

  useEffect(() => {
    const sync = () => setExists(hasAiVocalUpload());
    sync();
    return subscribeUploadContext(sync);
  }, []);

  return exists;
}
