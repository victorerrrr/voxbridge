"use client";

import { getStoredUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase-client";

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
  return attachPlaybackUrls(files);
}

async function attachPlaybackUrls(files: OrderFile[]): Promise<OrderFile[]> {
  return Promise.all(
    files.map(async (file) => {
      if (file.kind === "stems" || !isPlayableAudio(file.mimeType, file.fileName)) {
        return file;
      }
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(file.storagePath, SIGNED_URL_TTL_SEC);
      if (error || !data?.signedUrl) return file;
      return { ...file, playbackUrl: data.signedUrl };
    })
  );
}

function isPlayableAudio(mimeType?: string, fileName?: string): boolean {
  if (mimeType?.startsWith("audio/")) return true;
  const lower = fileName?.toLowerCase() ?? "";
  return /\.(mp3|wav|flac|aac|m4a|ogg|aiff?)$/.test(lower);
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

export async function uploadOrderFile(
  orderId: string,
  kind: OrderFileKind,
  file: File
): Promise<OrderFile> {
  const user = await getStoredUser();
  if (!user) throw new Error("Sign in to upload files.");

  const fileId = crypto.randomUUID();
  const storagePath = `${orderId}/${fileId}_${sanitizeFileName(file.name)}`;

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
    throw new Error(insertError?.message ?? "Failed to register file.");
  }

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });

  if (uploadError) {
    await supabase.from("order_files").delete().eq("id", fileId);
    throw new Error(uploadError.message);
  }

  const orderFile = rowToOrderFile(row as DbOrderFileRow);
  const withUrl = await attachPlaybackUrls([orderFile]);
  return withUrl[0] ?? orderFile;
}

export const orderFileKindLabel: Record<OrderFileKind, string> = {
  reference: "AI reference",
  preview: "Preview",
  revision: "Revision",
  stems: "Final stems",
};
