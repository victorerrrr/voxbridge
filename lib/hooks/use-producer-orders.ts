"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getOrderById,
  getProducerOrders,
  subscribeProducerOrders,
  type ProducerOrder,
} from "@/lib/orders";

const EMPTY_ORDERS: ProducerOrder[] = [];

export function useProducerOrders(): ProducerOrder[] {
  const [orders, setOrders] = useState<ProducerOrder[]>(EMPTY_ORDERS);

  useEffect(() => {
    const sync = () => setOrders([...getProducerOrders()]);
    queueMicrotask(sync);
    return subscribeProducerOrders(sync);
  }, []);

  return orders;
}

export function useProducerOrder(orderId: string): {
  order: ProducerOrder | undefined;
  ready: boolean;
} {
  const [order, setOrder] = useState<ProducerOrder | undefined>(undefined);
  const [ready, setReady] = useState(false);

  const sync = useCallback(() => {
    setOrder(getOrderById(orderId));
    setReady(true);
  }, [orderId]);

  useEffect(() => {
    queueMicrotask(sync);
    return subscribeProducerOrders(sync);
  }, [sync]);

  return { order, ready };
}
