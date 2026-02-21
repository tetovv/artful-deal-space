import { useState, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDealTerms, useDealFiles, useDownloadDealFile, useDealAuditLog } from "@/hooks/useDealData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, CheckCircle2, MoreVertical, Download, FileText, Shield,
  CalendarDays, Video, FileEdit, Mic, Loader2, Send, ArrowLeftRight,
  XCircle, Paperclip, History, Clock, AlertTriangle, MessageSquare,
  ExternalLink, ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PageTransition } from "@/components/layout/PageTransition";
import { ScrollArea } from "@/components/ui/scroll-area";

/* ─── Status config ─── */
const statusConfig: Record<string, { label: string; cls: string }> = {
  pending: { label: "Новое", cls: "bg-warning/15 text-warning border-warning/30" },
  briefing: { label: "Принято", cls: "bg-green-500/10 text-green-500 border-green-500/30" },
  in_progress: { label: "В работе", cls: "bg-primary/15 text-primary border-primary/30" },
  needs_changes: { label: "Ожидает ответа", cls: "bg-accent/15 text-accent-foreground border-accent/30" },
  completed: { label: "Завершено", cls: "bg-green-500/10 text-green-500 border-green-500/30" },
  disputed: { label: "Отклонено", cls: "bg-muted text-muted-foreground border-muted-foreground/20" },
  rejected: { label: "Отклонено", cls: "bg-muted text-muted-foreground border-muted-foreground/20" },
};

const placementIcons: Record<string, any> = {
  "Видео-интеграция": Video, "Видео": Video, video: Video,
  "Пост": FileEdit, post: FileEdit,
  "Подкаст": Mic, podcast: Mic,
};

type ProposalTab = "overview" | "terms" | "negotiation" | "files" | "audit";

/* ─── Helper: is brief empty ─── */
function isBriefEmpty(v: string | null | undefined): boolean {
  if (!v) return true;
  const trimmed = v.trim();
  return trimmed === "" || trimmed === "0";
}

/* ─── Helper: format budget ─── */
function fmtBudget(v: number | string | null | undefined): string {
  const n = Number(v);
  if (!n || isNaN(n)) return "—";
  return n.toLocaleString("ru-RU") + " ₽";
}

/* ─── Helper: format date ─── */
function fmtDate(v: string | null | undefined): string {
  if (!v) return "";
  try {
    return new Date(v).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return v; }
}

