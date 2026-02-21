import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDealTerms, useDealFiles, useDownloadDealFile } from "@/hooks/useDealData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ArrowLeft, CheckCircle2, MoreVertical, Download, FileText, Shield,
  CalendarDays, Video, FileEdit, Mic, Loader2, Send, ArrowLeftRight,
  XCircle, Paperclip, History, ChevronDown, Clock, AlertTriangle, MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PageTransition } from "@/components/layout/PageTransition";

/* ─── Status config ─── */
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

export default function CreatorProposal() {
  const { proposalId } = useParams<{ proposalId: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const qc = useQueryClient();

  // Fetch deal
  const { data: deal, isLoading } = useQuery({
    queryKey: ["proposal-deal", proposalId],
    queryFn: async () => {
      if (!proposalId) return null;
      const { data, error } = await supabase
        .from("deals")
        .select("*")
        .eq("id", proposalId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!proposalId,
  });

  // Fetch advertiser profile
  const { data: advertiserProfile } = useQuery({
    queryKey: ["adv-profile", deal?.advertiser_id],
    queryFn: async () => {
      if (!deal?.advertiser_id) return null;
      const { data } = await supabase.from("profiles").select("display_name, avatar_url").eq("user_id", deal.advertiser_id).single();
      return data;
    },
    enabled: !!deal?.advertiser_id,
  });

  // Fetch brand
  const { data: brand } = useQuery({
    queryKey: ["adv-brand", deal?.advertiser_id],
    queryFn: async () => {
      if (!deal?.advertiser_id) return null;
      const { data } = await supabase.rpc("get_advertiser_brand", { p_user_id: deal.advertiser_id });
      return data?.[0] || null;
    },
    enabled: !!deal?.advertiser_id,
  });

  const { data: terms = [] } = useDealTerms(deal?.id || "");
  const { data: files = [] } = useDealFiles(deal?.id || "");
  const downloadFile = useDownloadDealFile();

  // State
  const [accepting, setAccepting] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [showCounterForm, setShowCounterForm] = useState(false);
  const [counterBudget, setCounterBudget] = useState("");
  const [counterDeadline, setCounterDeadline] = useState("");
  const [counterMessage, setCounterMessage] = useState("");
  const [submittingCounter, setSubmittingCounter] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Derived
  const allTermsSorted = useMemo(() => {
    if (!terms.length) return [];
    return [...terms].sort((a: any, b: any) => a.version - b.version);
  }, [terms]);

  const latestTerms = useMemo(() => {
    if (!allTermsSorted.length) return null;
    return allTermsSorted[allTermsSorted.length - 1];
  }, [allTermsSorted]);

  const termsFields = useMemo(() => {
    if (!latestTerms) return null;
    return (latestTerms as any).fields as Record<string, string>;
  }, [latestTerms]);

  const placement = termsFields?.placementType || (() => {
    if (!deal) return null;
    const t = deal.title.toLowerCase();
    if (t.includes("видео") || t.includes("video")) return "Видео-интеграция";
    if (t.includes("пост") || t.includes("post")) return "Пост";
    if (t.includes("подкаст") || t.includes("podcast")) return "Подкаст";
    return null;
  })();

  const PlacementIcon = placement ? placementIcons[placement] || FileText : FileText;
  const st = statusConfig[deal?.status || "pending"] || statusConfig.pending;

  const isPending = deal?.status === "pending";
  const isNeedsChanges = deal?.status === "needs_changes";
  const latestCreatedBy = latestTerms ? (latestTerms as any).created_by : null;
  const advertiserCountered = isNeedsChanges && latestCreatedBy === deal?.advertiser_id;
  const creatorCountered = isNeedsChanges && latestCreatedBy === user?.id;
  const canRespond = isPending || advertiserCountered;

  // Security check
  const isAuthorized = deal && deal.creator_id === user?.id;

  /* ─── Actions ─── */
  const handleAccept = async () => {
    if (!user || !deal) return;
    setAccepting(true);
    try {
      await supabase.from("deals").update({ status: "briefing" }).eq("id", deal.id);
      if (latestTerms) {
        await supabase.from("deal_terms_acceptance").insert({ terms_id: (latestTerms as any).id, user_id: user.id });
        await supabase.from("deal_terms").update({ status: "accepted" }).eq("id", (latestTerms as any).id);
      }
      const creatorName = profile?.display_name || "Автор";
      await supabase.from("messages").insert({ deal_id: deal.id, sender_id: user.id, sender_name: creatorName, content: "Предложение принято. Готов(а) к работе!" });
      await supabase.from("deal_audit_log").insert({ deal_id: deal.id, user_id: user.id, action: "Автор принял предложение", category: "terms" });
      if (deal.advertiser_id) {
        await supabase.from("notifications").insert({ user_id: deal.advertiser_id, title: "Предложение принято", message: `${creatorName} принял(а) ваше предложение «${deal.title}»`, type: "deal", link: "/ad-studio" });
      }
      toast.success("Сделка создана. Ожидайте резервирования средств.");
      qc.invalidateQueries({ queryKey: ["creator-incoming-deals"] });
      qc.invalidateQueries({ queryKey: ["my_deals"] });
      navigate("/ad-studio", { state: { openDealId: deal.id } });
    } catch (err) {
      console.error(err);
      toast.error("Не удалось принять предложение");
    } finally {
      setAccepting(false);
    }
  };

  const handleReject = async () => {
    if (!user || !deal) return;
    setRejecting(true);
    try {
      await supabase.from("deals").update({ status: "rejected" }).eq("id", deal.id);
      await supabase.from("deal_audit_log").insert({ deal_id: deal.id, user_id: user.id, action: `Автор отклонил предложение${rejectReason ? `: ${rejectReason}` : ""}`, category: "general", metadata: rejectReason ? { reason: rejectReason } : {} });
      if (deal.advertiser_id) {
        await supabase.from("notifications").insert({ user_id: deal.advertiser_id, title: "Предложение отклонено", message: `${profile?.display_name || "Автор"} отклонил(а) предложение «${deal.title}»${rejectReason ? `. Причина: ${rejectReason}` : ""}`, type: "deal", link: "/ad-studio" });
      }
      toast.success("Предложение отклонено");
      qc.invalidateQueries({ queryKey: ["creator-incoming-deals"] });
      setShowRejectDialog(false);
      navigate("/marketplace");
    } catch {
      toast.error("Ошибка при отклонении");
    } finally {
      setRejecting(false);
    }
  };

  const handleCounterOffer = async () => {
    if (!user || !deal || !counterMessage.trim()) return;
    setSubmittingCounter(true);
    try {
      const currentVersion = latestTerms ? (latestTerms as any).version : 0;
      const newFields = {
        ...(termsFields || {}),
        budget: counterBudget || termsFields?.budget || String(deal.budget || 0),
        deadline: counterDeadline || termsFields?.deadline || "",
        counterMessage: counterMessage,
      };
      await supabase.from("deal_terms").insert({ deal_id: deal.id, created_by: user.id, version: currentVersion + 1, status: "draft", fields: newFields });
      await supabase.from("deals").update({ status: "needs_changes" }).eq("id", deal.id);
      await supabase.from("deal_audit_log").insert({ deal_id: deal.id, user_id: user.id, action: `Автор предложил изменения (v${currentVersion + 1})`, category: "terms", metadata: { counterBudget, counterDeadline } });
      if (deal.advertiser_id) {
        await supabase.from("notifications").insert({ user_id: deal.advertiser_id, title: "Предложены изменения", message: `${profile?.display_name || "Автор"} предложил(а) изменения к «${deal.title}»`, type: "deal", link: "/ad-studio" });
      }
      toast.success("Встречное предложение отправлено");
      qc.invalidateQueries({ queryKey: ["proposal-deal", proposalId] });
      qc.invalidateQueries({ queryKey: ["creator-incoming-deals"] });
      setShowCounterForm(false);
      setCounterBudget("");
      setCounterDeadline("");
      setCounterMessage("");
    } catch (err) {
      console.error(err);
      toast.error("Ошибка при отправке изменений");
    } finally {
      setSubmittingCounter(false);
    }
  };

  /* ─── Loading / Error states ─── */
  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <AlertTriangle className="h-8 w-8 text-warning" />
        <p className="text-[15px] text-muted-foreground">Предложение не найдено</p>
        <Button variant="outline" size="sm" onClick={() => navigate("/marketplace")}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Назад к предложениям
        </Button>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Shield className="h-8 w-8 text-destructive" />
        <p className="text-[15px] text-foreground font-medium">Доступ запрещён</p>
        <p className="text-[13px] text-muted-foreground">Это предложение адресовано другому автору.</p>
        <Button variant="outline" size="sm" onClick={() => navigate("/marketplace")}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Назад к предложениям
        </Button>
      </div>
    );
  }

  const rawBrief = deal.description;
  const hasBrief = rawBrief && rawBrief !== "0" && rawBrief.trim().length > 0;

  return (
    <PageTransition>
      <div className="max-w-[1100px] mx-auto px-4 lg:px-8 py-6 space-y-6">
        {/* ── Back link ── */}
        <button
          onClick={() => navigate("/marketplace")}
          className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Назад к предложениям
        </button>

        {/* ── Header ── */}
        <div className="space-y-3">
          {/* Counter-offer banner */}
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

          {/* Waiting banner */}
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

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border border-border shrink-0">
                {advertiserProfile?.avatar_url
                  ? <img src={advertiserProfile.avatar_url} alt="" className="h-full w-full object-cover" />
                  : <span className="text-sm font-bold text-primary">{(advertiserProfile?.display_name || deal.advertiser_name).charAt(0)}</span>}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-[18px] font-bold text-foreground truncate">
                    {advertiserProfile?.display_name || deal.advertiser_name}
                  </h1>
                  {brand?.business_verified && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                  <Badge variant="outline" className={cn("text-[11px] border font-medium shrink-0", st.cls)}>{st.label}</Badge>
                </div>
                {brand?.brand_name && (
                  <p className="text-[13px] text-muted-foreground truncate">{brand.brand_name}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Single primary CTA */}
              {canRespond && !showCounterForm && (
                <Button size="sm" className="h-9 gap-1.5" disabled={accepting} onClick={handleAccept}>
                  {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Принять предложение
                </Button>
              )}

              {creatorCountered && (
                <Badge variant="outline" className="text-[12px] border-muted-foreground/20 text-muted-foreground">
                  <Clock className="h-3 w-3 mr-1" />
                  Ожидание рекламодателя
                </Badge>
              )}

              {/* Kebab menu */}
              {canRespond && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setShowCounterForm(true)}>
                      <ArrowLeftRight className="h-4 w-4 mr-2" />
                      Встречное предложение
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setShowRejectDialog(true)}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Отклонить
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {/* Key meta line */}
          <div className="flex items-center gap-4 text-[14px] flex-wrap">
            {placement && (
              <span className="flex items-center gap-1.5 text-foreground font-medium">
                <PlacementIcon className="h-4 w-4 text-primary" />
                {placement}
              </span>
            )}
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
                {files.length} файлов
              </span>
            )}
          </div>
        </div>

        <Separator />

        {/* ── Two-column content ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* LEFT COLUMN: Proposal details */}
          <div className="lg:col-span-3 space-y-6">
            {/* Brief */}
            <div className="space-y-3">
              <h2 className="text-[15px] font-semibold text-foreground">Бриф</h2>
              {hasBrief ? (
                <div className="space-y-3">
                  <p className="text-[14px] text-foreground/90 leading-relaxed whitespace-pre-wrap">
                    {rawBrief}
                  </p>
                  {termsFields?.cta && (
                    <div className="rounded-lg bg-primary/5 border border-primary/15 px-3 py-2">
                      <span className="text-[12px] font-medium text-muted-foreground block mb-0.5">Призыв к действию (CTA)</span>
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
                <p className="text-[13px] text-muted-foreground italic">Бриф не предоставлен</p>
              )}
            </div>

            {/* Placement details — only show non-empty fields */}
            {(termsFields?.revisions || termsFields?.acceptanceCriteria) && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h2 className="text-[15px] font-semibold text-foreground">Детали размещения</h2>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                    {termsFields?.revisions && termsFields.revisions !== "Не указано" && (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[12px] text-muted-foreground">Правки</span>
                        <span className="text-[14px] font-medium text-foreground">{termsFields.revisions}</span>
                      </div>
                    )}
                    {termsFields?.acceptanceCriteria && termsFields.acceptanceCriteria !== "Не указано" && (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[12px] text-muted-foreground">Критерии приёмки</span>
                        <span className="text-[14px] font-medium text-foreground">{termsFields.acceptanceCriteria}</span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Marking (ORD) */}
            <Separator />
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary shrink-0" />
              <span className="text-[13px] text-foreground/80">
                Маркировка обеспечивается платформой
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

            {/* Attachments */}
            {files.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h2 className="text-[15px] font-semibold text-foreground">Файлы ({files.length})</h2>
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
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => downloadFile.mutate(f.storage_path)}>
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* RIGHT COLUMN: Negotiation */}
          <div className="lg:col-span-2 space-y-6">
            {/* Version timeline */}
            {allTermsSorted.length > 0 && (
              <div className="space-y-3">
                <Collapsible open={historyOpen || allTermsSorted.length <= 3} onOpenChange={setHistoryOpen}>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full group">
                    <History className="h-4 w-4 text-muted-foreground" />
                    <span className="text-[15px] font-semibold text-foreground">Версии ({allTermsSorted.length})</span>
                    {allTermsSorted.length > 3 && (
                      <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform ml-auto", historyOpen && "rotate-180")} />
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3">
                    <div className="relative pl-4 space-y-0">
                      {allTermsSorted.map((t: any, idx: number) => {
                        const isLatest = idx === allTermsSorted.length - 1;
                        const tFields = t.fields as Record<string, string>;
                        const createdByCreator = t.created_by === deal.creator_id;
                        const vDate = new Date(t.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
                        const prevT = idx > 0 ? allTermsSorted[idx - 1] : null;
                        const prevFields = prevT ? ((prevT as any).fields as Record<string, string>) : null;

                        const changes: string[] = [];
                        if (prevFields) {
                          if (tFields.budget && tFields.budget !== prevFields.budget)
                            changes.push(`Бюджет: ${Number(prevFields.budget || 0).toLocaleString()} → ${Number(tFields.budget).toLocaleString()} ₽`);
                          if (tFields.deadline && tFields.deadline !== prevFields.deadline)
                            changes.push(`Дедлайн: ${prevFields.deadline || "—"} → ${tFields.deadline}`);
                        }

                        return (
                          <div key={t.id} className="relative pb-4 last:pb-0">
                            {idx < allTermsSorted.length - 1 && (
                              <div className="absolute left-0 top-3 bottom-0 w-px bg-border" />
                            )}
                            <div className={cn(
                              "absolute left-0 top-1.5 w-2 h-2 rounded-full -translate-x-[3.5px] border-2",
                              isLatest ? "bg-primary border-primary" : t.status === "accepted" ? "bg-green-500 border-green-500" : "bg-muted-foreground/40 border-muted-foreground/40"
                            )} />
                            <div className={cn("ml-4 rounded-lg p-2.5", isLatest ? "bg-primary/5 border border-primary/20" : "")}>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={cn("text-[13px] font-semibold", isLatest ? "text-primary" : "text-foreground")}>
                                  v{t.version}
                                </span>
                                <Badge variant="outline" className={cn("text-[10px] h-5",
                                  t.status === "accepted" ? "bg-green-500/10 text-green-500 border-green-500/30" :
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
              </div>
            )}

            {/* Counter-offer form */}
            {showCounterForm && canRespond && (
              <div className="space-y-3 bg-muted/20 rounded-xl p-4 border border-border">
                <h3 className="text-[14px] font-semibold text-foreground flex items-center gap-2">
                  <ArrowLeftRight className="h-4 w-4 text-primary" />
                  Встречное предложение
                </h3>

                <div className="rounded-lg bg-background border border-border px-3 py-2 space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Текущие условия</p>
                  <div className="flex items-center gap-4 text-[13px] flex-wrap">
                    <span className="text-foreground/80">
                      Бюджет: <span className="font-semibold text-foreground">{(deal.budget || 0).toLocaleString()} ₽</span>
                    </span>
                    {deal.deadline && (
                      <span className="text-foreground/80">
                        Дедлайн: <span className="font-semibold text-foreground">{new Date(deal.deadline).toLocaleDateString("ru-RU")}</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[12px] font-medium text-muted-foreground">
                      Новая цена (₽) <span className="text-destructive">*</span>
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
                    <label className="text-[12px] font-medium text-muted-foreground">Новый дедлайн</label>
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
                    Комментарий <span className="text-destructive">*</span>
                  </label>
                  <Textarea
                    value={counterMessage}
                    onChange={(e) => setCounterMessage(e.target.value)}
                    placeholder="Объясните предлагаемые изменения…"
                    rows={2}
                    className="text-[13px]"
                  />
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setShowCounterForm(false)}>Отмена</Button>
                  <Button
                    size="sm"
                    className="gap-1.5"
                    disabled={!counterBudget.trim() || !counterMessage.trim() || submittingCounter}
                    onClick={handleCounterOffer}
                  >
                    {submittingCounter ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Отправить встречное
                  </Button>
                </div>
              </div>
            )}

            {/* Clarification box */}
            {canRespond && !showCounterForm && (
              <div className="rounded-lg border border-border p-3 space-y-2">
                <p className="text-[12px] font-medium text-muted-foreground flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Задать уточняющий вопрос
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Вопросы будут отправлены рекламодателю через систему уведомлений. Это не обязывающий чат — для полноценного общения примите предложение.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Reject dialog ── */}
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
    </PageTransition>
  );
}
