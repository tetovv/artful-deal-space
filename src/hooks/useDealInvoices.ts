import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLogDealEvent } from "./useDealData";
import { notifyDealCounterparty } from "./useDealNotifications";
import { toast } from "sonner";
import { useEffect } from "react";

export function useDealInvoices(dealId: string | undefined) {
  return useQuery({
    queryKey: ["deal_invoices", dealId],
    queryFn: async () => {
      if (!dealId) return [];
      const { data, error } = await supabase
        .from("deal_invoices" as any)
        .select("*")
        .eq("deal_id", dealId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!dealId,
  });
}

export function useCreateInvoice() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const logEvent = useLogDealEvent();

  return useMutation({
    mutationFn: async (params: {
      dealId: string;
      amount: number;
      comment?: string;
      dueDate?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");

      // Generate invoice number
      const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;

      const { data, error } = await supabase
        .from("deal_invoices" as any)
        .insert({
          deal_id: params.dealId,
          invoice_number: invoiceNumber,
          amount: params.amount,
          comment: params.comment || null,
          due_date: params.dueDate || null,
          status: "pending",
          created_by: user.id,
        } as any)
        .select()
        .single();
      if (error) throw error;

      // Update deal status to waiting_payment
      await supabase
        .from("deals")
        .update({ status: "waiting_payment" })
        .eq("id", params.dealId);

      // Add system message to chat
      const creatorName = profile?.display_name || "Автор";
      await supabase.from("messages").insert({
        deal_id: params.dealId,
        sender_id: user.id,
        sender_name: "Система",
        content: `📄 Счёт ${invoiceNumber} отправлен на сумму ${params.amount.toLocaleString("ru-RU")} ₽${params.comment ? `\nКомментарий: ${params.comment}` : ""}`,
      });

      return data;
    },
    onSuccess: (data: any, vars) => {
      qc.invalidateQueries({ queryKey: ["deal_invoices", vars.dealId] });
      qc.invalidateQueries({ queryKey: ["proposal-deal", vars.dealId] });
      qc.invalidateQueries({ queryKey: ["my_deals"] });
      qc.invalidateQueries({ queryKey: ["deal-chat", vars.dealId] });
      logEvent.mutate({
        dealId: vars.dealId,
        action: `Счёт ${data.invoice_number} отправлен на ${vars.amount.toLocaleString("ru-RU")} ₽`,
        category: "payments",
      });
      if (user) {
        notifyDealCounterparty({
          dealId: vars.dealId,
          currentUserId: user.id,
          title: "Счёт на оплату",
          message: `Получен счёт ${data.invoice_number} на ${vars.amount.toLocaleString("ru-RU")} ₽`,
        });
      }
      toast.success("Счёт отправлен");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Не удалось создать счёт");
    },
  });
}

export function usePayInvoice() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const logEvent = useLogDealEvent();

  return useMutation({
    mutationFn: async (params: { invoiceId: string; dealId: string }) => {
      if (!user) throw new Error("Not authenticated");

      // Get invoice
      const { data: invoice, error: getErr } = await supabase
        .from("deal_invoices" as any)
        .select("*")
        .eq("id", params.invoiceId)
        .single();
      if (getErr || !invoice) throw new Error("Счёт не найден");

      // Check balance
      const { data: balance } = await supabase
        .from("user_balances")
        .select("available, reserved")
        .eq("user_id", user.id)
        .single();

      const amount = (invoice as any).amount;
      if (!balance || balance.available < amount) {
        throw new Error(`Недостаточно средств. Доступно: ${balance?.available || 0} ₽, требуется: ${amount} ₽`);
      }

      // Reserve funds
      await supabase
        .from("user_balances")
        .update({
          available: balance.available - amount,
          reserved: balance.reserved + amount,
        })
        .eq("user_id", user.id);

      // Create escrow record with escrow_state
      await supabase.from("deal_escrow").insert({
        deal_id: params.dealId,
        label: `Оплата по счёту ${(invoice as any).invoice_number}`,
        amount,
        status: "reserved",
        escrow_state: "FUNDS_RESERVED",
        reserved_at: new Date().toISOString(),
      } as any);

      // Update invoice status
      await supabase
        .from("deal_invoices" as any)
        .update({ status: "paid", paid_at: new Date().toISOString(), paid_by: user.id } as any)
        .eq("id", params.invoiceId);

      // Update deal status to in_progress
      await supabase
        .from("deals")
        .update({ status: "in_progress" })
        .eq("id", params.dealId);

      // Add system message
      await supabase.from("messages").insert({
        deal_id: params.dealId,
        sender_id: user.id,
        sender_name: "Система",
        content: `✅ Счёт ${(invoice as any).invoice_number} оплачен. Средства зарезервированы (${amount.toLocaleString("ru-RU")} ₽). Сделка переведена в работу.`,
      });

      return invoice;
    },
    onSuccess: (data: any, vars) => {
      qc.invalidateQueries({ queryKey: ["deal_invoices", vars.dealId] });
      qc.invalidateQueries({ queryKey: ["deal_escrow", vars.dealId] });
      qc.invalidateQueries({ queryKey: ["user_balance"] });
      qc.invalidateQueries({ queryKey: ["proposal-deal", vars.dealId] });
      qc.invalidateQueries({ queryKey: ["my_deals"] });
      qc.invalidateQueries({ queryKey: ["deal-chat", vars.dealId] });
      logEvent.mutate({
        dealId: vars.dealId,
        action: `Оплата по счёту ${data.invoice_number} подтверждена`,
        category: "payments",
      });
      if (user) {
        notifyDealCounterparty({
          dealId: vars.dealId,
          currentUserId: user.id,
          title: "Оплата подтверждена",
          message: `Счёт ${data.invoice_number} оплачен. Средства зарезервированы.`,
        });
      }
      toast.success("Оплата подтверждена, сделка переведена в работу");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useRealtimeInvoices(dealId: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!dealId) return;
    const channel = supabase
      .channel(`invoices-${dealId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "deal_invoices",
        filter: `deal_id=eq.${dealId}`,
      }, () => {
        qc.invalidateQueries({ queryKey: ["deal_invoices", dealId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [dealId, qc]);
}
