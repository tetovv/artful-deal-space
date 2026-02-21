import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLogDealEvent } from "./useDealData";
import { notifyDealCounterparty } from "./useDealNotifications";
import { toast } from "sonner";

export type EscrowState =
  | "WAITING_INVOICE"
  | "INVOICE_SENT"
  | "FUNDS_RESERVED"
  | "ACTIVE_PERIOD"
  | "PAYOUT_READY"
  | "PAID_OUT"
  | "REFUNDED"
  | "DISPUTE_LOCKED";

export const ESCROW_STEPS: { key: EscrowState; label: string }[] = [
  { key: "WAITING_INVOICE", label: "Счёт" },
  { key: "INVOICE_SENT", label: "Счёт отправлен" },
  { key: "FUNDS_RESERVED", label: "Резерв" },
  { key: "ACTIVE_PERIOD", label: "Публикация" },
  { key: "PAYOUT_READY", label: "Готов к выплате" },
  { key: "PAID_OUT", label: "Выплата" },
];

/* ── Simplified step list for compact indicator ── */
export const ESCROW_STEP_COMPACT: { key: EscrowState; label: string }[] = [
  { key: "INVOICE_SENT", label: "Счёт" },
  { key: "FUNDS_RESERVED", label: "Резерв" },
  { key: "ACTIVE_PERIOD", label: "Публикация" },
  { key: "PAYOUT_READY", label: "Период" },
  { key: "PAID_OUT", label: "Выплата" },
];

export function getEscrowStepIndex(state: EscrowState): number {
  const idx = ESCROW_STEP_COMPACT.findIndex((s) => s.key === state);
  return idx >= 0 ? idx : 0;
}

export function getEscrowStateLabel(state: EscrowState): string {
  const step = ESCROW_STEPS.find((s) => s.key === state);
  return step?.label || state;
}

