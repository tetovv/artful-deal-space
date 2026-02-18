import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

export interface UserRoleInfo {
  roles: AppRole[];
  primaryRole: AppRole;
  isCreator: boolean;
  isAdvertiser: boolean;
  isModerator: boolean;
  isSupport: boolean;
  isUser: boolean;
}

export function useUserRole(): UserRoleInfo & { isLoading: boolean } {
  const { user } = useAuth();

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ["user-roles", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      return (data || []).map((r) => r.role);
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const primaryRole: AppRole = roles.includes("moderator")
    ? "moderator"
    : roles.includes("creator")
    ? "creator"
    : roles.includes("advertiser")
    ? "advertiser"
    : "user";

  return {
    roles,
    primaryRole,
    isCreator: roles.includes("creator"),
    isAdvertiser: roles.includes("advertiser"),
    isModerator: roles.includes("moderator"),
    isSupport: roles.includes("support"),
    isUser: roles.length === 0 || roles.includes("user"),
    isLoading,
  };
}
