/**
 * Role-aware route builders — single source of truth for role-specific navigation.
 */

export type AppRoleName = "creator" | "advertiser" | "moderator" | "user" | "support";

/* ── Route builders ── */

export const getCreatorDealsRoute = (dealId?: string) =>
  dealId ? `/marketplace` : `/marketplace`; // creator deals live inside Marketplace (Предложения)

export const getAdvertiserDealsRoute = (dealId?: string) =>
  dealId ? `/ad-studio` : `/ad-studio`; // advertiser deals inside AdStudio

export const getCreatorProposalRoute = (proposalId: string) =>
  `/creator/proposals/${proposalId}`;

/** Role-aware "go to my deals" — returns the correct route for the given role */
export function getMyDealsRoute(role: AppRoleName): string {
  if (role === "creator") return "/marketplace";
  return "/ad-studio";
}

/** Role-aware "go to my deals" with a specific deal pre-selected */
export function getMyDealsRouteWithDeal(role: AppRoleName, dealId: string): { path: string; state: Record<string, unknown> } {
  const path = role === "creator" ? "/marketplace" : "/ad-studio";
  return { path, state: { openDealId: dealId } };
}

/** Role-aware "find creators / marketplace" — creators should never go to /marketplace */
export function getMarketplaceRoute(role: AppRoleName): string {
  if (role === "creator") return "/ad-studio";
  return "/marketplace";
}
