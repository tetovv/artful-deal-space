import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CreatorAnalyticsData {
  demographics: {
    age_buckets?: { label: string; percent: number }[];
    gender?: { male: number; female: number; other: number };
    interests?: string[];
  };
  geo: { region: string; percent: number }[];
  platform_distribution: { type: string; percent: number }[];
}

export function useCreatorAnalytics(creatorId: string | undefined) {
  return useQuery({
    queryKey: ["creator-analytics", creatorId],
    queryFn: async () => {
      if (!creatorId) return null;
      const { data } = await supabase
        .from("creator_analytics" as any)
        .select("*")
        .eq("creator_id", creatorId)
        .maybeSingle();
      if (!data) return null;
      return {
        demographics: (data as any).demographics || {},
        geo: (data as any).geo || [],
        platform_distribution: (data as any).platform_distribution || [],
      } as CreatorAnalyticsData;
    },
    enabled: !!creatorId,
  });
}

export function useVideoViewsTrend(creatorId: string | undefined, days: number = 30) {
  return useQuery({
    queryKey: ["video-views-trend", creatorId, days],
    queryFn: async () => {
      if (!creatorId) return [];
      const { data } = await supabase.rpc("get_video_views_trend" as any, {
        p_creator_id: creatorId,
        p_days: days,
      });
      return (data || []) as { day: string; view_count: number }[];
    },
    enabled: !!creatorId,
    staleTime: 60_000,
  });
}

export function useCreatorsAvgViews(creatorIds: string[]) {
  return useQuery({
    queryKey: ["creators-avg-views-30pct", creatorIds.sort().join(",")],
    queryFn: async () => {
      if (creatorIds.length === 0) return {} as Record<string, { avgViews: number; videoCount: number }>;
      const { data } = await supabase.rpc("get_creators_avg_views_30pct" as any, {
        p_creator_ids: creatorIds,
      });
      const map: Record<string, { avgViews: number; videoCount: number }> = {};
      if (data) {
        (data as any[]).forEach((r: any) => {
          map[r.creator_id] = { avgViews: Math.round(Number(r.avg_views)), videoCount: Number(r.video_count) };
        });
      }
      return map;
    },
    enabled: creatorIds.length > 0,
    staleTime: 60_000,
  });
}
