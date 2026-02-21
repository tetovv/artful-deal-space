/**
 * Role-aware route builders — single source of truth for role-specific navigation.
 */

export type AppRoleName = "creator" | "advertiser" | "moderator" | "user" | "support";

/* ── Route builders ── */

export const getCreatorDealsRoute = (dealId?: string) =>
  dealId ? `/ad-studio` : `/ad-studio`; // creator deals live inside AdStudio

export const getAdvertiserDealsRoute = (dealId?: string) =>
  dealId ? `/ad-studio` : `/ad-studio`; // advertiser deals also inside AdStudio

export const getCreatorProposalRoute = (proposalId: string) =>
  `/creator/proposals/${proposalId}`;

/** Role-aware "go to my deals" — returns the correct route for the given role */
export function getMyDealsRoute(role: AppRoleName): string {
  // Both roles use /ad-studio but see role-filtered content
  return "/ad-studio";
}

/** Role-aware "go to my deals" with a specific deal pre-selected */
export function getMyDealsRouteWithDeal(role: AppRoleName, dealId: string): { path: string; state: Record<string, unknown> } {
  return { path: "/ad-studio", state: { openDealId: dealId } };
}

/** Role-aware "find creators / marketplace" — creators should never go to /marketplace */
export function getMarketplaceRoute(role: AppRoleName): string {
  if (role === "creator") return "/ad-studio";
  return "/marketplace";
}
