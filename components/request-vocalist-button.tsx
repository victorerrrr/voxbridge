"use client";

import { useRouter } from "next/navigation";
import { AnimatedButton } from "@/components/animated-button";
import { createProducerOrder } from "@/lib/orders";

type RequestVocalistButtonProps = {
  vocalistId: string;
  vocalistName: string;
  className?: string;
};

export function RequestVocalistButton({
  vocalistId,
  vocalistName,
  className,
}: RequestVocalistButtonProps) {
  const router = useRouter();

  const onRequest = () => {
    createProducerOrder(vocalistId, vocalistName).then((order) => {
      router.push(`/workspace/${order.id}`);
    });
  };

  return (
    <AnimatedButton
      type="button"
      variant="primary"
      actionDelay={150}
      onClick={onRequest}
      className={
        className ??
        "inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium"
      }
    >
      Request Vocalist
    </AnimatedButton>
  );
}
