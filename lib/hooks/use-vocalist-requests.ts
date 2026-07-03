"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  getPendingRequestsForVocalist,
  getRequestsForVocalist,
  getVocalistRequestById,
  subscribeVocalistRequests,
  type VocalistRequest,
  type VocalistRequestStatus,
} from "@/lib/vocalist-requests";
import { usePollWhileVisible } from "@/lib/hooks/use-poll-while-visible";
import { useRefetchOnVisible } from "@/lib/hooks/use-refetch-on-visible";

const EMPTY: VocalistRequest[] = [];

export function useVocalistRequestsForVocalist(
  vocalistId: string,
  statuses: VocalistRequestStatus[]
): VocalistRequest[] {
  const pathname = usePathname();
  const statusKey = statuses.join(",");
  const [requests, setRequests] = useState<VocalistRequest[]>(EMPTY);

  const sync = useCallback(() => {
    if (!vocalistId) {
      setRequests(EMPTY);
      return;
    }
    const parsedStatuses = statusKey.split(",") as VocalistRequestStatus[];
    getRequestsForVocalist(vocalistId, parsedStatuses).then((list) => setRequests([...list]));
  }, [vocalistId, statusKey]);

  useEffect(() => {
    queueMicrotask(sync);
    return subscribeVocalistRequests(sync);
  }, [sync]);

  useEffect(() => {
    sync();
  }, [pathname, sync]);

  useRefetchOnVisible(sync);
  usePollWhileVisible(sync);

  return requests;
}

export function usePendingVocalistRequests(vocalistId: string): VocalistRequest[] {
  const pathname = usePathname();
  const [pending, setPending] = useState<VocalistRequest[]>(EMPTY);

  const sync = useCallback(() => {
    if (!vocalistId) {
      setPending(EMPTY);
      return;
    }
    getPendingRequestsForVocalist(vocalistId).then((list) => setPending([...list]));
  }, [vocalistId]);

  useEffect(() => {
    queueMicrotask(sync);
    return subscribeVocalistRequests(sync);
  }, [sync]);

  useEffect(() => {
    sync();
  }, [pathname, sync]);

  useRefetchOnVisible(sync);
  usePollWhileVisible(sync);

  return pending;
}

export function useVocalistRequest(requestId: string): VocalistRequest | undefined {
  const pathname = usePathname();
  const [request, setRequest] = useState<VocalistRequest | undefined>(undefined);

  const sync = useCallback(() => {
    getVocalistRequestById(requestId).then(setRequest);
  }, [requestId]);

  useEffect(() => {
    queueMicrotask(sync);
    return subscribeVocalistRequests(sync);
  }, [sync]);

  useEffect(() => {
    sync();
  }, [pathname, sync]);

  useRefetchOnVisible(sync);
  usePollWhileVisible(sync);

  return request;
}