/* ── Submit proof of publication (Creator) ── */
export function useSubmitProof() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const logEvent = useLogDealEvent();

  return useMutation({
    mutationFn: async (params: {
      escrowId: string;
      dealId: string;
      publicationUrl: string;
      screenshotPath?: string;
      placementDurationDays?: number | null;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const now = new Date().toISOString();
      const durationDays = params.placementDurationDays;
      const activeEndsAt = durationDays
        ? new Date(Date.now() + durationDays * 86400000).toISOString()
        : now; // immediate payout eligibility

      const nextState: EscrowState = durationDays ? "ACTIVE_PERIOD" : "PAYOUT_READY";

      const { data, error } = await supabase
        .from("deal_escrow")
        .update({
          escrow_state: nextState,
          publication_url: params.publicationUrl,
          proof_screenshot_path: params.screenshotPath || null,
          active_started_at: now,
          active_ends_at: activeEndsAt,
        } as any)
        .eq("id", params.escrowId)
        .select()
        .single();
      if (error) throw error;

      // Update deal publication_url
      await supabase
        .from("deals")
        .update({ publication_url: params.publicationUrl } as any)
        .eq("id", params.dealId);

      // System message
      await supabase.from("messages").insert({
        deal_id: params.dealId,
        sender_id: user.id,
        sender_name: "Система",
        content: `📎 Подтверждение публикации: ${params.publicationUrl}${durationDays ? `\n⏱ Период размещения: ${durationDays} дн.` : "\n✅ Без обязательного периода размещения — готов к выплате"}`,
      });

      return data;
    },
    onSuccess: (data: any, vars) => {
      qc.invalidateQueries({ queryKey: ["deal_escrow", vars.dealId] });
      qc.invalidateQueries({ queryKey: ["deal-chat", vars.dealId] });
      logEvent.mutate({
        dealId: vars.dealId,
        action: `Подтверждение публикации: ${vars.publicationUrl}`,
        category: "payments",
      });
      if (user) {
        notifyDealCounterparty({
          dealId: vars.dealId,
          currentUserId: user.id,
          title: "Публикация подтверждена",
          message: `Автор подтвердил публикацию: ${vars.publicationUrl}`,
        });
      }
      toast.success("Подтверждение публикации отправлено");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/* ── Confirm publication (Advertiser, optional) ── */
export function useConfirmPublication() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const logEvent = useLogDealEvent();

  return useMutation({
    mutationFn: async (params: { escrowId: string; dealId: string }) => {
      if (!user) throw new Error("Not authenticated");

      await supabase.from("messages").insert({
        deal_id: params.dealId,
        sender_id: user.id,
        sender_name: "Система",
        content: "✅ Рекламодатель подтвердил публикацию",
      });

      return true;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["deal_escrow", vars.dealId] });
      qc.invalidateQueries({ queryKey: ["deal-chat", vars.dealId] });
      logEvent.mutate({
        dealId: vars.dealId,
        action: "Рекламодатель подтвердил публикацию",
        category: "payments",
      });
      toast.success("Публикация подтверждена");
    },
  });
}

/* ── Lock escrow for dispute (Advertiser) ── */
export function useLockEscrowDispute() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const logEvent = useLogDealEvent();

  return useMutation({
    mutationFn: async (params: { escrowId: string; dealId: string; reason: string }) => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("deal_escrow")
        .update({ escrow_state: "DISPUTE_LOCKED" } as any)
        .eq("id", params.escrowId);
      if (error) throw error;

      await supabase.from("disputes").insert({
        deal_id: params.dealId,
        raised_by: user.id,
        reason: params.reason,
        status: "open",
      });

      await supabase.from("messages").insert({
        deal_id: params.dealId,
        sender_id: user.id,
        sender_name: "Система",
        content: `⚠️ Выплата приостановлена. Причина: ${params.reason}`,
      });

      return true;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["deal_escrow", vars.dealId] });
      qc.invalidateQueries({ queryKey: ["deal-chat", vars.dealId] });
      logEvent.mutate({
        dealId: vars.dealId,
        action: `Выплата приостановлена: ${vars.reason}`,
        category: "payments",
      });
      if (user) {
        notifyDealCounterparty({
          dealId: vars.dealId,
          currentUserId: user.id,
          title: "Выплата приостановлена",
          message: `Рекламодатель открыл проблему: ${vars.reason}`,
        });
      }
      toast.warning("Выплата приостановлена");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/* ── Execute payout (Platform / auto) ── */
export function useExecutePayout() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const logEvent = useLogDealEvent();

  return useMutation({
    mutationFn: async (params: { escrowId: string; dealId: string }) => {
      if (!user) throw new Error("Not authenticated");

      const { data: escrow, error: getErr } = await supabase
        .from("deal_escrow")
        .select("amount, deal_id")
        .eq("id", params.escrowId)
        .single();
      if (getErr || !escrow) throw new Error("Запись эскроу не найдена");

      const fee = Math.round(escrow.amount * 0.1);
      const payout = escrow.amount - fee;

      // Get deal to find advertiser & creator
      const { data: deal } = await supabase
        .from("deals")
        .select("advertiser_id, creator_id")
        .eq("id", params.dealId)
        .single();

      // Reduce advertiser reserved balance
      if (deal?.advertiser_id) {
        const { data: advBalance } = await supabase
          .from("user_balances")
          .select("reserved")
          .eq("user_id", deal.advertiser_id)
          .single();
        if (advBalance) {
          await supabase
            .from("user_balances")
            .update({ reserved: Math.max(0, advBalance.reserved - escrow.amount) })
            .eq("user_id", deal.advertiser_id);
        }
      }

      // Credit creator balance
      if (deal?.creator_id) {
        const { data: creatorBalance } = await supabase
          .from("user_balances")
          .select("available")
          .eq("user_id", deal.creator_id)
          .maybeSingle();
        if (creatorBalance) {
          await supabase
            .from("user_balances")
            .update({ available: creatorBalance.available + payout })
            .eq("user_id", deal.creator_id);
        } else {
          await supabase
            .from("user_balances")
            .insert({ user_id: deal.creator_id, available: payout, reserved: 0 });
        }
      }

      // Update escrow record
      const { data, error } = await supabase
        .from("deal_escrow")
        .update({
          escrow_state: "PAID_OUT",
          paid_out_at: new Date().toISOString(),
          released_at: new Date().toISOString(),
          released_by: user.id,
          status: "released",
          platform_fee: fee,
          payout_amount: payout,
        } as any)
        .eq("id", params.escrowId)
        .select()
        .single();
      if (error) throw error;

      // Record transaction
      if (deal?.creator_id) {
        await supabase.from("transactions").insert({
          user_id: deal.creator_id,
          amount: payout,
          type: "payout",
          status: "completed",
          description: `Выплата по сделке`,
          reference_id: params.dealId,
          reference_type: "deal",
        });
        // Fee transaction
        await supabase.from("transactions").insert({
          user_id: deal.creator_id,
          amount: fee,
          type: "fee",
          status: "completed",
          description: `Комиссия платформы`,
          reference_id: params.dealId,
          reference_type: "deal",
        });
      }

      // System message
      await supabase.from("messages").insert({
        deal_id: params.dealId,
        sender_id: user.id,
        sender_name: "Система",
        content: `💸 Выплата выполнена: ${payout.toLocaleString("ru-RU")} ₽ (комиссия: ${fee.toLocaleString("ru-RU")} ₽)`,
      });

      return data;
    },
    onSuccess: (data: any, vars) => {
      qc.invalidateQueries({ queryKey: ["deal_escrow", vars.dealId] });
      qc.invalidateQueries({ queryKey: ["user_balance"] });
      qc.invalidateQueries({ queryKey: ["deal-chat", vars.dealId] });
      logEvent.mutate({
        dealId: vars.dealId,
        action: `Выплата: ${data.payout_amount?.toLocaleString("ru-RU")} ₽`,
        category: "payments",
      });
      if (user) {
        notifyDealCounterparty({
          dealId: vars.dealId,
          currentUserId: user.id,
          title: "Выплата выполнена",
          message: `Выплата ${data.payout_amount?.toLocaleString("ru-RU")} ₽ зачислена`,
        });
      }
      toast.success("Выплата выполнена");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
