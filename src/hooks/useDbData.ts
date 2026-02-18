import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

export type DbContentItem = Tables<"content_items">;
export type DbDeal = Tables<"deals">;
export type DbRating = Tables<"ratings">;
export type DbProfile = Tables<"profiles">;

export function useContentItems() {
  return useQuery({
    queryKey: ["content_items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_items")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as DbContentItem[];
    },
  });
}

export function useContentItem(id: string | undefined) {
  return useQuery({
    queryKey: ["content_item", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("content_items")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as DbContentItem;
    },
    enabled: !!id,
  });
}

export function useRatings() {
  return useQuery({
    queryKey: ["ratings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ratings").select("*");
      if (error) throw error;
      return data as DbRating[];
    },
  });
}

export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*");
      if (error) throw error;
      return data as DbProfile[];
    },
  });
}
