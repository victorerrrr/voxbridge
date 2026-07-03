"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  getOrderById,
  getProducerOrders,
  subscribeProducerOrders,
  type ProducerOrder,
} from "@/lib/orders";
import { usePollWhileVisible } from "@/lib/hooks/use-poll-while-visible";
import { useRefetchOnVisible } from "@/lib/hooks/use-refetch-on-visible";

const EMPTY_ORDERS: ProducerOrder[] = [];

export function useProducerOrders(): ProducerOrder[] {
  const pathname = usePathname();
  const [orders, setOrders] = useState<ProducerOrder[]>(EMPTY_ORDERS);

  const sync = useCallback(() => {
    getProducerOrders().then((list) => setOrders([...list]));
  }, []);

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

export function useProducerOrder(orderId: string): {
  order: ProducerOrder | undefined;
  ready: boolean;
} {
  const pathname = usePathname();
  const [order, setOrder] = useState<ProducerOrder | undefined>(undefined);
  const [ready, setReady] = useState(false);

  const sync = useCallback(() => {
    getOrderById(orderId).then((found) => {
      setOrder(found);
      setReady(true);
    });
  }, [orderId]);

  useEffect(() => {
    queueMicrotask(sync);
    return subscribeProducerOrders(sync);
  }, [sync]);

  useEffect(() => {
    sync();
  }, [pathname, sync]);

  useRefetchOnVisible(sync);
  usePollWhileVisible(sync);

  return { order, ready };
}
