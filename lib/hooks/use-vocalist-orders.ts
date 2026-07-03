"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getOrdersForVocalist, subscribeProducerOrders, type ProducerOrder } from "@/lib/orders";
import { usePollWhileVisible } from "@/lib/hooks/use-poll-while-visible";
import { useRefetchOnVisible } from "@/lib/hooks/use-refetch-on-visible";

const EMPTY: ProducerOrder[] = [];

export function useVocalistOrders(vocalistId: string): ProducerOrder[] {
  const pathname = usePathname();
  const [orders, setOrders] = useState<ProducerOrder[]>(EMPTY);

  const sync = useCallback(() => {
    if (!vocalistId) {
      setOrders(EMPTY);
      return;
    }
    getOrdersForVocalist(vocalistId).then((list) => setOrders([...list]));
  }, [vocalistId]);

  useEffect(() => {
    queueMicrotask(sync);
    return subscribeProducerOrders(sync);
  }, [sync]);

  useEffect(() => {
    sync();
  }, [pathname, sync]);

  useRefetchOnVisible(sync);
  usePollWhileVisible(sync);

  return orders;
}
