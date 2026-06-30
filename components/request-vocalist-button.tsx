"use client";

import { AnimatedButton } from "@/components/animated-button";

type RequestVocalistButtonProps = {
  vocalistId: string;
  vocalistName: string;
  className?: string;
};

export function RequestVocalistButton({
  vocalistId,
  className,
}: RequestVocalistButtonProps) {
  return (
    <AnimatedButton
      href={`/request/${vocalistId}`}
      variant="primary"
      className={
        className ??
        "inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium"
      }
    >
      Request Vocalist
    </AnimatedButton>
  );
}
