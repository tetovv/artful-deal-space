import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";

/**
 * Track post impression: fires when element is ≥50% visible for ≥1 second.
 * Deduplicates per user per post per day via DB unique constraint.
 */
export function usePostImpressionTracker(
  postId: string | undefined,
  elementRef: React.RefObject<HTMLElement | null>
) {
  const { user } = useAuth();
  const recordedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<number>(0);

  const recordImpression = useCallback(async (visibleMs: number) => {
    if (!user?.id || !postId || recordedRef.current) return;
    recordedRef.current = true;

    const today = new Date().toISOString().slice(0, 10);
    await supabase.from("post_impressions" as any).upsert(
      {
        post_id: postId,
        viewer_user_id: user.id,
        visible_ms: Math.round(visibleMs),
        date_bucket: today,
      },
      { onConflict: "viewer_user_id,post_id,date_bucket" }
    );
  }, [user?.id, postId]);

  useEffect(() => {
    const el = elementRef.current;
    if (!el || !postId || !user?.id) return;

    recordedRef.current = false;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          startRef.current = Date.now();
          timerRef.current = setTimeout(() => {
            const elapsed = Date.now() - startRef.current;
            recordImpression(elapsed);
          }, 1000);
        } else {
          if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
          }
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [postId, elementRef, recordImpression, user?.id]);
}

/**
 * Fetch impression counts for a batch of post IDs.
 */
export function usePostImpressionCounts(postIds: string[]) {
  return useQuery({
    queryKey: ["post-impression-counts", postIds.sort().join(",")],
    queryFn: async () => {
      if (postIds.length === 0) return {} as Record<string, number>;
      const { data } = await supabase.rpc("get_post_impressions_batch" as any, {
        p_post_ids: postIds,
      });
      const map: Record<string, number> = {};
      if (data) {
        (data as any[]).forEach((r: any) => {
          map[r.post_id] = Number(r.impression_count);
        });
      }
      return map;
    },
    enabled: postIds.length > 0,
    staleTime: 30_000,
  });
}
