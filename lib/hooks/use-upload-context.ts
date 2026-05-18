"use client";

import { useSyncExternalStore } from "react";
import {
  getAiVocal,
  getUploadContext,
  hasAiVocalUpload,
  subscribeUploadContext,
  type UploadContext,
} from "@/lib/upload-context";

export function useUploadContext(): UploadContext | null {
  return useSyncExternalStore(
    subscribeUploadContext,
    () => getUploadContext(),
    () => null
  );
}

/** True only when aiVocal exists (file upload or explicit hasAiVocalFile). */
export function useAiVocalExists(): boolean {
  return useSyncExternalStore(
    subscribeUploadContext,
    hasAiVocalUpload,
    () => false
  );
}

export function useAiVocal(): UploadContext | null {
  return useSyncExternalStore(subscribeUploadContext, () => getAiVocal(), () => null);
}
