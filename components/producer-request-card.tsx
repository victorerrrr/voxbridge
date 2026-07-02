"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatedButton } from "@/components/animated-button";
import { getVocalistProfileById } from "@/lib/vocalist-profile";
import {
  vocalistRequestStatusLabel,
  type VocalistRequest,
} from "@/lib/vocalist-requests";

type ProducerRequestCardProps = {
  request: VocalistRequest;
};

export function ProducerRequestCard({ request }: ProducerRequestCardProps) {
  const [vocalistName, setVocalistName] = useState("Vocalist");

  useEffect(() => {
    let cancelled = false;
    getVocalistProfileById(request.vocalistId).then((profile) => {
      if (!cancelled && profile?.username) setVocalistName(profile.username);
    });
    return () => {
      cancelled = true;
    };
  }, [request.vocalistId]);

  const isPending = request.status === "pending";
  const isAccepted = request.status === "accepted";
  const isDeclined = request.status === "declined";

  return (
    <article className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">{request.projectName}</h2>
          <p className="mt-1 text-vox-meta">
            to{" "}
            <Link
              href={`/vocalists/${request.vocalistId}`}
              className="text-purple-200 transition hover:text-purple-100"
            >
              {vocalistName}
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RequestStatusBadge status={request.status} />
          {request.budget > 0 && (
            <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-200">
              ${request.budget}
            </span>
          )}
        </div>
      </div>

      <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-zinc-300">
        {request.brief || request.description || "No description."}
      </p>

      {isPending && (
        <p className="mt-3 text-xs text-amber-200/90">
          Waiting for the vocalist to accept or decline.
        </p>
      )}
      {isDeclined && (
        <p className="mt-3 text-xs text-zinc-500">This vocalist declined the request.</p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {isAccepted && request.orderId && (
          <AnimatedButton
            href={`/workspace/${request.orderId}`}
            variant="primary"
            className="rounded-lg px-4 py-2 text-sm font-medium"
          >
            Open workspace
          </AnimatedButton>
        )}
        <AnimatedButton
          href={`/vocalists/${request.vocalistId}`}
          variant="secondary"
          className="rounded-lg px-4 py-2 text-sm"
        >
          View vocalist
        </AnimatedButton>
      </div>
    </article>
  );
}

function RequestStatusBadge({ status }: { status: VocalistRequest["status"] }) {
  const styles: Record<VocalistRequest["status"], string> = {
    pending: "border-amber-400/30 bg-amber-500/10 text-amber-200",
    accepted: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
    declined: "border-zinc-500/40 bg-zinc-800/60 text-zinc-400",
  };

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${styles[status]}`}>
      {vocalistRequestStatusLabel[status]}
    </span>
  );
}
