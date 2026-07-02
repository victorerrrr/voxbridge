"use client";

import { useEffect, useState } from "react";
import {
  getVocalistRequests,
  subscribeVocalistRequests,
  type VocalistRequest,
} from "@/lib/vocalist-requests";

const EMPTY: VocalistRequest[] = [];

export function useProducerRequests(): VocalistRequest[] {
  const [requests, setRequests] = useState<VocalistRequest[]>(EMPTY);

  useEffect(() => {
    const sync = () => {
      getVocalistRequests().then((list) => setRequests([...list]));
    };
    queueMicrotask(sync);
    return subscribeVocalistRequests(sync);
  }, []);

  return requests;
}
