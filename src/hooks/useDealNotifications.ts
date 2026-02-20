import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Insert a notification for a deal participant.
 * Call from mutation onSuccess handlers when deal state changes.
 */
export async function notifyDealParticipant(params: {
  userId: string;
  title: string;
  message: string;
  dealId: string;
  type?: string;
}) {
  await supabase.from("notifications").insert({
    user_id: params.userId,
    title: params.title,
    message: params.message,
    type: params.type || "deal",
    link: `/ad-studio?deal=${params.dealId}`,
  });
}

/**
 * Notify the counterparty of a deal about an event.
 * Determines who the "other" person is based on current user.
 */
export async function notifyDealCounterparty(params: {
  dealId: string;
  currentUserId: string;
  title: string;
  message: string;
}) {
  const { data: deal } = await supabase
    .from("deals")
    .select("advertiser_id, creator_id")
    .eq("id", params.dealId)
    .single();
  if (!deal) return;

  const counterpartyId =
    deal.advertiser_id === params.currentUserId
      ? deal.creator_id
      : deal.advertiser_id;

  if (!counterpartyId) return;

  await notifyDealParticipant({
    userId: counterpartyId,
    title: params.title,
    message: params.message,
    dealId: params.dealId,
  });
}
