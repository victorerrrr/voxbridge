"use client";

import { useCallback, useEffect, useState } from "react";
import { listOrderFiles, type OrderFile } from "@/lib/order-files";
import { usePollWhileVisible } from "@/lib/hooks/use-poll-while-visible";
import { useRefetchOnVisible } from "@/lib/hooks/use-refetch-on-visible";

export function useOrderFiles(orderId: string | undefined) {
  const [files, setFiles] = useState<OrderFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!orderId) {
      setFiles([]);
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const next = await listOrderFiles(orderId);
      setFiles(next);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load files.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    setLoading(true);
    void refetch();
  }, [refetch]);

  useRefetchOnVisible(refetch);
  usePollWhileVisible(refetch, 15_000);

  return { files, loading, error, refetch };
}
