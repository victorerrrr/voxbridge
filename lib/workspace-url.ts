/** Vocalist work room URL (request list stays on /vocalist/orders). */
export function vocalistWorkspaceUrl(orderId: string): string {
  return `/workspace/${orderId}?side=vocalist`;
}

export function isVocalistWorkspaceSide(searchParams: URLSearchParams): boolean {
  const side = searchParams.get("side");
  if (side === "vocalist") return true;
  // Legacy links
  return searchParams.get("role") === "vocalist";
}