export default function CreatorProposal() {
  const { proposalId } = useParams<{ proposalId: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<ProposalTab>("overview");

  /* ── Data fetching ── */
  const { data: deal, isLoading } = useQuery({
    queryKey: ["proposal-deal", proposalId],
    queryFn: async () => {
      if (!proposalId) return null;
      const { data, error } = await supabase.from("deals").select("*").eq("id", proposalId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!proposalId,
  });

  const { data: advertiserProfile } = useQuery({
    queryKey: ["adv-profile", deal?.advertiser_id],
    queryFn: async () => {
      if (!deal?.advertiser_id) return null;
      const { data } = await supabase.from("profiles").select("display_name, avatar_url").eq("user_id", deal.advertiser_id).single();
      return data;
    },
    enabled: !!deal?.advertiser_id,
  });

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
  const { data: auditLog = [] } = useDealAuditLog(deal?.id || "");
  const downloadFile = useDownloadDealFile();

  // Fetch proposal messages (clarification thread)
  const { data: proposalMessages = [], refetch: refetchMessages } = useQuery({
    queryKey: ["proposal-messages", deal?.id],
    queryFn: async () => {
      if (!deal?.id) return [];
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("deal_id", deal.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!deal?.id,
  });

  /* ── State ── */
  const [accepting, setAccepting] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [showCounterForm, setShowCounterForm] = useState(false);
  const [counterBudget, setCounterBudget] = useState("");
  const [counterDeadline, setCounterDeadline] = useState("");
  const [counterMessage, setCounterMessage] = useState("");
  const [submittingCounter, setSubmittingCounter] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  /* ── Derived ── */
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

  const PlacementIcon = placement ? placementIcons[placement] || placementIcons[placement?.toLowerCase()] || FileText : FileText;
  const st = statusConfig[deal?.status || "pending"] || statusConfig.pending;

  const isPending = deal?.status === "pending";
  const isNeedsChanges = deal?.status === "needs_changes";
  const isAccepted = deal?.status === "briefing" || deal?.status === "in_progress" || deal?.status === "completed";
  const latestCreatedBy = latestTerms ? (latestTerms as any).created_by : null;
  const advertiserCountered = isNeedsChanges && latestCreatedBy === deal?.advertiser_id;
  const creatorCountered = isNeedsChanges && latestCreatedBy === user?.id;
  const canRespond = isPending || advertiserCountered;

  const isAuthorized = deal && deal.creator_id === user?.id;

  const advertiserDisplayName = brand?.brand_name || advertiserProfile?.display_name || deal?.advertiser_name || "Рекламодатель";

  /* ── Brief data ── */
  const rawBrief = deal?.description;
  const hasBrief = !isBriefEmpty(rawBrief);
  const briefCta = termsFields?.cta && !isBriefEmpty(termsFields.cta) ? termsFields.cta : null;
  const briefRestrictions = termsFields?.restrictions && !isBriefEmpty(termsFields.restrictions) ? termsFields.restrictions : null;

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
      toast.success("Сделка создана. Переход в рабочее пространство…");
      qc.invalidateQueries({ queryKey: ["creator-incoming-deals"] });
      qc.invalidateQueries({ queryKey: ["my_deals"] });
      navigate("/marketplace", { state: { openDealId: deal.id }, replace: true });
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
      qc.invalidateQueries({ queryKey: ["deal_terms", deal.id] });
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

  const handleSendChat = async () => {
    if (!user || !deal || !chatInput.trim()) return;
    setSendingChat(true);
    try {
      await supabase.from("messages").insert({
        deal_id: deal.id,
        sender_id: user.id,
        sender_name: profile?.display_name || "Автор",
        content: chatInput.trim(),
      });
      setChatInput("");
      refetchMessages();
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch {
      toast.error("Не удалось отправить сообщение");
    } finally {
      setSendingChat(false);
    }
  };

  /* ── Loading / Error states ── */
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
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Назад к сделкам
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
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Назад
        </Button>
      </div>
    );
  }

  const tabs: { key: ProposalTab; label: string; count?: number }[] = [
    { key: "overview", label: "Обзор" },
    { key: "terms", label: "Условия" },
    { key: "negotiation", label: "Переговоры", count: allTermsSorted.length || undefined },
    { key: "files", label: "Файлы", count: files.length || undefined },
    { key: "audit", label: "Журнал", count: auditLog.length || undefined },
  ];

  return (
    <PageTransition>
      <div className="max-w-[1100px] mx-auto px-4 lg:px-8 py-6 space-y-0">
        {/* ── Back link ── */}
        <button
          onClick={() => navigate("/marketplace")}
          className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Назад к сделкам
        </button>

        {/* ── Banners ── */}
        {advertiserCountered && (
          <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 space-y-2 mb-4">
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

        {creatorCountered && (
          <div className="bg-muted/50 border border-border rounded-lg p-4 flex items-center gap-3 mb-4">
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <span className="text-[14px] font-medium text-foreground">Ожидаем ответа рекламодателя</span>
              <p className="text-[12px] text-muted-foreground">
                Вы отправили встречное предложение (v{(latestTerms as any)?.version || "?"}). Редактирование заблокировано до ответа.
              </p>
            </div>
          </div>
        )}

        {!hasBrief && !isAccepted && (
          <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 flex items-center gap-2 mb-4">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
            <span className="text-[13px] text-foreground">Предложение не содержит подробного брифа. Вы можете задать вопрос или сделать встречное предложение.</span>
          </div>
        )}

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 mb-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border border-border shrink-0">
              {advertiserProfile?.avatar_url
                ? <img src={advertiserProfile.avatar_url} alt="" className="h-full w-full object-cover" />
                : <span className="text-sm font-bold text-primary">{advertiserDisplayName.charAt(0)}</span>}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-[18px] font-bold text-foreground truncate">{advertiserDisplayName}</h1>
                {brand?.business_verified && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                <Badge variant="outline" className={cn("text-[11px] border font-medium shrink-0", st.cls)}>{st.label}</Badge>
              </div>
              {brand?.brand_name && brand.brand_name !== advertiserDisplayName && (
                <p className="text-[13px] text-muted-foreground truncate">{brand.brand_name}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Primary CTA: Accept (when actionable) */}
            {canRespond && (
              <Button size="sm" className="h-9 gap-1.5" disabled={accepting} onClick={handleAccept}>
                {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Принять предложение
              </Button>
            )}

            {/* Secondary CTA: Counter-offer */}
            {canRespond && !showCounterForm && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5"
                onClick={() => { setShowCounterForm(true); setActiveTab("negotiation"); }}
              >
                <ArrowLeftRight className="h-4 w-4" />
                Встречное
              </Button>
            )}

            {/* If accepted — show "Open deal" */}
            {isAccepted && (
              <Button size="sm" className="h-9 gap-1.5" onClick={() => navigate("/marketplace", { state: { openDealId: deal.id } })}>
                <ExternalLink className="h-4 w-4" />
                Открыть сделку
              </Button>
            )}

            {/* Waiting badge */}
            {creatorCountered && (
              <Badge variant="outline" className="text-[12px] border-muted-foreground/20 text-muted-foreground">
                <Clock className="h-3 w-3 mr-1" /> Ожидание рекламодателя
              </Badge>
            )}

            {/* Kebab */}
            {canRespond && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setShowRejectDialog(true)}
                  >
                    <XCircle className="h-4 w-4 mr-2" /> Отклонить
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Key meta line */}
        <div className="flex items-center gap-4 text-[14px] flex-wrap mb-5">
          {placement && (
            <span className="flex items-center gap-1.5 text-foreground font-medium">
              <PlacementIcon className="h-4 w-4 text-primary" /> {placement}
            </span>
          )}
          {deal.budget ? <span className="font-bold text-foreground text-lg">{fmtBudget(deal.budget)}</span> : null}
          {deal.deadline && (
            <span className="text-foreground/70 flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" /> до {fmtDate(deal.deadline)}
            </span>
          )}
          {files.length > 0 && (
            <span className="text-foreground/70 flex items-center gap-1">
              <Paperclip className="h-3.5 w-3.5" /> {files.length} файлов
            </span>
          )}
        </div>

        {/* ── Tabs ── */}
        <div className="border-b border-border mb-6">
          <div className="flex items-center gap-0">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "px-4 py-2.5 text-[14px] font-medium border-b-2 transition-colors",
                  activeTab === tab.key
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
                {tab.count != null && tab.count > 0 && (
                  <span className="ml-1.5 text-[11px] bg-muted px-1.5 py-0.5 rounded-full">{tab.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ═══ OVERVIEW TAB ═══ */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            <div className="lg:col-span-3 space-y-6">
              {/* Brief */}
              <div className="space-y-3">
                <h2 className="text-[15px] font-semibold text-foreground">Бриф</h2>
                {hasBrief ? (
                  <div className="space-y-3">
                    <p className="text-[14px] text-foreground/90 leading-relaxed whitespace-pre-wrap">{rawBrief}</p>
                    {briefCta && (
                      <div className="rounded-lg bg-primary/5 border border-primary/15 px-3 py-2">
                        <span className="text-[12px] font-medium text-muted-foreground block mb-0.5">Призыв к действию (CTA)</span>
                        <span className="text-[13px] text-foreground">{briefCta}</span>
                      </div>
                    )}
                    {briefRestrictions && (
                      <div className="rounded-lg bg-destructive/5 border border-destructive/15 px-3 py-2">
                        <span className="text-[12px] font-medium text-muted-foreground block mb-0.5">Ограничения</span>
                        <span className="text-[13px] text-foreground">{briefRestrictions}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[13px] text-muted-foreground italic">Бриф не предоставлен</p>
                )}
              </div>

              {/* Attachments preview (top 2) */}
              {files.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h2 className="text-[15px] font-semibold text-foreground">Вложения ({files.length})</h2>
                      {files.length > 2 && (
                        <button onClick={() => setActiveTab("files")} className="text-[12px] text-primary hover:underline">Все файлы →</button>
                      )}
                    </div>
                    <div className="space-y-1">
                      {files.slice(0, 2).map((f) => (
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
                  </div>
                </>
              )}
            </div>

            {/* RIGHT: Quick terms summary */}
            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-[15px] font-semibold text-foreground">Основные условия</h2>
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                {placement && (
                  <div className="flex justify-between text-[13px]">
                    <span className="text-muted-foreground">Тип размещения</span>
                    <span className="font-medium text-foreground">{placement}</span>
                  </div>
                )}
                {deal.budget ? (
                  <div className="flex justify-between text-[13px]">
                    <span className="text-muted-foreground">Бюджет</span>
                    <span className="font-bold text-foreground">{fmtBudget(deal.budget)}</span>
                  </div>
                ) : null}
                {deal.deadline && (
                  <div className="flex justify-between text-[13px]">
                    <span className="text-muted-foreground">Дедлайн</span>
                    <span className="font-medium text-foreground">{fmtDate(deal.deadline)}</span>
                  </div>
                )}
                {allTermsSorted.length > 0 && (
                  <div className="flex justify-between text-[13px]">
                    <span className="text-muted-foreground">Версий переговоров</span>
                    <span className="font-medium text-foreground">{allTermsSorted.length}</span>
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5 text-[13px]"
                onClick={() => setActiveTab("terms")}
              >
                Смотреть полные условия →
              </Button>
            </div>
          </div>
        )}

        {/* ═══ TERMS TAB ═══ */}
        {activeTab === "terms" && (
          <div className="max-w-[800px] space-y-6">
            {/* Placement */}
            <Section title="Размещение">
              <TermsGrid>
                {placement && <TermsRow label="Тип" value={<span className="flex items-center gap-1.5"><PlacementIcon className="h-3.5 w-3.5 text-primary" />{placement}</span>} />}
                {termsFields?.deliverables && <TermsRow label="Результат" value={termsFields.deliverables} />}
                {deal.deadline && <TermsRow label="Окно публикации" value={fmtDate(deal.deadline)} />}
                {termsFields?.publishStart && <TermsRow label="Начало публикации" value={fmtDate(termsFields.publishStart)} />}
                {termsFields?.publishEnd && <TermsRow label="Конец публикации" value={fmtDate(termsFields.publishEnd)} />}
              </TermsGrid>
            </Section>

            <Separator />

            {/* Budget */}
            <Section title="Бюджет">
              <TermsGrid>
                {deal.budget ? <TermsRow label="Сумма" value={<span className="font-bold">{fmtBudget(deal.budget)}</span>} /> : null}
                {termsFields?.budgetMin && <TermsRow label="Мин. бюджет" value={fmtBudget(termsFields.budgetMin)} />}
                {termsFields?.budgetMax && <TermsRow label="Макс. бюджет" value={fmtBudget(termsFields.budgetMax)} />}
                {termsFields?.paymentMilestones && <TermsRow label="Этапы оплаты" value={termsFields.paymentMilestones} />}
              </TermsGrid>
            </Section>

            {/* Revisions — only if present */}
            {termsFields?.revisions && !isBriefEmpty(termsFields.revisions) && (
              <>
                <Separator />
                <Section title="Правки">
                  <TermsGrid>
                    <TermsRow label="Количество правок" value={termsFields.revisions} />
                  </TermsGrid>
                </Section>
              </>
            )}

            {/* Acceptance criteria — only if present */}
            {termsFields?.acceptanceCriteria && !isBriefEmpty(termsFields.acceptanceCriteria) && (
              <>
                <Separator />
                <Section title="Приёмка">
                  <TermsGrid>
                    <TermsRow label="Критерии приёмки" value={termsFields.acceptanceCriteria} />
                    {termsFields?.reviewWindow && <TermsRow label="Окно проверки" value={termsFields.reviewWindow} />}
                  </TermsGrid>
                </Section>
              </>
            )}

            <Separator />

            {/* Marking (ORD) */}
            <div className="flex items-center gap-2">
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

            {/* Brief files summary */}
            {files.length > 0 && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-muted-foreground">Вложения к брифу: {files.length}</span>
                  <button onClick={() => setActiveTab("files")} className="text-[12px] text-primary hover:underline">Открыть →</button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══ NEGOTIATION TAB ═══ */}
        {activeTab === "negotiation" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT: Version timeline */}
            <div className="space-y-4">
              <h2 className="text-[15px] font-semibold text-foreground flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                Версии ({allTermsSorted.length})
              </h2>

              {allTermsSorted.length > 0 ? (
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
                        changes.push(`Бюджет: ${fmtBudget(prevFields.budget)} → ${fmtBudget(tFields.budget)}`);
                      if (tFields.deadline && tFields.deadline !== prevFields.deadline)
                        changes.push(`Дедлайн: ${fmtDate(prevFields.deadline) || "—"} → ${fmtDate(tFields.deadline)}`);
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
                        <div className={cn("ml-4 rounded-lg p-3", isLatest ? "bg-primary/5 border border-primary/20" : "bg-muted/20 border border-border")}>
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
                            <span className="text-[11px] text-muted-foreground">· {createdByCreator ? "Вы" : advertiserDisplayName}</span>
                          </div>
                          {changes.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {changes.map((c, ci) => (
                                <span key={ci} className="text-[12px] text-foreground bg-muted/50 px-2 py-1 rounded font-medium">{c}</span>
                              ))}
                            </div>
                          )}
                          {tFields.counterMessage && (
                            <p className="text-[13px] text-foreground/70 mt-2 italic border-l-2 border-muted-foreground/20 pl-3">«{tFields.counterMessage}»</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-[14px]">Пока нет версий условий</p>
                </div>
              )}

              {/* Counter-offer form */}
              {showCounterForm && canRespond && (
                <div className="space-y-3 bg-muted/20 rounded-xl p-4 border border-border">
                  <h3 className="text-[14px] font-semibold text-foreground flex items-center gap-2">
                    <ArrowLeftRight className="h-4 w-4 text-primary" /> Встречное предложение
                  </h3>
                  <div className="rounded-lg bg-background border border-border px-3 py-2 space-y-1">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Текущие условия</p>
                    <div className="flex items-center gap-4 text-[13px] flex-wrap">
                      {deal.budget ? <span className="text-foreground/80">Бюджет: <span className="font-semibold text-foreground">{fmtBudget(deal.budget)}</span></span> : null}
                      {deal.deadline && <span className="text-foreground/80">Дедлайн: <span className="font-semibold text-foreground">{fmtDate(deal.deadline)}</span></span>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[12px] font-medium text-muted-foreground">Новая цена (₽) <span className="text-destructive">*</span></label>
                      <Input
                        type="number"
                        value={counterBudget}
                        onChange={(e) => setCounterBudget(e.target.value)}
                        placeholder={deal.budget ? deal.budget.toLocaleString() : "0"}
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
                    <label className="text-[12px] font-medium text-muted-foreground">Комментарий <span className="text-destructive">*</span></label>
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
            </div>

            {/* RIGHT: Discussion thread */}
            <div className="space-y-3">
              <h2 className="text-[15px] font-semibold text-foreground flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                Обсуждение
              </h2>

              <div className="rounded-xl border border-border bg-card flex flex-col" style={{ minHeight: 320, maxHeight: 500 }}>
                <ScrollArea className="flex-1 p-3">
                  {proposalMessages.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="h-6 w-6 mx-auto mb-2 opacity-30" />
                      <p className="text-[13px]">Нет сообщений</p>
                      <p className="text-[11px] text-muted-foreground mt-1">Задайте вопрос рекламодателю перед принятием решения</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {proposalMessages.map((msg) => {
                        const isMe = msg.sender_id === user?.id;
                        return (
                          <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                            <div className={cn(
                              "rounded-lg px-3 py-2 max-w-[85%]",
                              isMe ? "bg-primary/10 text-foreground" : "bg-muted/50 text-foreground"
                            )}>
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[11px] font-medium text-muted-foreground">{msg.sender_name}</span>
                                <span className="text-[10px] text-muted-foreground/60">
                                  {new Date(msg.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                              <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={chatEndRef} />
                    </div>
                  )}
                </ScrollArea>

                {/* Chat input */}
                <div className="border-t border-border p-2 flex items-center gap-2">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Задать вопрос…"
                    className="h-8 text-[13px] flex-1"
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendChat()}
                  />
                  <Button
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    disabled={!chatInput.trim() || sendingChat}
                    onClick={handleSendChat}
                  >
                    {sendingChat ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ FILES TAB ═══ */}
        {activeTab === "files" && (
          <div className="max-w-[800px] space-y-4">
            <h2 className="text-[15px] font-semibold text-foreground">Файлы ({files.length})</h2>
            {files.length > 0 ? (
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Файл</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Размер</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Дата</th>
                      <th className="text-right px-4 py-2.5 font-medium text-muted-foreground" />
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((f) => (
                      <tr key={f.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="font-medium text-foreground truncate max-w-[240px]">{f.file_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{((f.file_size || 0) / 1024).toFixed(0)} KB</td>
                        <td className="px-4 py-3 text-muted-foreground">{new Date(f.created_at).toLocaleDateString("ru-RU")}</td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => downloadFile.mutate(f.storage_path)}>
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Paperclip className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-[14px]">Нет прикреплённых файлов</p>
                <p className="text-[12px] text-muted-foreground mt-1">Файлы брифа и материалы переговоров будут отображаться здесь</p>
              </div>
            )}
          </div>
        )}

        {/* ═══ AUDIT TAB ═══ */}
        {activeTab === "audit" && (
          <div className="max-w-[800px] space-y-4">
            <h2 className="text-[15px] font-semibold text-foreground flex items-center gap-2">
              <ScrollText className="h-4 w-4 text-muted-foreground" />
              Журнал событий ({auditLog.length})
            </h2>
            {auditLog.length > 0 ? (
              <div className="space-y-0">
                {auditLog.map((entry: any, idx: number) => (
                  <div key={entry.id} className={cn(
                    "flex items-start gap-3 px-4 py-3 border-b border-border last:border-0",
                    idx % 2 === 0 ? "bg-muted/10" : ""
                  )}>
                    <div className="h-2 w-2 rounded-full bg-muted-foreground/40 mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-foreground">{entry.action}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(entry.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {entry.category && entry.category !== "general" && (
                          <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">{entry.category}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <ScrollText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-[14px]">Нет записей в журнале</p>
                <p className="text-[12px] text-muted-foreground mt-1">События (создание, изменения, принятие) будут отображаться здесь</p>
              </div>
            )}
          </div>
        )}
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

/* ─── Helper components ─── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
      {children}
    </div>
  );
}

function TermsGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">{children}</div>;
}

function TermsRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className="text-[14px] font-medium text-foreground">{value}</span>
    </div>
  );
}
