import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ContractRecord {
  id: string;
  user_id: string;
  campaign_id: string | null;
  version: number;
  document_type: string;
  file_name: string | null;
  file_size: number | null;
  stored_text: string | null;
  extracted_fields: Record<string, any>;
  confidence_map: Record<string, number>;
  source_snippets: Record<string, string>;
  status: string;
  confirmed_by: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface SaveContractParams {
  campaignId?: string;
  version?: number;
  documentType: "original" | "addendum";
  fileName?: string;
  fileSize?: number;
  storedText?: string | null;
  extractedFields: Record<string, any>;
  confidenceMap?: Record<string, number>;
  sourceSnippets?: Record<string, string>;
  status?: string;
}

export function useContractsByCampaign(campaignId: string | undefined) {
  return useQuery({
    queryKey: ["contracts", campaignId],
    queryFn: async () => {
      if (!campaignId) return [];
      const { data, error } = await supabase
        .from("contracts")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("version", { ascending: true });
      if (error) throw error;
      return data as ContractRecord[];
    },
    enabled: !!campaignId,
  });
}

export function useSaveContract() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SaveContractParams) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("contracts")
        .insert({
          user_id: user.id,
          campaign_id: params.campaignId || null,
          version: params.version || 1,
          document_type: params.documentType,
          file_name: params.fileName || null,
          file_size: params.fileSize || null,
          stored_text: params.storedText || null,
          extracted_fields: params.extractedFields,
          confidence_map: params.confidenceMap || {},
          source_snippets: params.sourceSnippets || {},
          status: params.status || "extracted",
        })
        .select()
        .single();

      if (error) throw error;
      return data as ContractRecord;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["contracts", data.campaign_id] });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
    },
  });
}

export function useConfirmContract() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contractId: string) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("contracts")
        .update({
          status: "confirmed",
          confirmed_by: user.id,
          confirmed_at: new Date().toISOString(),
        })
        .eq("id", contractId)
        .select()
        .single();

      if (error) throw error;
      return data as ContractRecord;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["contracts", data.campaign_id] });
    },
  });
}
