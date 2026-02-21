import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLogDealEvent } from "@/hooks/useDealData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Radio, CheckCircle2, Clock, AlertTriangle, ClipboardCopy,
  Send, Loader2, ShieldCheck, Upload, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/* ─── Marking states ─── */
const MARKING_STATES = [
  "NOT_STARTED",
  "READY_TO_SUBMIT",
  "SUBMITTED_TO_ORD",
  "ERID_RECEIVED",
  "APPLIED",
  "VERIFIED",
] as const;

type MarkingState = typeof MARKING_STATES[number];

const stateLabels: Record<MarkingState, string> = {
  NOT_STARTED: "Не начато",
  READY_TO_SUBMIT: "Готово к отправке",
  SUBMITTED_TO_ORD: "Отправлено в ОРД",
  ERID_RECEIVED: "ERID получен",
  APPLIED: "ERID применён",
  VERIFIED: "Проверено",
};

const stateColors: Record<MarkingState, string> = {
  NOT_STARTED: "bg-muted text-muted-foreground border-muted-foreground/20",
  READY_TO_SUBMIT: "bg-warning/15 text-warning border-warning/30",
  SUBMITTED_TO_ORD: "bg-primary/15 text-primary border-primary/30",
  ERID_RECEIVED: "bg-success/15 text-success border-success/30",
  APPLIED: "bg-success/15 text-success border-success/30",
  VERIFIED: "bg-success/15 text-success border-success/30",
};

const responsibilityLabels: Record<string, { label: string; description: string }> = {
  advertiser: {
    label: "Рекламодатель",
    description: "Рекламодатель отвечает за получение ERID и регистрацию креатива в ОРД.",
  },
  creator: {
    label: "Автор",
    description: "Автор отвечает за получение ERID и регистрацию креатива в ОРД.",
  },
  platform: {
    label: "Платформа",
    description: "Платформа берёт на себя регистрацию креатива в ОРД и получение ERID.",
  },
};

interface MarkingTabProps {
  dealId: string;
}

