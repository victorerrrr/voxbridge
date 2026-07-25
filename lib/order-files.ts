"use client";

import { getStoredUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase-client";
import * as tus from "tus-js-client";

export type OrderFileKind = "reference" | "preview" | "revision" | "stems";

export type OrderFile = {
  id: string;
  orderId: string;
  kind: OrderFileKind;
  storagePath: string;
  fileName: string;
  mimeType?: string;
  sizeBytes?: number;
  uploadedBy: string;
  createdAt: string;
  playbackUrl?: string;
};

const BUCKET = "order-files";
const SIGNED_URL_TTL_SEC = 3600;
const MAX_BYTES = 50 * 1024 * 1024;
const TUS_CHUNK_BYTES = 512 * 1024;

function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  return url;
}

function uploadWithTus(
  file: File,
  storagePath: string,
  accessToken: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${getSupabaseUrl()}/storage/v1/upload/resumable`,
      retryDelays: [0, 1000, 3000, 5000],
      headers: {
        authorization: `Bearer ${accessToken}`,
        "x-upsert": "false",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: BUCKET,
        objectName: storagePath,
        contentType: file.type || "audio/mpeg",
        cacheControl: "3600",
      },
      chunkSize: TUS_CHUNK_BYTES,
      onError: (error) => reject(error),
      onProgress: (bytesUploaded, bytesTotal) => {
        if (bytesTotal > 0) {
          onProgress?.(Math.min(99, Math.round((bytesUploaded / bytesTotal) * 100)));
        }
      },
      onSuccess: () => {
        onProgress?.(100);
        resolve();
      },
    });
    upload.start();
  });
}

const fileListeners = new Set<() => void>();

export function subscribeOrderFiles(onChange: () => void): () => void {
  fileListeners.add(onChange);
  return () => fileListeners.delete(onChange);
}

function emitOrderFilesChange(): void {
  fileListeners.forEach((listener) => listener());
}

const AUDIO_ACCEPT = "audio/*";
const STEMS_ACCEPT = ".zip,application/zip,application/x-zip-compressed";

type DbOrderFileRow = {
  id: string;
  order_id: string;
  kind: OrderFileKind;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string;
  created_at: string;
};

function rowToOrderFile(row: DbOrderFileRow): OrderFile {
  return {
    id: row.id,
    orderId: row.order_id,
    kind: row.kind,
    storagePath: row.storage_path,
    fileName: row.file_name,
    mimeType: row.mime_type ?? undefined,
    sizeBytes: row.size_bytes ?? undefined,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
  };
}

function sanitizeFileName(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/_+/g, "_");
  return base.slice(0, 120) || "file";
}

export function acceptForOrderFileKind(kind: OrderFileKind): string {
  return kind === "stems" ? `${AUDIO_ACCEPT},${STEMS_ACCEPT}` : AUDIO_ACCEPT;
}

export async function listOrderFiles(orderId: string): Promise<OrderFile[]> {
  const { data, error } = await supabase
    .from("order_files")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[order-files] listOrderFiles:", error.message);
    return [];
  }

  const files = (data ?? []).map((row) => rowToOrderFile(row as DbOrderFileRow));
  return files;
}

async function attachPlaybackUrls(files: OrderFile[]): Promise<OrderFile[]> {
  return Promise.all(
    files.map(async (file) => {
      if (file.kind === "stems") return file;
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(file.storagePath, SIGNED_URL_TTL_SEC);
      if (error) {
        console.error("[order-files] signed url:", file.fileName, error.message);
        return file;
      }
      if (!data?.signedUrl) return file;
      return { ...file, playbackUrl: data.signedUrl };
    })
  );
}

export async function getOrderFileDownloadUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SEC);
  if (error || !data?.signedUrl) {
    console.error("[order-files] getOrderFileDownloadUrl:", error?.message);
    return null;
  }
  return data.signedUrl;
}

/** Signed URL first; fall back to blob download (same RLS, more reliable in some browsers). */
export async function resolveOrderFileAudioUrl(
  storagePath: string,
  existingUrl?: string
): Promise<string> {
  if (existingUrl) return existingUrl;

  const signed = await getOrderFileDownloadUrl(storagePath);
  if (signed) return signed;

  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
  if (error || !data) {
    throw new Error(error?.message ?? "File not found in storage — try uploading again.");
  }
  return URL.createObjectURL(data);
}

export async function deleteOrderFile(file: OrderFile): Promise<void> {
  const user = await getStoredUser();
  if (!user) throw new Error("Sign in to delete files.");
  if (file.uploadedBy !== user.id) {
    throw new Error("You can only delete files you uploaded.");
  }

  await supabase.storage.from(BUCKET).remove([file.storagePath]);

  const { error } = await supabase.from("order_files").delete().eq("id", file.id);
  if (error) throw new Error(error.message);

  emitOrderFilesChange();
}

export async function uploadOrderFile(
  orderId: string,
  kind: OrderFileKind,
  file: File,
  onProgress?: (percent: number) => void
): Promise<OrderFile> {
  const user = await getStoredUser();
  if (!user) throw new Error("Sign in to upload files.");

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Session expired — log out and log in again.");

  if (file.size > MAX_BYTES) {
    throw new Error("File too large — max 50 MB.");
  }

  const fileId = crypto.randomUUID();
  const storagePath = `${orderId}/${kind}/${fileId}_${sanitizeFileName(file.name)}`;

  try {
    await uploadWithTus(file, storagePath, token, onProgress);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    throw new Error(`Could not upload to storage: ${message}`);
  }

  const { data: row, error: insertError } = await supabase
    .from("order_files")
    .insert({
      id: fileId,
      order_id: orderId,
      kind,
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
      uploaded_by: user.id,
    })
    .select("*")
    .single();

  if (insertError || !row) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw new Error(insertError?.message ?? "Failed to register file.");
  }

  const orderFile = rowToOrderFile(row as DbOrderFileRow);
  const withUrl = await attachPlaybackUrls([orderFile]);
  emitOrderFilesChange();
  return withUrl[0] ?? orderFile;
}

export const orderFileKindLabel: Record<OrderFileKind, string> = {
  reference: "AI reference",
  preview: "Preview",
  revision: "Revision",
  stems: "Final stems",
};
