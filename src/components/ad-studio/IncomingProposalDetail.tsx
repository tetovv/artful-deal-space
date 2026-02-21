import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  useDealTerms, useDealFiles, useDownloadDealFile,
} from "@/hooks/useDealData";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  CheckCircle2, MoreVertical, Download, FileText, Shield, CalendarDays,
  Video, FileEdit, Mic, Loader2, Send, ArrowLeftRight, XCircle, Paperclip,
  History, ChevronDown, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/* ─── Status helpers ─── */
const statusConfig: Record<string, { label: string; cls: string }> = {
  pending: { label: "Новое", cls: "bg-warning/15 text-warning border-warning/30" },
  briefing: { label: "Активно", cls: "bg-primary/15 text-primary border-primary/30" },
  in_progress: { label: "В работе", cls: "bg-primary/15 text-primary border-primary/30" },
  needs_changes: { label: "Ожидает ответа", cls: "bg-accent/15 text-accent-foreground border-accent/30" },
  completed: { label: "Завершено", cls: "bg-green-500/10 text-green-500 border-green-500/30" },
  disputed: { label: "Отклонено", cls: "bg-muted text-muted-foreground border-muted-foreground/20" },
  rejected: { label: "Отклонено", cls: "bg-muted text-muted-foreground border-muted-foreground/20" },
};

const placementIcons: Record<string, any> = {
  "Видео-интеграция": Video, "Видео": Video, "Пост": FileEdit, "Подкаст": Mic,
};

interface IncomingProposalDetailProps {
  open: boolean;
  onClose: () => void;
  deal: {
    id: string;
    title: string;
    status: string;
    budget: number | null;
    deadline: string | null;
    description: string | null;
    advertiser_id: string | null;
    advertiser_name: string;
    creator_id: string | null;
    created_at: string;
  };
  advertiserProfile?: { display_name: string; avatar_url: string | null } | null;
  brand?: { brand_name: string; business_verified: boolean; business_category: string } | null;
}

