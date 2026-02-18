import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AdvertiserPartnerScore {
  advertiserId: string;
  partnerScore: number;
  totalRatings: number;
  avgPaymentTimeliness: number;
  isLowScore: boolean; // below 3.0
}

export function useAdvertiserScores() {
  const { data: ratings = [], isLoading } = useQuery({
    queryKey: ["ratings-partner-scores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ratings")
        .select("to_id, payment_timeliness, brief_adequacy, communication, agreement_compliance, repeat_willingness, overall");
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const scores = useMemo(() => {
    const map = new Map<string, typeof ratings>();
    for (const r of ratings) {
      if (!r.to_id) continue;
      const arr = map.get(r.to_id) || [];
      arr.push(r);
      map.set(r.to_id, arr);
    }

    const result = new Map<string, AdvertiserPartnerScore>();
    for (const [advId, advRatings] of map) {
      const avg = (key: string) => {
        const vals = advRatings.map((r: any) => r[key]).filter((v: any) => v != null);
        return vals.length ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : 0;
      };
      const pt = avg("payment_timeliness");
      const ba = avg("brief_adequacy");
      const c = avg("communication");
      const ac = avg("agreement_compliance");
      const rw = avg("repeat_willingness");
      const hasNew = pt > 0 || ba > 0 || ac > 0 || rw > 0;
      const partnerScore = hasNew
        ? pt * 0.25 + ba * 0.2 + c * 0.2 + ac * 0.2 + rw * 0.15
        : avg("overall") || 0;

      result.set(advId, {
        advertiserId: advId,
        partnerScore,
        totalRatings: advRatings.length,
        avgPaymentTimeliness: pt,
        isLowScore: partnerScore > 0 && partnerScore < 3.0,
      });
    }
    return result;
  }, [ratings]);

  return { scores, isLoading };
}
