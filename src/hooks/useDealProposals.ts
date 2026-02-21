import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface DealProposal {
  id: string;
  advertiser_id: string;
  creator_id: string;
  placement_type: string;
  offer_id: string | null;
  budget_value: number | null;
  budget_min: number | null;
  budget_max: number | null;
  publish_start: string | null;
  publish_end: string | null;
  brief_text: string;
  cta: string;
  restrictions: string;
  revisions_count: number;
  acceptance_criteria: string;
  ord_responsibility: string;
  attachments: any[];
  status: string;
  last_opened_at: string;
  created_at: string;
  updated_at: string;
}

export function useMyDrafts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["deal-proposals-drafts", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("deal_proposals" as any)
        .select("*")
        .eq("advertiser_id", user.id)
        .eq("status", "draft")
        .order("updated_at", { ascending: false });
      return (data || []) as unknown as DealProposal[];
    },
    enabled: !!user?.id,
  });
}

export function useExistingDraft(creatorId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["deal-proposal-draft", user?.id, creatorId],
    queryFn: async () => {
      if (!user?.id || !creatorId) return null;
      const { data } = await supabase
        .from("deal_proposals" as any)
        .select("*")
        .eq("advertiser_id", user.id)
        .eq("creator_id", creatorId)
        .eq("status", "draft")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as unknown as DealProposal | null;
    },
    enabled: !!user?.id && !!creatorId,
  });
}

export function useSaveDraft() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (draft: Partial<DealProposal> & { creator_id: string }) => {
      if (!user?.id) throw new Error("Not authenticated");
      const payload = {
        ...draft,
        advertiser_id: user.id,
        status: "draft",
        last_opened_at: new Date().toISOString(),
      };

      if (draft.id) {
        const { data, error } = await supabase
          .from("deal_proposals" as any)
          .update(payload)
          .eq("id", draft.id)
          .select()
          .single();
        if (error) throw error;
        return data as unknown as DealProposal;
      } else {
        const { data, error } = await supabase
          .from("deal_proposals" as any)
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        return data as unknown as DealProposal;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deal-proposals-drafts"] });
      queryClient.invalidateQueries({ queryKey: ["deal-proposal-draft"] });
    },
  });
}