export function IncomingProposalDetail({ open, onClose, deal, advertiserProfile, brand }: IncomingProposalDetailProps) {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: terms = [] } = useDealTerms(deal.id);
  const { data: files = [] } = useDealFiles(deal.id);
  const downloadFile = useDownloadDealFile();

  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // Counter-offer state
  const [showCounterForm, setShowCounterForm] = useState(false);
  const [counterBudget, setCounterBudget] = useState("");
  const [counterDeadline, setCounterDeadline] = useState("");
  const [counterMessage, setCounterMessage] = useState("");
  const [submittingCounter, setSubmittingCounter] = useState(false);

  // All terms versions for timeline
  const allTermsSorted = useMemo(() => {
    if (!terms.length) return [];
    return [...terms].sort((a: any, b: any) => a.version - b.version);
  }, [terms]);

  // Latest terms
  const latestTerms = useMemo(() => {
    if (!allTermsSorted.length) return null;
    return allTermsSorted[allTermsSorted.length - 1];
  }, [allTermsSorted]);

  const termsFields = useMemo(() => {
    if (!latestTerms) return null;
    return latestTerms.fields as Record<string, string>;
  }, [latestTerms]);

  // Version history collapsed state
  const [historyOpen, setHistoryOpen] = useState(false);

  // Placement type from title or terms
  const placement = termsFields?.placementType || (() => {
    const t = deal.title.toLowerCase();
    if (t.includes("видео") || t.includes("video")) return "Видео-интеграция";
    if (t.includes("пост") || t.includes("post")) return "Пост";
    if (t.includes("подкаст") || t.includes("podcast")) return "Подкаст";
    return null;
  })();

  const PlacementIcon = placement ? placementIcons[placement] || FileText : FileText;
  const st = statusConfig[deal.status] || statusConfig.pending;

  /* ─── Actions ─── */
  const handleAccept = async () => {
    if (!user) return;
    setAccepting(true);
    try {
      // Update deal status
      await supabase.from("deals").update({ status: "briefing" }).eq("id", deal.id);

      // If terms exist, mark as accepted
      if (latestTerms) {
        await supabase.from("deal_terms_acceptance").insert({
          terms_id: (latestTerms as any).id,
          user_id: user.id,
        });
        await supabase.from("deal_terms").update({ status: "accepted" }).eq("id", (latestTerms as any).id);
      }

      // Create initial chat message
      const creatorName = profile?.display_name || "Автор";
      await supabase.from("messages").insert({
        deal_id: deal.id,
        sender_id: user.id,
        sender_name: creatorName,
        content: `Предложение принято. Готов(а) к работе!`,
      });

      // Audit
      await supabase.from("deal_audit_log").insert({
        deal_id: deal.id,
        user_id: user.id,
        action: "Автор принял предложение",
        category: "terms",
      });

      // Notify advertiser
      if (deal.advertiser_id) {
        await supabase.from("notifications").insert({
          user_id: deal.advertiser_id,
          title: "Предложение принято",
          message: `${creatorName} принял(а) ваше предложение «${deal.title}»`,
          type: "deal",
          link: "/ad-studio",
        });
      }

      toast.success("Сделка создана. Ожидайте резервирования средств.");
      qc.invalidateQueries({ queryKey: ["creator-incoming-deals"] });
      qc.invalidateQueries({ queryKey: ["my_deals"] });
      onClose();
      // Redirect to creator deal workspace (role-aware AdStudio)
      navigate("/marketplace", { state: { openDealId: deal.id } });
    } catch (err) {
      console.error(err);
      toast.error("Не удалось принять предложение");
    } finally {
      setAccepting(false);
    }
  };

  const handleReject = async () => {
    if (!user) return;
    setRejecting(true);
    try {
      await supabase.from("deals").update({ status: "rejected" }).eq("id", deal.id);

      await supabase.from("deal_audit_log").insert({
        deal_id: deal.id,
        user_id: user.id,
        action: `Автор отклонил предложение${rejectReason ? `: ${rejectReason}` : ""}`,
        category: "general",
        metadata: rejectReason ? { reason: rejectReason } : {},
      });

      if (deal.advertiser_id) {
        const creatorName = profile?.display_name || "Автор";
        await supabase.from("notifications").insert({
          user_id: deal.advertiser_id,
          title: "Предложение отклонено",
          message: `${creatorName} отклонил(а) предложение «${deal.title}»${rejectReason ? `. Причина: ${rejectReason}` : ""}`,
          type: "deal",
          link: "/ad-studio",
        });
      }

      toast.success("Предложение отклонено");
      qc.invalidateQueries({ queryKey: ["creator-incoming-deals"] });
      setShowRejectDialog(false);
      onClose();
    } catch (err) {
      toast.error("Ошибка при отклонении");
    } finally {
      setRejecting(false);
    }
  };

  const handleCounterOffer = async () => {
    if (!user || !counterMessage.trim()) return;
    setSubmittingCounter(true);
    try {
      const currentVersion = latestTerms ? (latestTerms as any).version : 0;
      const newFields = {
        ...(termsFields || {}),
        budget: counterBudget || termsFields?.budget || String(deal.budget || 0),
        deadline: counterDeadline || termsFields?.deadline || "",
        counterMessage: counterMessage,
      };

      await supabase.from("deal_terms").insert({
        deal_id: deal.id,
        created_by: user.id,
        version: currentVersion + 1,
        status: "draft",
        fields: newFields,
      });

      await supabase.from("deals").update({ status: "needs_changes" }).eq("id", deal.id);

      await supabase.from("deal_audit_log").insert({
        deal_id: deal.id,
        user_id: user.id,
        action: `Автор предложил изменения (v${currentVersion + 1})`,
        category: "terms",
        metadata: { counterBudget, counterDeadline },
      });

      if (deal.advertiser_id) {
        const creatorName = profile?.display_name || "Автор";
        await supabase.from("notifications").insert({
          user_id: deal.advertiser_id,
          title: "Предложены изменения",
          message: `${creatorName} предложил(а) изменения к «${deal.title}»`,
          type: "deal",
          link: "/ad-studio",
        });
      }

      toast.success("Предложение с изменениями отправлено рекламодателю");
      qc.invalidateQueries({ queryKey: ["creator-incoming-deals"] });
      setShowCounterForm(false);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Ошибка при отправке изменений");
    } finally {
      setSubmittingCounter(false);
    }
  };

  const isPending = deal.status === "pending";
  const isNeedsChanges = deal.status === "needs_changes";

  // Determine if this is a counter from advertiser (creator needs to respond)
  const latestCreatedBy = latestTerms ? (latestTerms as any).created_by : null;
  const advertiserCountered = isNeedsChanges && latestCreatedBy === deal.advertiser_id;
  const creatorCountered = isNeedsChanges && latestCreatedBy === user?.id;
  const canRespond = isPending || advertiserCountered;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-[720px] max-h-[90vh] p-0 gap-0 flex flex-col">
          <DialogHeader className="px-6 pt-5 pb-0">
            <DialogTitle className="text-lg sr-only">Детали предложения</DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0">
            <div className="px-6 pb-6 space-y-5">

              {/* ── Counter-offer banner ── */}
              {advertiserCountered && (
                <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <ArrowLeftRight className="h-4 w-4 text-warning" />
                    <span className="text-[14px] font-semibold text-foreground">
                      Рекламодатель предложил изменения (v{(latestTerms as any)?.version || "?"})
                    </span>
                  </div>
                  {termsFields?.counterMessage && (
                    <p className="text-[13px] text-foreground/80 bg-background/50 rounded-md px-3 py-2">«{termsFields.counterMessage}»</p>
                  )}
                </div>
              )}

              {/* ── Waiting for advertiser response ── */}
              {creatorCountered && (
                <div className="bg-muted/50 border border-border rounded-lg p-4 flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <span className="text-[14px] font-medium text-foreground">Ожидаем ответа рекламодателя</span>
                    <p className="text-[12px] text-muted-foreground">
                      Вы отправили встречное предложение (v{(latestTerms as any)?.version || "?"}). Редактирование заблокировано до ответа.
                    </p>
                  </div>
                </div>
              )}

              {/* ── 1. Header ── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border border-border shrink-0">
                      {advertiserProfile?.avatar_url
                        ? <img src={advertiserProfile.avatar_url} alt="" className="h-full w-full object-cover" />
                        : <span className="text-sm font-bold text-primary">{(advertiserProfile?.display_name || deal.advertiser_name).charAt(0)}</span>}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[16px] font-semibold text-foreground truncate">
                          {advertiserProfile?.display_name || deal.advertiser_name}
                        </span>
                        {brand?.business_verified && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />}
                      </div>
                      {brand?.brand_name && (
                        <p className="text-[12px] text-muted-foreground truncate">{brand.brand_name}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className={cn("text-[11px] border font-medium", st.cls)}>{st.label}</Badge>
                    {canRespond && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setShowRejectDialog(true)}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Отклонить предложение
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>

                {/* Budget + deadline + attachments */}
                <div className="flex items-center gap-4 text-sm flex-wrap">
                  <span className="font-bold text-foreground text-lg">{(deal.budget || 0).toLocaleString()} ₽</span>
                  {deal.deadline && (
                    <span className="text-foreground/70 flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      до {new Date(deal.deadline).toLocaleDateString("ru-RU")}
                    </span>
                  )}
                  {files.length > 0 && (
                    <span className="text-foreground/70 flex items-center gap-1">
                      <Paperclip className="h-3.5 w-3.5" />
                      {files.length}
                    </span>
                  )}
                </div>
              </div>

              <Separator />

              {/* ── 2. Brief ── */}
              <div className="space-y-3">
                <h3 className="text-[14px] font-semibold text-foreground">Бриф</h3>
                {(deal.description || termsFields?.brief) ? (
                  <div className="space-y-2.5">
                    <p className="text-[14px] text-foreground/90 leading-relaxed whitespace-pre-wrap">
                      {deal.description || termsFields?.brief}
                    </p>
                    {termsFields?.cta && (
                      <div className="rounded-lg bg-primary/5 border border-primary/15 px-3 py-2">
                        <span className="text-[12px] font-medium text-muted-foreground block mb-0.5">CTA</span>
                        <span className="text-[13px] text-foreground">{termsFields.cta}</span>
                      </div>
                    )}
                    {termsFields?.restrictions && (
                      <div className="rounded-lg bg-destructive/5 border border-destructive/15 px-3 py-2">
                        <span className="text-[12px] font-medium text-muted-foreground block mb-0.5">Ограничения</span>
                        <span className="text-[13px] text-foreground">{termsFields.restrictions}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[13px] text-muted-foreground italic">Текст брифа не предоставлен</p>
                )}
              </div>

              {/* ── 3. Placement details (compact, hide empty) ── */}
              {(placement || termsFields?.revisions || termsFields?.acceptanceCriteria) && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h3 className="text-[14px] font-semibold text-foreground">Размещение</h3>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                      {placement && (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[12px] text-muted-foreground">Тип</span>
                          <span className="text-[14px] font-medium text-foreground flex items-center gap-1.5">
                            <PlacementIcon className="h-3.5 w-3.5 text-primary" />
                            {placement}
                          </span>
                        </div>
                      )}
                      {termsFields?.platform && (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[12px] text-muted-foreground">Платформа</span>
                          <span className="text-[14px] font-medium text-foreground">{termsFields.platform}</span>
                        </div>
                      )}
                      {termsFields?.revisions && (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[12px] text-muted-foreground">Правки</span>
                          <span className="text-[14px] font-medium text-foreground">{termsFields.revisions}</span>
                        </div>
                      )}
                      {termsFields?.acceptanceCriteria && (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[12px] text-muted-foreground">Критерии приёмки</span>
                          <span className="text-[14px] font-medium text-foreground">{termsFields.acceptanceCriteria}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* ── 4. Marking ── */}
              <Separator />
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary shrink-0" />
                <span className="text-[13px] text-foreground/80">
                  {termsFields?.markingResponsibility === "Рекламодатель"
                    ? "Маркировку обеспечивает рекламодатель"
                    : "Маркировка обеспечивается платформой"}
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-muted-foreground cursor-help text-[11px] underline underline-offset-2 decoration-dotted">?</span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[220px]">
                    <p className="text-xs">Платформа автоматически регистрирует креативы в ОРД и добавляет маркировку «Реклама» с ERID.</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* ── 5. Version history timeline (collapsed) ── */}
              {allTermsSorted.length > 1 && (
                <>
                  <Separator />
                  <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
                    <CollapsibleTrigger className="flex items-center gap-2 w-full group">
                      <History className="h-4 w-4 text-muted-foreground" />
                      <span className="text-[14px] font-semibold text-foreground">История версий ({allTermsSorted.length})</span>
                      <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform ml-auto", historyOpen && "rotate-180")} />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-3">
                      <div className="relative pl-4 space-y-0">
                        {allTermsSorted.map((t: any, idx: number) => {
                          const isLatest = idx === allTermsSorted.length - 1;
                          const tFields = t.fields as Record<string, string>;
                          const createdByCreator = t.created_by === deal.creator_id;
                          const vDate = new Date(t.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
                          const prevT = idx > 0 ? allTermsSorted[idx - 1] : null;
                          const prevFields = prevT ? (prevT.fields as Record<string, string>) : null;

                          // Detect changes from previous version
                          const changes: string[] = [];
                          if (prevFields) {
                            if (tFields.budget && tFields.budget !== prevFields.budget)
                              changes.push(`Бюджет: ${Number(prevFields.budget || 0).toLocaleString()} → ${Number(tFields.budget).toLocaleString()} ₽`);
                            if (tFields.deadline && tFields.deadline !== prevFields.deadline)
                              changes.push(`Дедлайн: ${prevFields.deadline || "—"} → ${tFields.deadline}`);
                          }

                          return (
                            <div key={t.id} className="relative pb-4 last:pb-0">
                              {/* Timeline line */}
                              {idx < allTermsSorted.length - 1 && (
                                <div className="absolute left-0 top-3 bottom-0 w-px bg-border" />
                              )}
                              {/* Timeline dot */}
                              <div className={cn(
                                "absolute left-0 top-1.5 w-2 h-2 rounded-full -translate-x-[3.5px] border-2",
                                isLatest
                                  ? "bg-primary border-primary"
                                  : t.status === "accepted"
                                    ? "bg-success border-success"
                                    : "bg-muted-foreground/40 border-muted-foreground/40"
                              )} />
                              <div className={cn("ml-4 rounded-lg p-2.5", isLatest ? "bg-primary/5 border border-primary/20" : "")}>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={cn("text-[13px] font-semibold", isLatest ? "text-primary" : "text-foreground")}>
                                    v{t.version}
                                  </span>
                                  <Badge variant="outline" className={cn("text-[10px] h-5", 
                                    t.status === "accepted" ? "bg-success/10 text-success border-success/30" :
                                    isLatest ? "bg-primary/10 text-primary border-primary/30" :
                                    "bg-muted text-muted-foreground border-muted-foreground/20"
                                  )}>
                                    {t.status === "accepted" ? "Принято" : isLatest ? "Текущая" : "Заменена"}
                                  </Badge>
                                  <span className="text-[11px] text-muted-foreground">{vDate}</span>
                                  <span className="text-[11px] text-muted-foreground">
                                    · {createdByCreator ? "Вы" : (advertiserProfile?.display_name || deal.advertiser_name)}
                                  </span>
                                </div>
                                {tFields.counterMessage && (
                                  <p className="text-[12px] text-foreground/70 mt-1 italic">«{tFields.counterMessage}»</p>
                                )}
                                {changes.length > 0 && (
                                  <div className="flex flex-wrap gap-2 mt-1">
                                    {changes.map((c, ci) => (
                                      <span key={ci} className="text-[11px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">{c}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </>
              )}

              {/* ── 6. Attachments ── */}
              {files.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h3 className="text-[14px] font-semibold text-foreground">Файлы ({files.length})</h3>
                    <div className="space-y-1">
                      {files.map((f) => (
                        <div key={f.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/30 transition-colors">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-foreground truncate">{f.file_name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {((f.file_size || 0) / 1024).toFixed(0)} KB
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => downloadFile.mutate(f.storage_path)}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* ── Counter-offer form ── */}
              {showCounterForm && (
                <>
                  <Separator />
                  <div className="space-y-3 bg-muted/20 rounded-xl p-4 border border-border">
                    <h3 className="text-[14px] font-semibold text-foreground flex items-center gap-2">
                      <ArrowLeftRight className="h-4 w-4 text-primary" />
                      Встречное предложение
                    </h3>

                    {/* Current terms summary */}
                    <div className="rounded-lg bg-background border border-border px-3 py-2 space-y-1">
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Текущие условия</p>
                      <div className="flex items-center gap-4 text-[13px]">
                        <span className="text-foreground/80">
                          Бюджет: <span className="font-semibold text-foreground">{(deal.budget || 0).toLocaleString()} ₽</span>
                        </span>
                        {deal.deadline && (
                          <span className="text-foreground/80">
                            Дедлайн: <span className="font-semibold text-foreground">{new Date(deal.deadline).toLocaleDateString("ru-RU")}</span>
                          </span>
                        )}
                        {placement && (
                          <span className="text-foreground/80">
                            Тип: <span className="font-semibold text-foreground">{placement}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[12px] font-medium text-muted-foreground">
                          Новая цена (₽)
                          {counterBudget && Number(counterBudget) !== (deal.budget || 0) && (
                            <span className="ml-1 text-primary">{(deal.budget || 0).toLocaleString()} → {Number(counterBudget).toLocaleString()}</span>
                          )}
                        </label>
                        <Input
                          type="number"
                          value={counterBudget}
                          onChange={(e) => setCounterBudget(e.target.value)}
                          placeholder={(deal.budget || 0).toLocaleString()}
                          className="h-9 text-[13px]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[12px] font-medium text-muted-foreground">
                          Новый дедлайн
                          {counterDeadline && deal.deadline && counterDeadline !== deal.deadline.slice(0, 10) && (
                            <span className="ml-1 text-primary">→ {new Date(counterDeadline).toLocaleDateString("ru-RU")}</span>
                          )}
                        </label>
                        <Input
                          type="date"
                          value={counterDeadline}
                          onChange={(e) => setCounterDeadline(e.target.value)}
                          className="h-9 text-[13px]"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[12px] font-medium text-muted-foreground">
                        Почему предлагаете изменения? <span className="text-destructive">*</span>
                      </label>
                      <Textarea
                        value={counterMessage}
                        onChange={(e) => setCounterMessage(e.target.value)}
                        placeholder="Например: прошу увеличить бюджет, так как формат требует дополнительной подготовки…"
                        rows={2}
                        className="text-[13px]"
                      />
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      <Button variant="ghost" size="sm" className="h-8 text-[13px]" onClick={() => setShowCounterForm(false)}>
                        Отмена
                      </Button>
                      <Button
                        size="sm"
                        className="h-9 text-[13px] gap-1.5"
                        disabled={!counterMessage.trim() || submittingCounter}
                        onClick={handleCounterOffer}
                      >
                        {submittingCounter ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        Отправить встречное
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>

          {/* ── Footer: max 2 visible actions ── */}
          {canRespond && !showCounterForm && (
            <div className="flex items-center justify-end gap-2.5 px-6 py-3.5 border-t border-border bg-card">
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5"
                onClick={() => setShowCounterForm(true)}
              >
                <ArrowLeftRight className="h-4 w-4" />
                Встречное предложение
              </Button>
              <Button
                size="sm"
                className="h-9 gap-1.5"
                disabled={accepting}
                onClick={handleAccept}
              >
                {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Принять предложение
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Reject confirmation ── */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отклонить предложение?</AlertDialogTitle>
            <AlertDialogDescription>
              Рекламодатель будет уведомлён об отклонении. Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <label className="text-[13px] font-medium text-foreground">Причина (необязательно)</label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Укажите причину отклонения..."
              rows={2}
              className="text-[13px]"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={rejecting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {rejecting ? "Отклонение…" : "Отклонить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
