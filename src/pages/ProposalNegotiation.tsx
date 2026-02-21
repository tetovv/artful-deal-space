import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  useDealTerms, useDealFiles, useDownloadDealFile,
} from "@/hooks/useDealData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CheckCircle2, ArrowLeft, Download, FileText, Shield, CalendarDays,
  Video, FileEdit, Mic, Loader2, Send, ArrowLeftRight, XCircle, Paperclip,
  Clock, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PageTransition } from "@/components/layout/PageTransition";

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

export default function ProposalNegotiation() {
  const { proposalId } = useParams<{ proposalId: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const qc = useQueryClient();

  /* ─── Fetch deal ─── */
  const { data: deal, isLoading } = useQuery({
    queryKey: ["deal-detail", proposalId],
    queryFn: async () => {
      if (!proposalId) return null;
      const { data, error } = await supabase.from("deals").select("*").eq("id", proposalId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!proposalId,
  });

  const { data: terms = [] } = useDealTerms(proposalId || "");
  const { data: files = [] } = useDealFiles(proposalId || "");
  const downloadFile = useDownloadDealFile();

  /* ─── Advertiser profile & brand ─── */
  const advId = deal?.advertiser_id;
  const { data: advProfile } = useQuery({
    queryKey: ["adv-profile", advId],
    queryFn: async () => {
      if (!advId) return null;
      const { data } = await supabase.from("profiles").select("display_name, avatar_url").eq("user_id", advId).single();
      return data;
    },
    enabled: !!advId,
  });
  const { data: brandArr } = useQuery({
    queryKey: ["adv-brand", advId],
    queryFn: async () => {
      if (!advId) return null;
      const { data } = await supabase.rpc("get_advertiser_brand", { p_user_id: advId });
      return data && data.length > 0 ? data[0] : null;
    },
    enabled: !!advId,
  });
  const brand = brandArr;

  /* ─── Terms ─── */
  const allTermsSorted = useMemo(() => [...terms].sort((a: any, b: any) => a.version - b.version), [terms]);
  const latestTerms = allTermsSorted.length ? allTermsSorted[allTermsSorted.length - 1] : null;
  const termsFields = latestTerms ? (latestTerms.fields as Record<string, string>) : null;

  /* ─── Placement ─── */
  const placement = termsFields?.placementType || (() => {
    if (!deal) return null;
    const t = deal.title.toLowerCase();
    if (t.includes("видео") || t.includes("video")) return "Видео-интеграция";
    if (t.includes("пост") || t.includes("post")) return "Пост";
    if (t.includes("подкаст") || t.includes("podcast")) return "Подкаст";
    return null;
  })();
  const PlacementIcon = placement ? placementIcons[placement] || FileText : FileText;

  /* ─── State ─── */
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showCounterForm, setShowCounterForm] = useState(false);
  const [counterBudget, setCounterBudget] = useState("");
  const [counterDeadline, setCounterDeadline] = useState("");
  const [counterMessage, setCounterMessage] = useState("");
  const [submittingCounter, setSubmittingCounter] = useState(false);
  const [questionText, setQuestionText] = useState("");

  if (!deal) return null;

  const isPending = deal.status === "pending";
  const isNeedsChanges = deal.status === "needs_changes";
  const latestCreatedBy = latestTerms ? (latestTerms as any).created_by : null;
  const advertiserCountered = isNeedsChanges && latestCreatedBy === deal.advertiser_id;
  const creatorCountered = isNeedsChanges && latestCreatedBy === user?.id;
  const canRespond = isPending || advertiserCountered;
  const st = statusConfig[deal.status] || statusConfig.pending;

  const briefText = deal.description || termsFields?.brief;
  const hasBrief = briefText && briefText !== "0" && briefText.trim().length > 0;

  /* ─── Handlers ─── */
  const handleAccept = async () => {
    if (!user) return;
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
    } catch {
      toast.error("Не удалось принять предложение");
    } finally { setAccepting(false); }
  };

  const handleReject = async () => {
    if (!user) return;
    setRejecting(true);
    try {
      await supabase.from("deals").update({ status: "rejected" }).eq("id", deal.id);
      await supabase.from("deal_audit_log").insert({ deal_id: deal.id, user_id: user.id, action: `Автор отклонил предложение${rejectReason ? `: ${rejectReason}` : ""}`, category: "general", metadata: rejectReason ? { reason: rejectReason } : {} });
      if (deal.advertiser_id) {
        const creatorName = profile?.display_name || "Автор";
        await supabase.from("notifications").insert({ user_id: deal.advertiser_id, title: "Предложение отклонено", message: `${creatorName} отклонил(а) предложение «${deal.title}»${rejectReason ? `. Причина: ${rejectReason}` : ""}`, type: "deal", link: "/ad-studio" });
      }
      toast.success("Предложение отклонено");
      qc.invalidateQueries({ queryKey: ["creator-incoming-deals"] });
      setShowRejectDialog(false);
      navigate("/marketplace");
    } catch { toast.error("Ошибка при отклонении"); }
    finally { setRejecting(false); }
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
        counterMessage,
      };
      await supabase.from("deal_terms").insert({ deal_id: deal.id, created_by: user.id, version: currentVersion + 1, status: "draft", fields: newFields });
      await supabase.from("deals").update({ status: "needs_changes" }).eq("id", deal.id);
      await supabase.from("deal_audit_log").insert({ deal_id: deal.id, user_id: user.id, action: `Автор предложил изменения (v${currentVersion + 1})`, category: "terms", metadata: { counterBudget, counterDeadline } });
      if (deal.advertiser_id) {
        const creatorName = profile?.display_name || "Автор";
        await supabase.from("notifications").insert({ user_id: deal.advertiser_id, title: "Предложены изменения", message: `${creatorName} предложил(а) изменения к «${deal.title}»`, type: "deal", link: "/ad-studio" });
      }
      toast.success("Встречное предложение отправлено");
      qc.invalidateQueries({ queryKey: ["deal-detail", proposalId] });
      qc.invalidateQueries({ queryKey: ["deal-terms"] });
      setShowCounterForm(false);
      setCounterBudget(""); setCounterDeadline(""); setCounterMessage("");
    } catch { toast.error("Ошибка при отправке"); }
    finally { setSubmittingCounter(false); }
  };

  return (
    <PageTransition>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* ─── Back + Header ─── */}
        <div className="space-y-4">
          <button onClick={() => navigate("/marketplace")} className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Назад к предложениям
          </button>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border border-border shrink-0">
                {advProfile?.avatar_url
                  ? <img src={advProfile.avatar_url} alt="" className="h-full w-full object-cover" />
                  : <span className="text-[15px] font-bold text-primary">{(advProfile?.display_name || deal.advertiser_name).charAt(0)}</span>}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-[18px] font-bold text-foreground truncate">
                    {brand?.brand_name || advProfile?.display_name || deal.advertiser_name}
                  </h1>
                  {brand?.business_verified && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                </div>
                {brand?.brand_name && advProfile?.display_name && brand.brand_name !== advProfile.display_name && (
                  <p className="text-[13px] text-muted-foreground">{advProfile.display_name}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 flex-wrap">
              <Badge variant="outline" className={cn("text-[12px] border font-medium h-7 px-3", st.cls)}>{st.label}</Badge>
              {placement && (
                <Badge variant="secondary" className="text-[12px] h-7 px-3 gap-1">
                  <PlacementIcon className="h-3 w-3" /> {placement}
                </Badge>
              )}
              <span className="text-[18px] font-bold text-foreground">{(deal.budget || 0).toLocaleString()} ₽</span>
              {deal.deadline && (
                <span className="text-[14px] text-muted-foreground flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  до {new Date(deal.deadline).toLocaleDateString("ru-RU")}
                </span>
              )}
            </div>
          </div>

          {/* ─── Banners ─── */}
          {advertiserCountered && (
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 flex items-start gap-3">
              <ArrowLeftRight className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <div>
                <span className="text-[14px] font-semibold text-foreground">
                  Рекламодатель предложил изменения (v{(latestTerms as any)?.version || "?"})
                </span>
                {termsFields?.counterMessage && (
                  <p className="text-[13px] text-foreground/80 mt-1">«{termsFields.counterMessage}»</p>
                )}
              </div>
            </div>
          )}
          {creatorCountered && (
            <div className="bg-muted/50 border border-border rounded-lg p-4 flex items-center gap-3">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <span className="text-[14px] font-medium text-foreground">Ожидаем ответа рекламодателя</span>
                <p className="text-[12px] text-muted-foreground">Вы отправили встречное предложение (v{(latestTerms as any)?.version || "?"}). Редактирование заблокировано.</p>
              </div>
            </div>
          )}

          {/* Primary CTA bar */}
          {canRespond && !showCounterForm && (
            <div className="flex items-center gap-2.5">
              <Button className="h-10 gap-2 text-[14px]" disabled={accepting} onClick={handleAccept}>
                {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Принять текущую версию
              </Button>
              <Button variant="outline" className="h-10 gap-2 text-[14px]" onClick={() => setShowCounterForm(true)}>
                <ArrowLeftRight className="h-4 w-4" /> Встречное предложение
              </Button>
              <Button variant="ghost" size="sm" className="h-10 text-[13px] text-destructive hover:text-destructive" onClick={() => setShowRejectDialog(true)}>
                <XCircle className="h-4 w-4 mr-1" /> Отклонить
              </Button>
            </div>
          )}
        </div>

        <Separator />

        {/* ─── Two-column layout ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* ── Left: Summary (3 cols) ── */}
          <div className="lg:col-span-3 space-y-5">
            {/* Brief */}
            <section className="space-y-2">
              <h2 className="text-[16px] font-semibold text-foreground">Бриф</h2>
              {hasBrief ? (
                <div className="space-y-3">
                  <p className="text-[15px] text-foreground/90 leading-relaxed whitespace-pre-wrap">{briefText}</p>
                  {termsFields?.cta && (
                    <div className="rounded-lg bg-primary/5 border border-primary/15 px-3 py-2">
                      <span className="text-[12px] font-medium text-muted-foreground block mb-0.5">CTA</span>
                      <span className="text-[14px] text-foreground">{termsFields.cta}</span>
                    </div>
                  )}
                  {termsFields?.restrictions && (
                    <div className="rounded-lg bg-destructive/5 border border-destructive/15 px-3 py-2">
                      <span className="text-[12px] font-medium text-muted-foreground block mb-0.5">Ограничения</span>
                      <span className="text-[14px] text-foreground">{termsFields.restrictions}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[14px] text-muted-foreground italic">Бриф не предоставлен</p>
              )}
            </section>

            {/* Placement details */}
            {(placement || termsFields?.revisions || termsFields?.acceptanceCriteria) && (
              <section className="space-y-2">
                <h2 className="text-[16px] font-semibold text-foreground">Размещение</h2>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  {placement && (
                    <div><span className="text-[12px] text-muted-foreground block">Тип</span>
                      <span className="text-[14px] font-medium text-foreground flex items-center gap-1.5"><PlacementIcon className="h-3.5 w-3.5 text-primary" />{placement}</span>
                    </div>
                  )}
                  {termsFields?.platform && (
                    <div><span className="text-[12px] text-muted-foreground block">Платформа</span>
                      <span className="text-[14px] font-medium text-foreground">{termsFields.platform}</span>
                    </div>
                  )}
                  {termsFields?.revisions && (
                    <div><span className="text-[12px] text-muted-foreground block">Правки</span>
                      <span className="text-[14px] font-medium text-foreground">{termsFields.revisions}</span>
                    </div>
                  )}
                  {termsFields?.acceptanceCriteria && (
                    <div><span className="text-[12px] text-muted-foreground block">Критерии приёмки</span>
                      <span className="text-[14px] font-medium text-foreground">{termsFields.acceptanceCriteria}</span>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Marking */}
            <div className="flex items-center gap-2 rounded-lg bg-muted/30 border border-border px-3 py-2.5">
              <Shield className="h-4 w-4 text-primary shrink-0" />
              <span className="text-[13px] text-foreground/80">Маркировка обеспечивается платформой</span>
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
              <section className="space-y-2">
                <h2 className="text-[16px] font-semibold text-foreground flex items-center gap-2">
                  <Paperclip className="h-4 w-4" /> Файлы ({files.length})
                </h2>
                <div className="space-y-1">
                  {files.map((f) => (
                    <div key={f.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/30 transition-colors">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-foreground truncate">{f.file_name}</p>
                        <p className="text-[11px] text-muted-foreground">{((f.file_size || 0) / 1024).toFixed(0)} KB</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => downloadFile.mutate(f.storage_path)}>
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Counter-offer form */}
            {showCounterForm && (
              <section className="space-y-3 bg-muted/20 rounded-xl p-4 border border-border">
                <h3 className="text-[15px] font-semibold text-foreground flex items-center gap-2">
                  <ArrowLeftRight className="h-4 w-4 text-primary" /> Встречное предложение
                </h3>
                <div className="rounded-lg bg-background border border-border px-3 py-2 space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Текущие условия</p>
                  <div className="flex items-center gap-4 text-[13px]">
                    <span className="text-foreground/80">Бюджет: <span className="font-semibold text-foreground">{(deal.budget || 0).toLocaleString()} ₽</span></span>
                    {deal.deadline && <span className="text-foreground/80">Дедлайн: <span className="font-semibold text-foreground">{new Date(deal.deadline).toLocaleDateString("ru-RU")}</span></span>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[12px] font-medium text-muted-foreground">Новая цена (₽)</label>
                    <Input type="number" value={counterBudget} onChange={(e) => setCounterBudget(e.target.value)} placeholder={(deal.budget || 0).toLocaleString()} className="h-9 text-[13px]" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[12px] font-medium text-muted-foreground">Новый дедлайн</label>
                    <Input type="date" value={counterDeadline} onChange={(e) => setCounterDeadline(e.target.value)} className="h-9 text-[13px]" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[12px] font-medium text-muted-foreground">Почему предлагаете изменения? <span className="text-destructive">*</span></label>
                  <Textarea value={counterMessage} onChange={(e) => setCounterMessage(e.target.value)} placeholder="Например: прошу увеличить бюджет…" rows={2} className="text-[13px]" />
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setShowCounterForm(false)}>Отмена</Button>
                  <Button size="sm" className="h-9 gap-1.5" disabled={!counterMessage.trim() || submittingCounter} onClick={handleCounterOffer}>
                    {submittingCounter ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Отправить встречное
                  </Button>
                </div>
              </section>
            )}
          </div>

          {/* ── Right: Negotiation timeline (2 cols) ── */}
          <div className="lg:col-span-2 space-y-5">
            <h2 className="text-[16px] font-semibold text-foreground">Переговоры</h2>

            {/* Version timeline */}
            {allTermsSorted.length > 0 ? (
              <div className="relative pl-5 space-y-0">
                {allTermsSorted.map((t: any, idx: number) => {
                  const isLatest = idx === allTermsSorted.length - 1;
                  const tFields = t.fields as Record<string, string>;
                  const createdByCreator = t.created_by === deal.creator_id;
                  const vDate = new Date(t.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
                  const prevT = idx > 0 ? allTermsSorted[idx - 1] : null;
                  const prevFields = prevT ? (prevT.fields as Record<string, string>) : null;

                  const changes: string[] = [];
                  if (prevFields) {
                    if (tFields.budget && tFields.budget !== prevFields.budget)
                      changes.push(`Бюджет: ${Number(prevFields.budget || 0).toLocaleString()} → ${Number(tFields.budget).toLocaleString()} ₽`);
                    if (tFields.deadline && tFields.deadline !== prevFields.deadline)
                      changes.push(`Дедлайн: ${prevFields.deadline || "—"} → ${tFields.deadline}`);
                  }

                  return (
                    <div key={t.id} className="relative pb-5 last:pb-0">
                      {idx < allTermsSorted.length - 1 && <div className="absolute left-0 top-3 bottom-0 w-px bg-border" />}
                      <div className={cn("absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full -translate-x-[5px] border-2",
                        isLatest ? "bg-primary border-primary" : t.status === "accepted" ? "bg-green-500 border-green-500" : "bg-muted-foreground/40 border-muted-foreground/40"
                      )} />
                      <div className={cn("ml-4 rounded-lg p-3", isLatest ? "bg-primary/5 border border-primary/20" : "bg-muted/20 border border-border/50")}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn("text-[13px] font-semibold", isLatest ? "text-primary" : "text-foreground")}>v{t.version}</span>
                          <Badge variant="outline" className={cn("text-[10px] h-5",
                            t.status === "accepted" ? "bg-green-500/10 text-green-500 border-green-500/30" :
                            isLatest ? "bg-primary/10 text-primary border-primary/30" :
                            "bg-muted text-muted-foreground border-muted-foreground/20"
                          )}>
                            {t.status === "accepted" ? "Принято" : isLatest ? "Текущая" : "Заменена"}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground">{vDate}</span>
                        </div>
                        <p className="text-[12px] text-muted-foreground mt-0.5">
                          {createdByCreator ? "Вы" : (advProfile?.display_name || deal.advertiser_name)}
                        </p>
                        {/* Compact diff */}
                        {changes.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {changes.map((c, ci) => (
                              <span key={ci} className="text-[11px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">{c}</span>
                            ))}
                          </div>
                        )}
                        {tFields.counterMessage && (
                          <p className="text-[12px] text-foreground/70 mt-1.5 italic border-l-2 border-muted-foreground/30 pl-2">«{tFields.counterMessage}»</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-[13px] text-muted-foreground border border-dashed border-border rounded-lg">
                <Clock className="h-5 w-5 mx-auto mb-2 opacity-40" />
                Версия условий ещё не создана
              </div>
            )}

            {/* Ask a question box */}
            <div className="space-y-2">
              <h3 className="text-[14px] font-medium text-foreground">Задать вопрос</h3>
              <p className="text-[12px] text-muted-foreground">Только через платформу. Контакты недоступны до принятия сделки.</p>
              <div className="flex gap-2">
                <Textarea value={questionText} onChange={(e) => setQuestionText(e.target.value)} placeholder="Уточнить детали размещения…" rows={2} className="text-[13px] flex-1" />
              </div>
              <Button variant="secondary" size="sm" className="h-8 gap-1.5 text-[13px]" disabled={!questionText.trim()}
                onClick={async () => {
                  if (!user || !questionText.trim()) return;
                  // Send as audit log since messaging is locked pre-deal
                  await supabase.from("deal_audit_log").insert({ deal_id: deal.id, user_id: user.id, action: `Вопрос: ${questionText}`, category: "general" });
                  if (deal.advertiser_id) {
                    await supabase.from("notifications").insert({ user_id: deal.advertiser_id, title: "Вопрос по предложению", message: questionText.slice(0, 200), type: "deal", link: "/ad-studio" });
                  }
                  toast.success("Вопрос отправлен рекламодателю");
                  setQuestionText("");
                }}>
                <Send className="h-3 w-3" /> Отправить
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Reject dialog ── */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отклонить предложение?</AlertDialogTitle>
            <AlertDialogDescription>Рекламодатель будет уведомлён. Это действие нельзя отменить.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <label className="text-[13px] font-medium text-foreground">Причина (необязательно)</label>
            <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Укажите причину…" rows={2} className="text-[13px]" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject} disabled={rejecting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {rejecting ? "Отклонение…" : "Отклонить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageTransition>
  );
}