export function MarkingTab({ dealId }: MarkingTabProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const logEvent = useLogDealEvent();

  const [eridInput, setEridInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  /* ── Fetch deal ── */
  const { data: deal } = useQuery({
    queryKey: ["deal_marking", dealId],
    queryFn: async () => {
      const { data } = await supabase.from("deals").select("*").eq("id", dealId).single();
      return data;
    },
    enabled: !!dealId,
  });

  /* ── Fetch ORD settings for current user ── */
  const { data: ordSettings } = useQuery({
    queryKey: ["ord-settings", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("studio_settings")
        .select("ord_identifier, ord_token, ord_verified")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const isAdvertiser = deal?.advertiser_id === user?.id;
  const isCreator = deal?.creator_id === user?.id;
  const markingState = (deal?.marking_state || "NOT_STARTED") as MarkingState;
  const erid = deal?.erid || null;
  const responsibility = deal?.marking_responsibility || "platform";
  const responsibilityInfo = responsibilityLabels[responsibility] || responsibilityLabels.platform;
  const isResponsible = (responsibility === "advertiser" && isAdvertiser) ||
                        (responsibility === "creator" && isCreator) ||
                        responsibility === "platform";
  const hasOrd = !!(ordSettings?.ord_verified && ordSettings?.ord_identifier);
  const stateUpdatedAt = deal?.marking_state_updated_at;

  /* ── Step indicator ── */
  const currentIndex = MARKING_STATES.indexOf(markingState);

  /* ── Actions ── */
  const handleSetErid = async () => {
    if (!eridInput.trim() || !deal) return;
    setSubmitting(true);
    try {
      await supabase.from("deals").update({
        erid: eridInput.trim(),
        marking_state: "ERID_RECEIVED",
        marking_state_updated_at: new Date().toISOString(),
      }).eq("id", deal.id);

      // System chat + audit
      const roleName = isAdvertiser ? "Рекламодатель" : "Автор";
      await supabase.from("messages").insert({
        deal_id: deal.id, sender_id: user!.id, sender_name: "Система",
        content: `🏷️ ${roleName} указал ERID: ${eridInput.trim()}`,
      });
      logEvent.mutate({ dealId: deal.id, action: `ERID получен: ${eridInput.trim()}`, category: "ord" });

      // Notify other party
      const notifyId = isAdvertiser ? deal.creator_id : deal.advertiser_id;
      if (notifyId) {
        await supabase.from("notifications").insert({
          user_id: notifyId, title: "ERID получен",
          message: `ERID для сделки «${deal.title}»: ${eridInput.trim()}`,
          type: "deal", link: isAdvertiser ? `/creator/proposals/${deal.id}` : "/ad-studio",
        });
      }

      toast.success("ERID сохранён");
      setEridInput("");
      qc.invalidateQueries({ queryKey: ["deal_marking", dealId] });
    } catch {
      toast.error("Ошибка сохранения ERID");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitToOrd = async () => {
    if (!deal) return;
    setSubmitting(true);
    try {
      await supabase.from("deals").update({
        marking_state: "SUBMITTED_TO_ORD",
        marking_state_updated_at: new Date().toISOString(),
      }).eq("id", deal.id);

      const roleName = isAdvertiser ? "Рекламодатель" : "Автор";
      await supabase.from("messages").insert({
        deal_id: deal.id, sender_id: user!.id, sender_name: "Система",
        content: `📤 ${roleName} отправил креатив в ОРД`,
      });
      logEvent.mutate({ dealId: deal.id, action: "Креатив отправлен в ОРД", category: "ord" });

      toast.success("Отправлено в ОРД");
      setShowSubmitConfirm(false);
      qc.invalidateQueries({ queryKey: ["deal_marking", dealId] });
    } catch {
      toast.error("Ошибка отправки");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkApplied = async () => {
    if (!deal) return;
    setSubmitting(true);
    try {
      await supabase.from("deals").update({
        marking_state: "APPLIED",
        marking_state_updated_at: new Date().toISOString(),
      }).eq("id", deal.id);

      const roleName = isAdvertiser ? "Рекламодатель" : "Автор";
      await supabase.from("messages").insert({
        deal_id: deal.id, sender_id: user!.id, sender_name: "Система",
        content: `✅ ${roleName} подтвердил: ERID применён в публикации`,
      });
      logEvent.mutate({ dealId: deal.id, action: "ERID применён в публикации", category: "ord" });

      const notifyId = isAdvertiser ? deal.creator_id : deal.advertiser_id;
      if (notifyId) {
        await supabase.from("notifications").insert({
          user_id: notifyId, title: "ERID применён",
          message: `ERID применён в публикации для «${deal.title}»`,
          type: "deal",
        });
      }

      toast.success("Отмечено как применённый");
      qc.invalidateQueries({ queryKey: ["deal_marking", dealId] });
    } catch {
      toast.error("Ошибка");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkVerified = async () => {
    if (!deal) return;
    setSubmitting(true);
    try {
      await supabase.from("deals").update({
        marking_state: "VERIFIED",
        marking_state_updated_at: new Date().toISOString(),
      }).eq("id", deal.id);

      await supabase.from("messages").insert({
        deal_id: deal.id, sender_id: user!.id, sender_name: "Система",
        content: "✅ Маркировка проверена и подтверждена",
      });
      logEvent.mutate({ dealId: deal.id, action: "Маркировка проверена", category: "ord" });

      toast.success("Маркировка проверена");
      qc.invalidateQueries({ queryKey: ["deal_marking", dealId] });
    } catch {
      toast.error("Ошибка");
    } finally {
      setSubmitting(false);
    }
  };

  if (!deal) return null;

  return (
    <div className="p-5 space-y-5 max-w-[820px] mx-auto">
      {/* ── Step progress ── */}
      <div className="flex items-center gap-1">
        {MARKING_STATES.map((state, i) => {
          const isPast = i < currentIndex;
          const isCurrent = i === currentIndex;
          return (
            <div key={state} className="flex items-center gap-1 flex-1">
              <div className={cn(
                "flex items-center justify-center h-7 w-7 rounded-full text-[11px] font-bold shrink-0 border",
                isPast ? "bg-success/15 text-success border-success/30" :
                isCurrent ? "bg-primary/15 text-primary border-primary/30" :
                "bg-muted text-muted-foreground border-border"
              )}>
                {isPast ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
              </div>
              {i < MARKING_STATES.length - 1 && (
                <div className={cn(
                  "flex-1 h-0.5 rounded",
                  isPast ? "bg-success/40" : "bg-border"
                )} />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn("text-[12px] border", stateColors[markingState])}>
            {stateLabels[markingState]}
          </Badge>
          {stateUpdatedAt && (
            <span className="text-[12px] text-muted-foreground">
              {new Date(stateUpdatedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      </div>

      {/* ── Responsibility card ── */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="text-[15px] font-semibold text-card-foreground">Ответственный за маркировку</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[13px]">{responsibilityInfo.label}</Badge>
            {isResponsible && (
              <span className="text-[12px] text-primary font-medium">(вы)</span>
            )}
          </div>
          <p className="text-[13px] text-muted-foreground leading-relaxed">{responsibilityInfo.description}</p>
        </CardContent>
      </Card>

      {/* ── ERID display (if received) ── */}
      {erid && (
        <Card className="border-success/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-success" />
                <span className="text-[15px] font-semibold text-card-foreground">ERID</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-primary text-[15px]">{erid}</span>
                <button onClick={() => { navigator.clipboard.writeText(erid); toast.success("ERID скопирован"); }}>
                  <ClipboardCopy className="h-4 w-4 text-primary hover:text-primary/80" />
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Actions based on state and role ── */}
      {markingState === "NOT_STARTED" && isResponsible && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-[14px] font-medium text-card-foreground">Начать процесс маркировки</p>
            {hasOrd ? (
              <Button className="text-[14px] h-10" onClick={() => setShowSubmitConfirm(true)}>
                <Send className="h-4 w-4 mr-1.5" /> Отправить в ОРД
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[13px] font-medium text-foreground">ОРД не подключён</p>
                      <p className="text-[12px] text-muted-foreground mt-0.5">
                        Подключите ОРД в настройках или введите ERID вручную.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={eridInput}
                    onChange={(e) => setEridInput(e.target.value)}
                    placeholder="Введите ERID…"
                    className="flex-1 h-10 font-mono text-[14px]"
                  />
                  <Button onClick={handleSetErid} disabled={!eridInput.trim() || submitting} className="h-10 text-[14px]">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Сохранить"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {markingState === "READY_TO_SUBMIT" && isResponsible && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-[14px] font-medium text-card-foreground">Креатив готов к отправке в ОРД</p>
            {hasOrd ? (
              <Button className="text-[14px] h-10" onClick={() => setShowSubmitConfirm(true)}>
                <Send className="h-4 w-4 mr-1.5" /> Отправить в ОРД
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  value={eridInput}
                  onChange={(e) => setEridInput(e.target.value)}
                  placeholder="Введите ERID вручную…"
                  className="flex-1 h-10 font-mono text-[14px]"
                />
                <Button onClick={handleSetErid} disabled={!eridInput.trim() || submitting} className="h-10 text-[14px]">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Сохранить ERID"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {markingState === "SUBMITTED_TO_ORD" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary animate-pulse" />
              <p className="text-[14px] font-medium text-card-foreground">Ожидаем ERID от ОРД</p>
            </div>
            {isResponsible && (
              <div className="flex items-center gap-2">
                <Input
                  value={eridInput}
                  onChange={(e) => setEridInput(e.target.value)}
                  placeholder="Введите полученный ERID…"
                  className="flex-1 h-10 font-mono text-[14px]"
                />
                <Button onClick={handleSetErid} disabled={!eridInput.trim() || submitting} className="h-10 text-[14px]">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Сохранить ERID"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {markingState === "ERID_RECEIVED" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-[14px] font-medium text-card-foreground">
              ERID получен. Отметьте, когда ERID будет размещён в публикации.
            </p>
            {/* Creator marks as applied, advertiser can also */}
            <Button
              variant="outline"
              className="text-[14px] h-10 gap-1.5"
              onClick={handleMarkApplied}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              ERID применён в публикации
            </Button>
          </CardContent>
        </Card>
      )}

      {markingState === "APPLIED" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <p className="text-[14px] font-medium text-card-foreground">ERID применён в публикации</p>
            </div>
            {/* Advertiser can verify */}
            {isAdvertiser && (
              <Button className="text-[14px] h-10 gap-1.5" onClick={handleMarkVerified} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Подтвердить маркировку
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {markingState === "VERIFIED" && (
        <Card className="border-success/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-success" />
              <p className="text-[15px] font-semibold text-success">Маркировка проверена и подтверждена</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Gating warning: shown when marking is required but ERID not yet received ── */}
      {currentIndex < MARKING_STATES.indexOf("ERID_RECEIVED") && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] font-medium text-foreground">Публикация заблокирована</p>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                Для подтверждения публикации требуется ERID. Получите ERID перед отправкой доказательства размещения.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Submit to ORD confirmation ── */}
      <AlertDialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отправить в ОРД?</AlertDialogTitle>
            <AlertDialogDescription>
              Метаданные креатива будут отправлены в ОРД для получения ERID. После получения ERID необходимо добавить его в публикацию.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmitToOrd} disabled={submitting}>
              {submitting ? "Отправка…" : "Отправить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
