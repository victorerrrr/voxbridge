"use client";

import { AnimatedButton } from "@/components/animated-button";
import {
  vocalistRequestStatusLabel,
  type VocalistRequest,
} from "@/lib/vocalist-requests";
import { vocalistWorkspaceUrl } from "@/lib/workspace-url";

type VocalistRequestCardProps = {
  request: VocalistRequest;
  onAccept?: () => void;
  onDecline?: () => void;
};

export function VocalistRequestCard({ request, onAccept, onDecline }: VocalistRequestCardProps) {
  const isPending = request.status === "pending";
  const isAccepted = request.status === "accepted";

  return (
    <article className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">{request.projectName}</h2>
          <p className="mt-1 text-sm text-zinc-400">from {request.producerName}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RequestStatusBadge status={request.status} />
          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-200">
            ${request.budget}
          </span>
        </div>
      </div>

      <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-zinc-300">{request.brief || request.description}</p>

      <TagRow tags={[...request.genreTags, ...request.moodTags, ...request.voiceTags].slice(0, 5)} />

      <div className="mt-5 flex flex-wrap gap-2">
        <AnimatedButton
          href={`/vocalist/requests/${request.id}`}
          variant="secondary"
          className="rounded-lg px-4 py-2 text-sm"
        >
          View request
        </AnimatedButton>
        {isPending && onAccept && (
          <AnimatedButton
            type="button"
            variant="primary"
            onClick={onAccept}
            className="rounded-lg px-4 py-2 text-sm font-medium"
          >
            Accept
          </AnimatedButton>
        )}
        {isPending && onDecline && (
          <AnimatedButton
            type="button"
            variant="secondary"
            onClick={onDecline}
            className="rounded-lg px-4 py-2 text-sm"
          >
            Decline
          </AnimatedButton>
        )}
        {isAccepted && request.orderId && (
          <AnimatedButton
            href={vocalistWorkspaceUrl(request.orderId)}
            variant="primary"
            className="rounded-lg px-4 py-2 text-sm font-medium"
          >
            Go to workspace
          </AnimatedButton>
        )}
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

function TagRow({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span key={tag} className="rounded-full border border-white/10 px-2.5 py-0.5 text-xs text-zinc-400">
          {tag}
        </span>
      ))}
    </div>
  );
}
