import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Film, ChevronDown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const DURATIONS = [
  { value: "15", label: "15 сек" },
  { value: "30", label: "30 сек" },
  { value: "60", label: "1 мин" },
  { value: "90", label: "1.5 мин" },
];

const LEAD_IN_OPTIONS = [
  { value: "0", label: "0 сек" },
  { value: "5", label: "5 сек" },
  { value: "10", label: "10 сек" },
  { value: "15", label: "15 сек" },
  { value: "25", label: "25 сек" },
];

interface MontageWizardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queryId?: string;
  evidenceSourceIds?: string[];
  /** Use video-meaning-search montage endpoint instead of generic montage */
  useVideoMeaningEndpoint?: boolean;
  /** Selected moment IDs for "selected" scope */
  selectedMomentIds?: string[];
}

export function MontageWizardModal({
  open, onOpenChange, queryId, evidenceSourceIds,
  useVideoMeaningEndpoint, selectedMomentIds,
}: MontageWizardModalProps) {
  const navigate = useNavigate();
  const [duration, setDuration] = useState("30");
  const [leadIn, setLeadIn] = useState("10");
  const [scope, setScope] = useState<string>(queryId ? "this_answer" : "all_results");
  const [generating, setGenerating] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session?.access_token) throw new Error("Not authenticated");

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${session.access_token}`,
      };

      if (useVideoMeaningEndpoint) {
        // Use video-meaning-search montage endpoint
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/video-meaning-search/montage`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              queryId,
              targetDurationSec: parseInt(duration),
              leadInSeconds: parseInt(leadIn),
              maxSegments: 5,
              selectedMomentIds: scope === "selected" ? selectedMomentIds : undefined,
            }),
          }
        );
        if (!res.ok) throw new Error("Generation failed");
        const data = await res.json();
        console.log("[analytics] montage_created");
        onOpenChange(false);
        navigate(`/montage/${data.projectId}`);
      } else {
        // Legacy montage endpoint
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/montage`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              targetDuration: parseInt(duration),
              scope,
              sourceQueryId: queryId || null,
              selectedSourceIds: scope === "selected" ? evidenceSourceIds : null,
            }),
          }
        );
        if (!res.ok) throw new Error("Generation failed");
        const data = await res.json();
        console.log("[analytics] montage_created");
        onOpenChange(false);
        navigate(`/montage/${data.id}`);
      }
    } catch {
      toast.error("Не удалось создать монтаж");
    } finally {
      setGenerating(false);
    }
  };

  const scopeOptions = [
    ...(queryId ? [{ value: "this_answer", label: "Источники этого ответа" }] : []),
    { value: "all_results", label: "Все доступные результаты" },
    ...((selectedMomentIds?.length || evidenceSourceIds?.length)
      ? [{ value: "selected", label: "Выбранные моменты" }]
      : []),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Film className="h-5 w-5 text-primary" />
            Создать монтаж
          </DialogTitle>
          <DialogDescription>
            Референсный монтаж — плейлист сегментов с deep-ссылками.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Duration */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Целевая длительность</Label>
            <RadioGroup value={duration} onValueChange={setDuration} className="flex gap-2">
              {DURATIONS.map((d) => (
                <Label
                  key={d.value}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-sm ${
                    duration === d.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <RadioGroupItem value={d.value} className="sr-only" />
                  {d.label}
                </Label>
              ))}
            </RadioGroup>
          </div>

          {/* Lead-in */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Контекст перед моментом</Label>
            <RadioGroup value={leadIn} onValueChange={setLeadIn} className="flex flex-wrap gap-2">
              {LEAD_IN_OPTIONS.map((o) => (
                <Label
                  key={o.value}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-sm ${
                    leadIn === o.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <RadioGroupItem value={o.value} className="sr-only" />
                  {o.label}
                </Label>
              ))}
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              Сколько секунд до момента включить для контекста
            </p>
          </div>

          {/* Advanced: scope */}
          {scopeOptions.length > 1 && (
            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
                Дополнительные параметры
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3 space-y-2">
                <Label className="text-sm font-medium">Область источников</Label>
                <RadioGroup value={scope} onValueChange={setScope} className="space-y-2">
                  {scopeOptions.map((s) => (
                    <Label key={s.value} className="flex items-center gap-2 text-sm cursor-pointer">
                      <RadioGroupItem value={s.value} />
                      {s.label}
                    </Label>
                  ))}
                </RadioGroup>
              </CollapsibleContent>
            </Collapsible>
          )}

          <Button
            className="w-full"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Генерация…</>
            ) : (
              "Сгенерировать"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
