import { orderStatusLabel, type OrderStatus } from "@/lib/orders";

const HOME_STATUS_STYLES: Record<string, string> = {
  "In progress": "border-cyan-400/35 bg-cyan-500/10 text-cyan-200",
  Revision: "border-amber-400/35 bg-amber-500/10 text-amber-200",
  "Waiting approval": "border-purple-400/35 bg-purple-500/10 text-purple-200",
};

export function getHomeOrderStatusLabel(status: OrderStatus): string {
  switch (status) {
    case "in_progress":
      return "In progress";
    case "revision_requested":
      return "Revision";
    case "preview_pending":
      return "Waiting approval";
    default:
      return orderStatusLabel[status];
  }
}

export function getHomeOrderStatusStyle(label: string): string {
  return HOME_STATUS_STYLES[label] ?? "border-white/20 bg-white/5 text-zinc-300";
}

export function isHomeActiveOrderStatus(status: OrderStatus): boolean {
  return (
    status === "in_progress" ||
    status === "revision_requested" ||
    status === "preview_pending" ||
    status === "preview_approved" ||
    status === "delivery_ready"
  );
}
