"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getPendingRequestsForVocalist,
  getRequestsForVocalist,
  getVocalistRequestById,
  subscribeVocalistRequests,
  type VocalistRequest,
  type VocalistRequestStatus,
} from "@/lib/vocalist-requests";

const EMPTY: VocalistRequest[] = [];

export function useVocalistRequestsForVocalist(
  vocalistId: string,
  statuses: VocalistRequestStatus[]
): VocalistRequest[] {
  const [requests, setRequests] = useState<VocalistRequest[]>(EMPTY);
  const statusKey = statuses.join(",");

  useEffect(() => {
    if (!vocalistId) {
      queueMicrotask(() => setRequests(EMPTY));
      return;
    }
    const parsedStatuses = statusKey.split(",") as VocalistRequestStatus[];
    const sync = () => {
      getRequestsForVocalist(vocalistId, parsedStatuses).then((list) => setRequests([...list]));
    };
    queueMicrotask(sync);
    return subscribeVocalistRequests(sync);
  }, [vocalistId, statusKey]);

  return requests;
}

export function usePendingVocalistRequests(vocalistId: string): VocalistRequest[] {
  const [pending, setPending] = useState<VocalistRequest[]>(EMPTY);

  useEffect(() => {
    if (!vocalistId) {
      queueMicrotask(() => setPending(EMPTY));
      return;
    }
    const sync = () => {
      getPendingRequestsForVocalist(vocalistId).then((list) => setPending([...list]));
    };
    queueMicrotask(sync);
    return subscribeVocalistRequests(sync);
  }, [vocalistId]);

  return pending;
}

export function useVocalistRequest(requestId: string): VocalistRequest | undefined {
  const [request, setRequest] = useState<VocalistRequest | undefined>(undefined);

  const sync = useCallback(() => {
    getVocalistRequestById(requestId).then(setRequest);
  }, [requestId]);

  useEffect(() => {
    queueMicrotask(sync);
    return subscribeVocalistRequests(sync);
  }, [sync]);

  return request;
}
