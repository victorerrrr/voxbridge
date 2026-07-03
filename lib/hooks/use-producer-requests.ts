"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  getVocalistRequests,
  subscribeVocalistRequests,
  type VocalistRequest,
} from "@/lib/vocalist-requests";
import { usePollWhileVisible } from "@/lib/hooks/use-poll-while-visible";
import { useRefetchOnVisible } from "@/lib/hooks/use-refetch-on-visible";

const EMPTY: VocalistRequest[] = [];

export type ProducerRequestsState = {
  requests: VocalistRequest[];
  loading: boolean;
  error: string | null;
};

export function useProducerRequests(): ProducerRequestsState {
  const pathname = usePathname();
  const [requests, setRequests] = useState<VocalistRequest[]>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sync = useCallback(async () => {
    try {
      const list = await getVocalistRequests();
      setRequests([...list]);
      setError(null);
    } catch (err) {
      setRequests(EMPTY);
      setError(err instanceof Error ? err.message : "Failed to load requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const list = await getVocalistRequests();
        if (cancelled) return;
        setRequests([...list]);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setRequests(EMPTY);
        setError(err instanceof Error ? err.message : "Failed to load requests.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    queueMicrotask(() => void run());
    const onStoreChange = () => {
      setLoading(true);
      void sync();
    };
    const unsubscribe = subscribeVocalistRequests(onStoreChange);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [sync]);

  useEffect(() => {
    void sync();
  }, [pathname, sync]);

  useRefetchOnVisible(() => {
    setLoading(true);
    void sync();
  });
  usePollWhileVisible(() => {
    void sync();
  });

  return { requests, loading, error };
}
