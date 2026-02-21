import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";

/**
 * Track video watch progress and record a "view" when >= 30% watched.
 * Uses upsert with unique constraint (viewer_user_id, video_id, date_bucket).
 */
export function useVideoViewTracker(videoId: string | undefined, videoRef: React.RefObject<HTMLVideoElement | null>) {
  const { user } = useAuth();
  const maxPercentRef = useRef(0);
  const recordedRef = useRef(false);

  const recordView = useCallback(async (percent: number) => {
    if (!user?.id || !videoId || recordedRef.current) return;
    if (percent < 30) return;

    recordedRef.current = true;
    const today = new Date().toISOString().slice(0, 10);

    await supabase.from("video_views" as any).upsert(
      {
        video_id: videoId,
        viewer_user_id: user.id,
        watched_percent: Math.round(percent),
        date_bucket: today,
      },
      { onConflict: "viewer_user_id,video_id,date_bucket" }
    );
  }, [user?.id, videoId]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !videoId) return;

    maxPercentRef.current = 0;
    recordedRef.current = false;

    const onTimeUpdate = () => {
      if (!v.duration || v.duration === 0) return;
      const percent = (v.currentTime / v.duration) * 100;
      if (percent > maxPercentRef.current) {
        maxPercentRef.current = percent;
        if (percent >= 30 && !recordedRef.current) {
          recordView(percent);
        }
      }
    };

    v.addEventListener("timeupdate", onTimeUpdate);
    return () => v.removeEventListener("timeupdate", onTimeUpdate);
  }, [videoId, videoRef, recordView]);
}

/**
 * Fetch 30%-watched view counts for a batch of video IDs.
 */
export function useVideoViewCounts(videoIds: string[]) {
  return useQuery({
    queryKey: ["video-view-counts-30pct", videoIds.sort().join(",")],
    queryFn: async () => {
      if (videoIds.length === 0) return {} as Record<string, number>;
      const { data } = await supabase.rpc("get_video_views_batch" as any, {
        p_video_ids: videoIds,
      });
      const map: Record<string, number> = {};
      if (data) {
        (data as any[]).forEach((r: any) => {
          map[r.video_id] = Number(r.view_count);
        });
      }
      return map;
    },
    enabled: videoIds.length > 0,
    staleTime: 30_000,
  });
}
