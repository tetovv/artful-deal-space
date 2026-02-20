import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/* ─── Audit Log ─── */
export function useDealAuditLog(dealId: string | undefined) {
  return useQuery({
    queryKey: ["deal_audit_log", dealId],
    queryFn: async () => {
      if (!dealId) return [];
      const { data, error } = await supabase
        .from("deal_audit_log")
        .select("*")
        .eq("deal_id", dealId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!dealId,
  });
}

export function useLogDealEvent() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { dealId: string; action: string; category: string; metadata?: Record<string, any> }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("deal_audit_log").insert({
        deal_id: params.dealId,
        user_id: user.id,
        action: params.action,
        category: params.category,
        metadata: params.metadata || {},
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["deal_audit_log", vars.dealId] });
    },
  });
}

/* ─── User Balance ─── */
export function useUserBalance() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user_balance", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("user_balances")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      // Auto-create balance row if missing
      if (!data) {
        const { data: created, error: createErr } = await supabase
          .from("user_balances")
          .insert({ user_id: user.id, available: 0, reserved: 0 })
          .select()
          .single();
        if (createErr) throw createErr;
        return created;
      }
      return data;
    },
    enabled: !!user,
  });
}

/* ─── Escrow ─── */
export function useDealEscrow(dealId: string | undefined) {
  return useQuery({
    queryKey: ["deal_escrow", dealId],
    queryFn: async () => {
      if (!dealId) return [];
      const { data, error } = await supabase
        .from("deal_escrow")
        .select("*")
        .eq("deal_id", dealId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!dealId,
  });
}

export function useReserveEscrow() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const logEvent = useLogDealEvent();
  return useMutation({
    mutationFn: async (params: { dealId: string; label: string; amount: number; milestoneId?: string }) => {
      if (!user) throw new Error("Not authenticated");

      // Check balance
      const { data: balance } = await supabase
        .from("user_balances")
        .select("available, reserved")
        .eq("user_id", user.id)
        .single();

      if (!balance || balance.available < params.amount) {
        throw new Error(`Недостаточно средств. Доступно: ${balance?.available || 0} ₽, требуется: ${params.amount} ₽`);
      }

      // Reserve funds in balance
      const { error: balErr } = await supabase
        .from("user_balances")
        .update({
          available: balance.available - params.amount,
          reserved: balance.reserved + params.amount,
        })
        .eq("user_id", user.id);
      if (balErr) throw balErr;

      // Create escrow record
      const { data, error } = await supabase.from("deal_escrow").insert({
        deal_id: params.dealId,
        milestone_id: params.milestoneId || null,
        label: params.label,
        amount: params.amount,
        status: "reserved",
        reserved_at: new Date().toISOString(),
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ["deal_escrow", vars.dealId] });
      qc.invalidateQueries({ queryKey: ["user_balance"] });
      logEvent.mutate({ dealId: vars.dealId, action: `Средства зарезервированы: ${vars.amount} ₽ — ${vars.label}`, category: "payments" });
      toast.success("Средства зарезервированы");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useReleaseEscrow() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const logEvent = useLogDealEvent();
  return useMutation({
    mutationFn: async (params: { escrowId: string; dealId: string }) => {
      if (!user) throw new Error("Not authenticated");

      // Get escrow record
      const { data: escrow, error: getErr } = await supabase
        .from("deal_escrow")
        .select("amount, deal_id")
        .eq("id", params.escrowId)
        .single();
      if (getErr || !escrow) throw new Error("Запись эскроу не найдена");

      // Release: reduce reserved in advertiser balance
      // Find advertiser for this deal
      const { data: deal } = await supabase
        .from("deals")
        .select("advertiser_id")
        .eq("id", params.dealId)
        .single();

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

      const { data, error } = await supabase
        .from("deal_escrow")
        .update({ status: "released", released_at: new Date().toISOString(), released_by: user.id })
        .eq("id", params.escrowId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ["deal_escrow", vars.dealId] });
      qc.invalidateQueries({ queryKey: ["user_balance"] });
      logEvent.mutate({ dealId: vars.dealId, action: `Выплата подтверждена: ${data.amount} ₽ — ${data.label}`, category: "payments" });
      toast.success("Выплата подтверждена");
    },
  });
}

/* ─── Deal Files ─── */
export function useDealFiles(dealId: string | undefined) {
  return useQuery({
    queryKey: ["deal_files", dealId],
    queryFn: async () => {
      if (!dealId) return [];
      const { data, error } = await supabase
        .from("deal_files")
        .select("*")
        .eq("deal_id", dealId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!dealId,
  });
}

export function useUploadDealFile() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const logEvent = useLogDealEvent();
  return useMutation({
    mutationFn: async (params: { dealId: string; file: File; category: string }) => {
      if (!user) throw new Error("Not authenticated");
      const path = `${user.id}/${params.dealId}/${Date.now()}_${params.file.name}`;
      const { error: uploadError } = await supabase.storage.from("deal-files").upload(path, params.file);
      if (uploadError) throw uploadError;

      const { data, error } = await supabase.from("deal_files").insert({
        deal_id: params.dealId,
        user_id: user.id,
        file_name: params.file.name,
        file_size: params.file.size,
        file_type: params.file.type,
        category: params.category,
        storage_path: path,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ["deal_files", vars.dealId] });
      logEvent.mutate({ dealId: vars.dealId, action: `Загрузил файл: ${data.file_name}`, category: "files", metadata: { file_id: data.id } });
      toast.success("Файл загружен");
    },
  });
}

export function useDownloadDealFile() {
  return useMutation({
    mutationFn: async (storagePath: string) => {
      const { data, error } = await supabase.storage.from("deal-files").download(storagePath);
      if (error) throw error;
      return data;
    },
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "";
      a.click();
      URL.revokeObjectURL(url);
    },
  });
}

/* ─── Terms ─── */
export function useDealTerms(dealId: string | undefined) {
  return useQuery({
    queryKey: ["deal_terms", dealId],
    queryFn: async () => {
      if (!dealId) return [];
      const { data, error } = await supabase
        .from("deal_terms")
        .select("*, deal_terms_acceptance(*)")
        .eq("deal_id", dealId)
        .order("version", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!dealId,
  });
}

export function useAcceptTerms() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const logEvent = useLogDealEvent();
  return useMutation({
    mutationFn: async (params: { termsId: string; dealId: string; version: number }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("deal_terms_acceptance").insert({
        terms_id: params.termsId,
        user_id: user.id,
      });
      if (error) throw error;

      const { data: acceptances } = await supabase
        .from("deal_terms_acceptance")
        .select("user_id")
        .eq("terms_id", params.termsId);

      if (acceptances && acceptances.length >= 2) {
        await supabase.from("deal_terms").update({ status: "accepted" }).eq("id", params.termsId);
        const { data: deal } = await supabase.from("deals").select("status").eq("id", params.dealId).single();
        if (deal && (deal.status === "pending" || deal.status === "briefing")) {
          await supabase.from("deals").update({ status: "in_progress" }).eq("id", params.dealId);
          logEvent.mutate({ dealId: params.dealId, action: "Условия согласованы обеими сторонами. Сделка переведена в работу.", category: "terms" });
        }
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["deal_terms", vars.dealId] });
      logEvent.mutate({ dealId: vars.dealId, action: `Подтвердил условия v${vars.version}`, category: "terms" });
      toast.success("Условия подтверждены");
    },
  });
}
