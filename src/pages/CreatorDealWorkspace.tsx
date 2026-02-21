import { Navigate, useParams } from "react-router-dom";

/**
 * CreatorDealWorkspace now redirects to the unified workspace at /creator/proposals/:dealId.
 * Both proposals and active deals use the same shell (CreatorProposal).
 */
export default function CreatorDealWorkspace() {
  const { dealId } = useParams<{ dealId: string }>();
  return <Navigate to={`/creator/proposals/${dealId}`} replace />;
}
