"use client";

import { InternalPageShell } from "@/components/internal-page-shell";
import { AnimatedButton } from "@/components/animated-button";
import { ProducerRequestCard } from "@/components/producer-request-card";
import { useProducerRequests } from "@/lib/hooks/use-producer-requests";
import { useClientAuth } from "@/lib/hooks/use-client-auth";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

const PENDING = ["pending"] as const;
const ACCEPTED = ["accepted"] as const;
const DECLINED = ["declined"] as const;

export default function MyRequestsPage() {
  return (
    <InternalPageShell activeItem="my-requests">
      <MyRequestsContent />
    </InternalPageShell>
  );
}

function MyRequestsContent() {
  const router = useRouter();
  const { user, role, isReady, isAuthenticated } = useClientAuth();
  const requests = useProducerRequests();

  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated) {
      router.replace("/signup?role=producer");
      return;
    }
    if (role === "vocalist") {
      router.replace("/vocalist/orders");
    }
  }, [isReady, isAuthenticated, role, router]);

  if (!isReady || !user || role !== "producer") {
    return <p className="text-sm text-zinc-400">Loading requests...</p>;
  }

  const pending = requests.filter((r) => PENDING.includes(r.status as (typeof PENDING)[number]));
  const accepted = requests.filter((r) => ACCEPTED.includes(r.status as (typeof ACCEPTED)[number]));
  const declined = requests.filter((r) => DECLINED.includes(r.status as (typeof DECLINED)[number]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My requests</h1>
          <p className="mt-1 text-vox-secondary">
            Outgoing requests to vocalists — track pending, accepted, and declined.
          </p>
        </div>
        <AnimatedButton
          href="/home"
          variant="secondary"
          className="rounded-lg px-4 py-2 text-sm"
        >
          Find vocalists
        </AnimatedButton>
      </div>

      {requests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 bg-zinc-950/40 px-6 py-12 text-center">
          <p className="text-vox-secondary">No requests yet.</p>
          <p className="mt-2 text-sm text-zinc-500">
            Open a real vocalist profile and use Request Vocalist to send a brief.
          </p>
          <AnimatedButton
            href="/home"
            variant="primary"
            className="mt-4 inline-flex rounded-lg px-5 py-2.5 text-sm font-medium"
          >
            Go to Home
          </AnimatedButton>
        </div>
      ) : (
        <>
          <RequestSection title="Pending" count={pending.length}>
            {pending.map((request) => (
              <ProducerRequestCard key={request.id} request={request} />
            ))}
          </RequestSection>
          <RequestSection title="Accepted" count={accepted.length}>
            {accepted.map((request) => (
              <ProducerRequestCard key={request.id} request={request} />
            ))}
          </RequestSection>
          {declined.length > 0 && (
            <RequestSection title="Declined" count={declined.length} muted>
              {declined.map((request) => (
                <ProducerRequestCard key={request.id} request={request} />
              ))}
            </RequestSection>
          )}
        </>
      )}
    </div>
  );
}

function RequestSection({
  title,
  count,
  muted,
  children,
}: {
  title: string;
  count: number;
  muted?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2
        className={`text-xs font-medium uppercase tracking-[0.18em] ${
          muted ? "text-zinc-600" : "text-zinc-500"
        }`}
      >
        {title} ({count})
      </h2>
      {count === 0 ? (
        <p className="text-sm text-zinc-600">None</p>
      ) : (
        <div className="space-y-3">{children}</div>
      )}
    </section>
  );
}
