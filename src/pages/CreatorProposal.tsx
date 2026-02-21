import { useState, useMemo, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDealTerms, useDealFiles, useDownloadDealFile, useUploadDealFile, useDealAuditLog, useDealEscrow, useLogDealEvent } from "@/hooks/useDealData";
import { useDealInvoices, useCreateInvoice, useRealtimeInvoices } from "@/hooks/useDealInvoices";
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, CheckCircle2, MoreVertical, Download, FileText, Shield,
  CalendarDays, Video, FileEdit, Mic, Loader2, Send, ArrowLeftRight,
  XCircle, Paperclip, History, Clock, AlertTriangle, MessageSquare,
  ExternalLink, ScrollText, Archive, Lightbulb, ChevronRight, Printer, Eye,
  ChevronDown, Upload, Pin, MessageCircle, Files, CreditCard,
  HelpCircle, FileQuestion, Palette, PlayCircle, ClipboardCopy, ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PageTransition } from "@/components/layout/PageTransition";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePickerField } from "@/components/ui/date-picker-field";

/* ─── Status config ─── */
const statusConfig: Record<string, { label: string; cls: string }> = {
  pending: { label: "Новое", cls: "bg-warning/15 text-warning border-warning/30" },
  briefing: { label: "Принято", cls: "bg-green-500/10 text-green-500 border-green-500/30" },
  invoice_needed: { label: "Ожидает счёта", cls: "bg-warning/15 text-warning border-warning/30" },
  waiting_payment: { label: "Ожидает оплаты", cls: "bg-warning/15 text-warning border-warning/30" },
  in_progress: { label: "В работе", cls: "bg-primary/15 text-primary border-primary/30" },
  review: { label: "На проверке", cls: "bg-accent/15 text-accent-foreground border-accent/30" },
  needs_changes: { label: "Ожидает ответа", cls: "bg-accent/15 text-accent-foreground border-accent/30" },
  completed: { label: "Завершено", cls: "bg-green-500/10 text-green-500 border-green-500/30" },
  disputed: { label: "Отклонено", cls: "bg-muted text-muted-foreground border-muted-foreground/20" },
  rejected: { label: "Отклонено", cls: "bg-muted text-muted-foreground border-muted-foreground/20" },
  archived: { label: "В архиве", cls: "bg-muted text-muted-foreground border-muted-foreground/20" },
  waiting_inputs: { label: "Ожидание данных", cls: "bg-warning/15 text-warning border-warning/30" },
};

const placementIcons: Record<string, any> = {
  "Видео-интеграция": Video, "Видео": Video, video: Video,
  "Пост": FileEdit, post: FileEdit,
  "Подкаст": Mic, podcast: Mic,
};

const fileTypeLabels: Record<string, string> = {
  brief: "Бриф", draft: "Черновик", final: "Финальный", legal: "Юридический",
};

const paymentStatusLabels: Record<string, string> = {
  reserved: "Резерв", in_progress: "В работе", review: "На проверке", released: "Выплачено",
};
const paymentStatusColors: Record<string, string> = {
  reserved: "bg-warning/15 text-warning", in_progress: "bg-primary/15 text-primary",
  review: "bg-accent/15 text-accent-foreground", released: "bg-green-500/10 text-green-500",
};

type WorkspaceTab = "chat" | "terms" | "files" | "payments" | "more";

/* ─── Helpers ─── */
function isBriefEmpty(v: string | null | undefined): boolean {
  if (!v) return true;
  const trimmed = v.trim();
  return trimmed === "" || trimmed === "0";
}

function fmtBudget(v: number | string | null | undefined): string {
  const n = Number(v);
  if (!n || isNaN(n)) return "—";
  return n.toLocaleString("ru-RU") + " ₽";
}

function fmtDate(v: string | null | undefined): string {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return v; }
}

function fmtDateTime(v: string): string {
  try {
    return new Date(v).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch { return v; }
}

export default function CreatorProposal() {
  const { proposalId } = useParams<{ proposalId: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const logEvent = useLogDealEvent();

  const [activeTab, setActiveTab] = useState<WorkspaceTab>("terms");
  const [tabInitialized, setTabInitialized] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [briefExpanded, setBriefExpanded] = useState(false);

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
  const { data: escrowItems = [] } = useDealEscrow(deal?.id || "");
  const { data: invoices = [] } = useDealInvoices(deal?.id || "");
  const createInvoice = useCreateInvoice();
  const downloadFile = useDownloadDealFile();

  useRealtimeMessages(deal?.id || "");
  useRealtimeInvoices(deal?.id || "");

  const { data: chatMessages = [], refetch: refetchMessages } = useQuery({
    queryKey: ["deal-chat", deal?.id],
    queryFn: async () => {
      if (!deal?.id) return [];
      const { data, error } = await supabase
        .from("messages").select("*").eq("deal_id", deal.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!deal?.id,
  });

  /* ── State: modals ── */
  const [accepting, setAccepting] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [counterOfferOpen, setCounterOfferOpen] = useState(false);
  const [showFileRequestModal, setShowFileRequestModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceComment, setInvoiceComment] = useState("");
  const [invoiceDueDate, setInvoiceDueDate] = useState<Date | undefined>(undefined);

  /* Chat state */
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

  const st = statusConfig[deal?.status || "pending"] || statusConfig.pending;

  const isPending = deal?.status === "pending";
  const isNeedsChanges = deal?.status === "needs_changes";
  const isInvoiceNeeded = deal?.status === "invoice_needed";
  const isWaitingPayment = deal?.status === "waiting_payment";
  const isAccepted = deal?.status === "briefing" || deal?.status === "in_progress" || deal?.status === "completed" || deal?.status === "review" || isInvoiceNeeded || isWaitingPayment;
  const isRejected = deal?.status === "rejected" || deal?.status === "disputed";
  const isPaid = escrowItems.some((e: any) => e.status === "reserved" || e.status === "released");
  const latestCreatedBy = latestTerms ? (latestTerms as any).created_by : null;
  const advertiserCountered = isNeedsChanges && latestCreatedBy === deal?.advertiser_id;
  const creatorCountered = isNeedsChanges && latestCreatedBy === user?.id;
  const canRespond = isPending || advertiserCountered;

  const isAuthorized = deal && deal.creator_id === user?.id;
  const advertiserDisplayName = brand?.brand_name || advertiserProfile?.display_name || deal?.advertiser_name || "Рекламодатель";

  // Deal-phase flags
  const isInProgress = deal?.status === "in_progress";
  const isWaitingInputs = deal?.status === "briefing" || deal?.status === "waiting_inputs";

  /* ── Smart default tab ── */
  useEffect(() => {
    if (tabInitialized || !deal) return;
    if (isAccepted) {
      setActiveTab("chat");
    } else if (chatMessages.length > 0) {
      setActiveTab("chat");
    } else {
      setActiveTab("terms");
    }
    setTabInitialized(true);
  }, [deal, chatMessages, isAccepted, tabInitialized]);

  const handleAccept = async () => {
    if (!user || !deal) return;
    setAccepting(true);
    try {
      await supabase.from("deals").update({ status: "invoice_needed" }).eq("id", deal.id);
      if (latestTerms) {
        await supabase.from("deal_terms_acceptance").insert({ terms_id: (latestTerms as any).id, user_id: user.id });
        await supabase.from("deal_terms").update({ status: "accepted" }).eq("id", (latestTerms as any).id);
      }
      const creatorName = profile?.display_name || "Автор";
      await supabase.from("messages").insert({ deal_id: deal.id, sender_id: user.id, sender_name: creatorName, content: "Предложение принято. Ожидайте счёт на оплату." });
      await supabase.from("deal_audit_log").insert({ deal_id: deal.id, user_id: user.id, action: "Автор принял предложение. Ожидание выставления счёта.", category: "terms" });
      if (deal.advertiser_id) {
        await supabase.from("notifications").insert({ user_id: deal.advertiser_id, title: "Предложение принято", message: `${creatorName} принял(а) ваше предложение «${deal.title}». Ожидайте счёт.`, type: "deal", link: "/ad-studio" });
      }
      toast.success("Предложение принято!");
      qc.invalidateQueries({ queryKey: ["creator-incoming-deals"] });
      qc.invalidateQueries({ queryKey: ["my_deals"] });
      qc.invalidateQueries({ queryKey: ["proposal-deal", proposalId] });
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

  const handleArchive = async () => {
    if (!user || !deal) return;
    try {
      await supabase.from("deals").update({ status: "rejected" }).eq("id", deal.id);
      await supabase.from("deal_audit_log").insert({ deal_id: deal.id, user_id: user.id, action: "Предложение архивировано автором", category: "general" });
      toast.success("Предложение архивировано");
      qc.invalidateQueries({ queryKey: ["creator-incoming-deals"] });
      navigate("/marketplace");
    } catch {
      toast.error("Ошибка");
    }
  };

  /* handleCounterOffer moved into TermsTabContent */

  const handleSendChat = async () => {
    if (!user || !deal || !chatInput.trim()) return;
    setSendingChat(true);
    try {
      await supabase.from("messages").insert({
        deal_id: deal.id, sender_id: user.id,
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

  /* Deal-phase actions */
  const handleStartWork = async () => {
    if (!user || !deal) return;
    await supabase.from("deals").update({ status: "in_progress" }).eq("id", deal.id);
    logEvent.mutate({ dealId: deal.id, action: "Автор начал работу", category: "general" });
    toast.success("Статус обновлён: В работе");
    qc.invalidateQueries({ queryKey: ["proposal-deal", proposalId] });
  };

  const handleSubmitDraft = async () => {
    if (!user || !deal) return;
    await supabase.from("deals").update({ status: "review" }).eq("id", deal.id);
    logEvent.mutate({ dealId: deal.id, action: "Автор отправил черновик на проверку", category: "files" });
    if (deal.advertiser_id) {
      await supabase.from("notifications").insert({ user_id: deal.advertiser_id, title: "Черновик отправлен", message: `Автор отправил черновик для проверки «${deal.title}»`, type: "deal", link: "/ad-studio" });
    }
    toast.success("Черновик отправлен на проверку");
    qc.invalidateQueries({ queryKey: ["proposal-deal", proposalId] });
  };

  /* Request details actions */
  const handleRequestClarification = async () => {
    if (!user || !deal) return;
    const msg = "Здравствуйте! Прежде чем начать работу, хотелось бы уточнить несколько деталей по размещению. Можете ли вы предоставить дополнительную информацию?";
    await supabase.from("messages").insert({ deal_id: deal.id, sender_id: user.id, sender_name: profile?.display_name || "Автор", content: msg });
    logEvent.mutate({ dealId: deal.id, action: "Автор запросил уточнение деталей", category: "general" });
    if (deal.advertiser_id) {
      await supabase.from("notifications").insert({ user_id: deal.advertiser_id, title: "Запрос уточнений", message: `Автор запрашивает уточнения по сделке «${deal.title}»`, type: "deal", link: "/ad-studio" });
    }
    toast.success("Запрос отправлен");
    qc.invalidateQueries({ queryKey: ["deal-chat", deal.id] });
    setActiveTab("chat");
  };

  const handleRequestBrandGuidelines = async () => {
    if (!user || !deal) return;
    const msg = "Здравствуйте! Для качественной интеграции мне понадобятся брендовые гайдлайны (логотип, цвета, тон коммуникации). Можете ли вы их прислать?";
    await supabase.from("messages").insert({ deal_id: deal.id, sender_id: user.id, sender_name: profile?.display_name || "Автор", content: msg });
    logEvent.mutate({ dealId: deal.id, action: "Автор запросил брендовые гайдлайны", category: "general" });
    if (deal.advertiser_id) {
      await supabase.from("notifications").insert({ user_id: deal.advertiser_id, title: "Запрос гайдлайнов", message: `Автор запрашивает брендовые гайдлайны для «${deal.title}»`, type: "deal", link: "/ad-studio" });
    }
    toast.success("Запрос отправлен");
    qc.invalidateQueries({ queryKey: ["deal-chat", deal.id] });
    setActiveTab("chat");
  };

  /* ── Diff helper ── */
  function getDiffFields(cur: Record<string, string> | null, prev: Record<string, string> | null): { key: string; label: string; from: string; to: string }[] {
    if (!cur || !prev) return [];
    const diffs: { key: string; label: string; from: string; to: string }[] = [];
    const labels: Record<string, string> = { budget: "Бюджет", deadline: "Дедлайн", revisions: "Правки", acceptanceCriteria: "Критерии приёмки" };
    for (const key of Object.keys(labels)) {
      const curVal = cur[key] || "";
      const prevVal = prev[key] || "";
      if (curVal !== prevVal) {
        const fmt = key === "budget" ? fmtBudget : key === "deadline" ? fmtDate : (v: string) => v || "—";
        diffs.push({ key, label: labels[key], from: fmt(prevVal) || "—", to: fmt(curVal) || "—" });
      }
    }
    return diffs;
  }

  /* ── Loading / Error states ── */
  if (isLoading) {
    return (
      <PageTransition>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PageTransition>
    );
  }

  if (!deal) {
    return (
      <PageTransition>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <AlertTriangle className="h-8 w-8 text-warning" />
          <p className="text-[15px] text-muted-foreground">Предложение не найдено</p>
          <Button variant="outline" size="sm" onClick={() => navigate("/marketplace")}>
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Назад к предложениям
          </Button>
        </div>
      </PageTransition>
    );
  }

  if (!isAuthorized) {
    return (
      <PageTransition>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <Shield className="h-8 w-8 text-destructive" />
          <p className="text-[15px] text-foreground font-medium">Доступ запрещён</p>
          <Button variant="outline" size="sm" onClick={() => navigate("/marketplace")}>
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Назад
          </Button>
        </div>
      </PageTransition>
    );
  }

  const tabs: { value: WorkspaceTab; label: string; icon: any; disabled?: boolean }[] = [
    { value: "chat", label: "Чат", icon: MessageCircle },
    { value: "terms", label: "Условия", icon: ScrollText },
    { value: "files", label: "Файлы", icon: Files },
    { value: "payments", label: "Оплата", icon: CreditCard, disabled: !isAccepted },
    { value: "more", label: "Ещё", icon: MoreVertical },
  ];

  /* Next step hint text */
  const nextStepHint = (() => {
    if (isRejected) return null;
    if (canRespond && advertiserCountered) return "Рекламодатель предложил новые условия — ответьте через «Принять решение»";
    if (canRespond) return "Рассмотрите условия и примите решение";
    if (creatorCountered) return "Ожидание ответа рекламодателя на ваше встречное предложение";
    if (isInvoiceNeeded) return "Выставите счёт рекламодателю для начала работы";
    if (isWaitingPayment) return "Ожидание оплаты рекламодателем";
    if (isInProgress) return "Загрузите черновик и отправьте на проверку";
    if (deal.status === "review") return "Черновик на проверке у рекламодателя";
    return null;
  })();

  /* Brief data */
  const rawBrief = deal.description;
  const hasBrief = !isBriefEmpty(rawBrief);
  const briefCta = termsFields?.cta && !isBriefEmpty(termsFields.cta) ? termsFields.cta : null;
  const briefRestrictions = termsFields?.restrictions && !isBriefEmpty(termsFields.restrictions) ? termsFields.restrictions : null;

  return (
    <PageTransition>
      <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
        {/* ════════ HEADER ════════ */}
        <div className="border-b border-border bg-card">
          <div className="max-w-[1100px] mx-auto px-6 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate("/marketplace")}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <h1 className="text-[18px] font-bold text-foreground truncate safe-text">{advertiserDisplayName}</h1>
                {brand?.business_verified && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                <Badge variant="outline" className={cn("text-[11px] font-medium shrink-0 border", st.cls)}>{st.label}</Badge>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {/* PRIMARY CTA — state-driven */}
                {/* Pre-accept: decision dropdown */}
                {canRespond && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" className="text-[14px] h-9 gap-1.5">
                        <CheckCircle2 className="h-4 w-4" /> Принять решение
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[220px]">
                      <DropdownMenuItem disabled={accepting} onClick={handleAccept} className="gap-2 font-medium">
                        {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 text-green-500" />}
                        Принять предложение
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setActiveTab("terms"); setCounterOfferOpen(true); }} className="gap-2">
                        <ArrowLeftRight className="h-4 w-4" /> Встречное предложение
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive" onClick={() => setShowRejectDialog(true)}>
                        <XCircle className="h-4 w-4" /> Отклонить
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {/* Post-accept: Send invoice */}
                {isInvoiceNeeded && (
                  <Button size="sm" className="text-[14px] h-9" onClick={() => {
                    setInvoiceAmount(String(deal.budget || ""));
                    setShowInvoiceModal(true);
                  }}>
                    <FileText className="h-4 w-4 mr-1.5" /> Отправить счёт
                  </Button>
                )}

                {/* Waiting payment badge */}
                {isWaitingPayment && (
                  <Badge variant="outline" className="text-[13px] py-1 px-2.5 border-warning/30 text-warning">
                    <Clock className="h-3.5 w-3.5 mr-1" /> Ожидание оплаты
                  </Badge>
                )}

                {/* In progress: Submit draft */}
                {isInProgress && (
                  <Button size="sm" className="text-[14px] h-9" onClick={handleSubmitDraft}>
                    <Upload className="h-4 w-4 mr-1.5" /> Отправить черновик
                  </Button>
                )}

                {/* Review badge */}
                {deal.status === "review" && (
                  <Badge variant="outline" className="text-[13px] py-1 px-2.5 border-warning/30 text-warning">
                    <Clock className="h-3.5 w-3.5 mr-1" /> На проверке
                  </Badge>
                )}

                {/* Waiting badge */}
                {creatorCountered && (
                  <Badge variant="outline" className="text-[12px] border-muted-foreground/20 text-muted-foreground">
                    <Clock className="h-3 w-3 mr-1" /> Ожидание рекламодателя
                  </Badge>
                )}

                {/* SECONDARY CTA: Request dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="text-[13px] h-9">
                      <HelpCircle className="h-4 w-4 mr-1.5" /> Запросить
                      <ChevronDown className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={handleRequestClarification} className="text-[14px]">
                      <MessageCircle className="h-4 w-4 mr-2" /> Уточнить детали
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowFileRequestModal(true)} className="text-[14px]">
                      <FileQuestion className="h-4 w-4 mr-2" /> Запросить файлы
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleRequestBrandGuidelines} className="text-[14px]">
                      <Palette className="h-4 w-4 mr-2" /> Запросить гайдлайны
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Kebab */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleArchive} className="text-[14px]">
                      <Archive className="h-4 w-4 mr-2" /> Архивировать
                    </DropdownMenuItem>
                    {isAccepted && (
                      <>
                        <DropdownMenuItem className="text-[14px]"><Download className="h-4 w-4 mr-2" /> Экспорт</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive text-[14px]">
                          <AlertTriangle className="h-4 w-4 mr-2" /> Открыть спор
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Persistent key details summary */}
            <div className="flex items-center gap-1.5 mt-1 text-[13px] text-muted-foreground flex-wrap">
              {placement && <><span className="text-muted-foreground/70">Тип:</span> <span className="text-foreground/80">{placement}</span> <span className="text-border">•</span></>}
              <span className="text-muted-foreground/70">Бюджет:</span> <span className="text-foreground/80 font-medium">{fmtBudget(deal.budget)}</span>
              <span className="text-border">•</span>
              <span className="text-muted-foreground/70">Дедлайн:</span> <span className="text-foreground/80">{deal.deadline ? fmtDate(deal.deadline) : "—"}</span>
              <span className="text-border">•</span>
              <Badge variant="outline" className={cn("text-[10px] h-5 font-medium border", st.cls)}>{st.label}</Badge>
              <span className="text-border">•</span>
              <button onClick={() => setDetailsOpen(true)} className="text-primary hover:underline text-[13px] font-medium">
                Смотреть детали
              </button>
            </div>
          </div>
        </div>

        {/* ════════ TABS ════════ */}
        <div className="border-b border-border bg-card">
          <div className="max-w-[1100px] mx-auto px-6">
            <div className="flex items-center gap-0">
              {tabs.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => !tab.disabled && setActiveTab(tab.value)}
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 h-10 text-[15px] font-medium border-b-2 transition-colors",
                    tab.disabled
                      ? "border-transparent text-muted-foreground/40 cursor-not-allowed"
                      : activeTab === tab.value
                        ? "border-primary text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                  disabled={tab.disabled}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Next step hint */}
            {nextStepHint && (
              <div className="pb-2 -mt-0.5">
                <p className="text-[13px] text-muted-foreground">
                  <span className="text-primary font-medium">→</span> {nextStepHint}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ════════ TAB CONTENT ════════ */}
        <div className="flex-1 overflow-y-auto">
          {/* ═══ CHAT TAB ═══ */}
          {activeTab === "chat" && (
            <ChatTabContent
              dealId={deal.id}
              messages={chatMessages}
              userId={user?.id}
              chatInput={chatInput}
              setChatInput={setChatInput}
              sendingChat={sendingChat}
              onSend={handleSendChat}
              chatEndRef={chatEndRef}
              /* Brief card shown at top of chat for proposals */
              briefCard={hasBrief ? (
                <div className="max-w-[820px] mx-auto px-4 pt-4">
                  <div className="rounded-xl border border-border bg-card p-4 space-y-3 mb-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[14px] font-semibold text-foreground flex items-center gap-1.5">
                        <FileText className="h-4 w-4 text-primary" /> Бриф
                      </h3>
                      <button
                        onClick={() => { navigator.clipboard.writeText(rawBrief || ""); toast.success("Бриф скопирован"); }}
                        className="text-[12px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                      >
                        <ClipboardCopy className="h-3.5 w-3.5" /> Скопировать
                      </button>
                    </div>
                    <div className="relative">
                      <p className={cn("safe-text text-[14px] text-foreground/90 leading-relaxed", !briefExpanded && "line-clamp-6")}>{rawBrief}</p>
                      {(rawBrief?.length || 0) > 300 && (
                        <button onClick={() => setBriefExpanded(!briefExpanded)} className="text-[13px] text-primary hover:underline mt-1">
                          {briefExpanded ? "Свернуть" : "Показать полностью"}
                        </button>
                      )}
                    </div>
                    {briefCta && (
                      <div className="rounded-lg bg-primary/5 border border-primary/15 px-3 py-2">
                        <span className="text-[12px] font-medium text-muted-foreground block mb-0.5">CTA</span>
                        <span className="text-[13px] text-foreground safe-text">{briefCta}</span>
                      </div>
                    )}
                    {briefRestrictions && (
                      <div className="rounded-lg bg-destructive/5 border border-destructive/15 px-3 py-2">
                        <span className="text-[12px] font-medium text-muted-foreground block mb-0.5">Ограничения</span>
                        <span className="text-[13px] text-foreground safe-text">{briefRestrictions}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            />
          )}

          {/* ═══ TERMS TAB ═══ */}
          {activeTab === "terms" && (
            <TermsTabContent
              deal={deal}
              latestTerms={latestTerms}
              allTermsSorted={allTermsSorted}
              termsFields={termsFields}
              placement={placement}
              canRespond={canRespond}
              isAccepted={isAccepted}
              counterOfferOpen={counterOfferOpen}
              setCounterOfferOpen={setCounterOfferOpen}
              proposalId={proposalId}
            />
          )}

          {/* ═══ FILES TAB ═══ */}
          {activeTab === "files" && (
            <FilesTabContent dealId={deal.id} />
          )}

          {/* ═══ PAYMENTS TAB ═══ */}
          {activeTab === "payments" && (
            isAccepted ? (
              <PaymentsTabContent
                escrowItems={escrowItems}
                invoices={invoices}
                isInvoiceNeeded={isInvoiceNeeded}
                isWaitingPayment={isWaitingPayment}
                isPaid={isPaid}
                budget={deal.budget}
                onSendInvoice={() => {
                  setInvoiceAmount(String(deal.budget || ""));
                  setShowInvoiceModal(true);
                }}
              />
            ) : (
              <div className="p-5 max-w-[820px] mx-auto">
                <div className="text-center py-16 space-y-3">
                  <CreditCard className="h-10 w-10 mx-auto text-muted-foreground/30" />
                  <p className="text-[15px] font-medium text-muted-foreground">Оплата доступна после принятия предложения и резерва средств</p>
                  <p className="text-[13px] text-muted-foreground/60">Примите предложение, чтобы активировать этот раздел</p>
                </div>
              </div>
            )
          )}

          {/* ═══ MORE TAB ═══ */}
          {activeTab === "more" && (
            <MoreTabContent
              deal={deal}
              auditLog={auditLog}
              advertiserDisplayName={advertiserDisplayName}
              allTermsSorted={allTermsSorted}
              isAccepted={isAccepted}
              isRejected={isRejected}
              userId={user?.id}
              getDiffFields={getDiffFields}
            />
          )}
        </div>
      </div>

      {/* ════════ MODALS ════════ */}
      {/* Reject dialog */}
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

      {/* Counter-offer modal removed — now inline in Terms tab */}

      {/* File request modal */}
      <RequestFilesModal open={showFileRequestModal} onClose={() => setShowFileRequestModal(false)} dealId={deal.id} />

      {/* Invoice modal */}
      <Dialog open={showInvoiceModal} onOpenChange={(open) => { setShowInvoiceModal(open); if (!open) { setInvoiceComment(""); setInvoiceDueDate(undefined); } }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[17px]">
              <FileText className="h-5 w-5 text-primary" /> Отправить счёт
            </DialogTitle>
            <DialogDescription>Выставите счёт рекламодателю для резервирования средств</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-foreground">Сумма <span className="text-destructive">*</span></label>
              <CurrencyInput value={invoiceAmount} onChange={setInvoiceAmount} placeholder={String(deal.budget || 0)} min={1} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-foreground">Срок оплаты</label>
              <DatePickerField value={invoiceDueDate} onChange={setInvoiceDueDate} placeholder="Выберите дату" minDate={new Date()} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-foreground">Комментарий</label>
              <Textarea value={invoiceComment} onChange={(e) => setInvoiceComment(e.target.value)} placeholder="Дополнительная информация…" rows={2} className="text-[14px]" />
            </div>
            <div className="flex items-center gap-2 justify-end pt-2">
              <Button variant="ghost" size="sm" onClick={() => setShowInvoiceModal(false)}>Отмена</Button>
              <Button size="sm" className="gap-1.5 h-10 px-5 text-[14px]" disabled={!invoiceAmount.trim() || Number(invoiceAmount) <= 0 || createInvoice.isPending} onClick={() => {
                createInvoice.mutate({
                  dealId: deal.id,
                  amount: Number(invoiceAmount),
                  comment: invoiceComment.trim() || undefined,
                  dueDate: invoiceDueDate?.toISOString(),
                });
                setShowInvoiceModal(false);
              }}>
                {createInvoice.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Отправить счёт
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent className="w-[400px] sm:w-[440px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-[17px]">Детали предложения</SheetTitle>
          </SheetHeader>
          <div className="space-y-5 mt-4">
            {/* Key terms */}
            <div className="space-y-3">
              <h4 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide">Условия</h4>
              <div className="space-y-2.5">
                <DetailRow label="Рекламодатель" value={advertiserDisplayName} />
                {placement && <DetailRow label="Тип размещения" value={placement} />}
                <DetailRow label="Бюджет" value={fmtBudget(deal.budget)} bold />
                <DetailRow label="Дедлайн" value={deal.deadline ? fmtDate(deal.deadline) : "—"} />
                {termsFields?.revisions && !isBriefEmpty(termsFields.revisions) && <DetailRow label="Правки" value={termsFields.revisions} />}
                {termsFields?.acceptanceCriteria && !isBriefEmpty(termsFields.acceptanceCriteria) && <DetailRow label="Приёмка" value={termsFields.acceptanceCriteria} />}
                <DetailRow label="Статус" value={st.label} />
                <DetailRow label="ID" value={`#${deal.id.slice(0, 8)}`} mono />
              </div>
            </div>

            {/* Brief */}
            {hasBrief && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide">Бриф</h4>
                    <button
                      onClick={() => { navigator.clipboard.writeText(rawBrief || ""); toast.success("Бриф скопирован"); }}
                      className="text-[12px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      <ClipboardCopy className="h-3 w-3" /> Скопировать
                    </button>
                  </div>
                  <p className="text-[14px] text-foreground/90 leading-relaxed safe-text whitespace-pre-wrap">{rawBrief}</p>
                  {briefCta && (
                    <div className="rounded-lg bg-primary/5 border border-primary/15 px-3 py-2 mt-2">
                      <span className="text-[12px] font-medium text-muted-foreground block mb-0.5">CTA</span>
                      <span className="text-[13px] text-foreground safe-text">{briefCta}</span>
                    </div>
                  )}
                  {briefRestrictions && (
                    <div className="rounded-lg bg-destructive/5 border border-destructive/15 px-3 py-2 mt-2">
                      <span className="text-[12px] font-medium text-muted-foreground block mb-0.5">Ограничения</span>
                      <span className="text-[13px] text-foreground safe-text">{briefRestrictions}</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </PageTransition>
  );
}

/* ═══════════════════════════════════════════════════
   TAB COMPONENTS
   ═══════════════════════════════════════════════════ */

/* ─── CHAT TAB ─── */
function ChatTabContent({ dealId, messages, userId, chatInput, setChatInput, sendingChat, onSend, chatEndRef, briefCard }: {
  dealId: string; messages: any[]; userId?: string;
  chatInput: string; setChatInput: (v: string) => void;
  sendingChat: boolean; onSend: () => void;
  chatEndRef: React.RefObject<HTMLDivElement>;
  briefCard?: React.ReactNode;
}) {
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto py-3">
        {briefCard}
        <div className="max-w-[820px] mx-auto px-4 space-y-1">
          {messages.length === 0 && !briefCard && (
            <div className="text-center text-[15px] text-muted-foreground py-16">
              Нет сообщений. Начните общение с рекламодателем.
            </div>
          )}
          {messages.map((msg: any, i: number) => {
            const isMe = msg.sender_id === userId;
            const prev = i > 0 ? messages[i - 1] : null;
            const isSameSender = (prev as any)?.sender_id === msg.sender_id;
            return (
              <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start", isSameSender ? "mt-0.5" : "mt-2.5")}>
                <div className={cn(
                  "max-w-[63%] px-3.5 py-2.5 rounded-2xl",
                  isMe ? "bg-primary text-primary-foreground rounded-br-md" : "bg-secondary text-secondary-foreground rounded-bl-md",
                )}>
                  {!isSameSender && <p className={cn("text-[13px] font-semibold mb-0.5", isMe ? "opacity-80" : "opacity-75")}>{msg.sender_name}</p>}
                  <p className="text-[15px] leading-relaxed safe-text">{msg.content}</p>
                  <p className={cn("text-[12px] mt-0.5 text-right", isMe ? "opacity-60" : "text-muted-foreground")}>
                    {new Date(msg.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>
      </div>
      <div className="px-4 py-2.5 border-t border-border bg-card">
        <div className="max-w-[820px] mx-auto flex gap-2 items-center">
          <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0"><Paperclip className="h-4 w-4" /></Button>
          <Input
            value={chatInput} onChange={(e) => setChatInput(e.target.value)}
            placeholder="Написать сообщение…" className="flex-1 h-10 text-[15px] bg-background"
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && onSend()}
          />
          <Button size="icon" className="h-9 w-9 shrink-0" onClick={onSend} disabled={sendingChat || !chatInput.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── TERMS TAB ─── */
function TermsTabContent({ deal, latestTerms, allTermsSorted, termsFields, placement, canRespond, isAccepted, counterOfferOpen, setCounterOfferOpen, proposalId }: {
  deal: any; latestTerms: any; allTermsSorted: any[]; termsFields: Record<string, string> | null;
  placement: string | null; canRespond: boolean; isAccepted: boolean;
  counterOfferOpen: boolean; setCounterOfferOpen: (v: boolean) => void;
  proposalId?: string;
}) {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const PlacementIcon = placement ? placementIcons[placement] || placementIcons[placement?.toLowerCase()] || FileText : FileText;
  const isLatestAccepted = latestTerms && (latestTerms as any).status === "accepted";

  const [counterBudget, setCounterBudget] = useState("");
  const [counterDeadline, setCounterDeadline] = useState<Date | undefined>(undefined);
  const [counterRevisions, setCounterRevisions] = useState("");
  const [counterAcceptance, setCounterAcceptance] = useState("");
  const [counterMessage, setCounterMessage] = useState("");
  const [submittingCounter, setSubmittingCounter] = useState(false);
  const [showCounterPreview, setShowCounterPreview] = useState(false);

  const handleCounterOffer = async () => {
    if (!user || !deal || !counterMessage.trim() || !counterBudget.trim()) return;
    setSubmittingCounter(true);
    try {
      const currentVersion = latestTerms ? (latestTerms as any).version : 0;
      const newFields: Record<string, string> = {
        ...(termsFields || {}),
        budget: counterBudget || termsFields?.budget || String(deal.budget || 0),
        counterMessage: counterMessage,
      };
      if (counterDeadline) newFields.deadline = counterDeadline.toISOString();
      if (counterRevisions.trim()) newFields.revisions = counterRevisions.trim();
      if (counterAcceptance.trim()) newFields.acceptanceCriteria = counterAcceptance.trim();
      await supabase.from("deal_terms").insert({ deal_id: deal.id, created_by: user.id, version: currentVersion + 1, status: "draft", fields: newFields } as any);
      await supabase.from("deals").update({ status: "needs_changes" }).eq("id", deal.id);
      await supabase.from("deal_audit_log").insert({ deal_id: deal.id, user_id: user.id, action: `Автор предложил изменения (v${currentVersion + 1})`, category: "terms", metadata: { counterBudget, counterDeadline: counterDeadline?.toISOString() } } as any);
      if (deal.advertiser_id) {
        await supabase.from("notifications").insert({ user_id: deal.advertiser_id, title: "Предложены изменения", message: `${profile?.display_name || "Автор"} предложил(а) изменения к «${deal.title}»`, type: "deal", link: "/ad-studio" });
      }
      toast.success("Встречное предложение отправлено.");
      qc.invalidateQueries({ queryKey: ["proposal-deal", proposalId] });
      qc.invalidateQueries({ queryKey: ["deal_terms", deal.id] });
      qc.invalidateQueries({ queryKey: ["creator-incoming-deals"] });
      setCounterOfferOpen(false);
      setShowCounterPreview(false);
      setCounterBudget(""); setCounterDeadline(undefined); setCounterRevisions(""); setCounterAcceptance(""); setCounterMessage("");
    } catch (err) {
      console.error(err);
      toast.error("Ошибка при отправке изменений");
    } finally {
      setSubmittingCounter(false);
    }
  };

  return (
    <div className="p-5 space-y-5 max-w-[820px] mx-auto">
      {/* Current terms cards */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-[15px] font-semibold text-foreground">Условия сделки</h3>
          {isLatestAccepted && (
            <Badge variant="outline" className="text-[11px] bg-green-500/10 text-green-500 border-green-500/30">
              <CheckCircle2 className="h-3 w-3 mr-1" /> Согласовано
            </Badge>
          )}
          {latestTerms && <span className="text-[12px] text-muted-foreground">v{(latestTerms as any).version}</span>}
        </div>
      </div>

      {/* Grouped terms cards */}
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h4 className="text-[14px] font-semibold text-foreground">Размещение</h4>
          <TermsKV label="Тип" value={placement ? <span className="flex items-center gap-1.5"><PlacementIcon className="h-3.5 w-3.5 text-primary" />{placement}</span> : null} />
          {termsFields?.deliverables && <TermsKV label="Результат" value={termsFields.deliverables} />}
          <TermsKV label="Окно публикации" value={deal.deadline ? fmtDate(deal.deadline) : null} />
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h4 className="text-[14px] font-semibold text-foreground">Бюджет</h4>
          <TermsKV label="Сумма" value={deal.budget ? <span className="font-bold">{fmtBudget(deal.budget)}</span> : null} />
          {termsFields?.paymentMilestones && <TermsKV label="Этапы оплаты" value={termsFields.paymentMilestones} />}
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h4 className="text-[14px] font-semibold text-foreground">Правки</h4>
          <TermsKV label="Количество правок" value={termsFields?.revisions && !isBriefEmpty(termsFields.revisions) ? termsFields.revisions : null} />
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h4 className="text-[14px] font-semibold text-foreground">Приёмка</h4>
          <TermsKV label="Критерии приёмки" value={termsFields?.acceptanceCriteria && !isBriefEmpty(termsFields.acceptanceCriteria) ? termsFields.acceptanceCriteria : null} />
        </div>

        {/* Marking */}
        <div className="flex items-center gap-2 pt-1">
          <Shield className="h-4 w-4 text-primary shrink-0" />
          <span className="text-[13px] text-foreground/80">Маркировка обеспечивается платформой</span>
        </div>
      </div>

      {/* ── Inline counter-offer section ── */}
      {canRespond && !isAccepted && (
        <Collapsible open={counterOfferOpen} onOpenChange={setCounterOfferOpen}>
          <CollapsibleTrigger asChild>
            <button className={cn(
              "w-full flex items-center justify-between rounded-xl border px-4 py-3 transition-colors",
              counterOfferOpen
                ? "border-primary/30 bg-primary/5"
                : "border-border bg-card hover:bg-muted/50"
            )}>
              <span className="flex items-center gap-2 text-[14px] font-semibold text-foreground">
                <ArrowLeftRight className="h-4 w-4 text-primary" /> Предложить встречные условия
              </span>
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", counterOfferOpen && "rotate-180")} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="rounded-b-xl border border-t-0 border-border bg-card px-4 py-4 space-y-5">
              {!showCounterPreview ? (
                <>
                  <div className="rounded-lg bg-muted/30 border border-border px-4 py-3 space-y-2">
                    <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">Текущие условия</p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px]">
                      {deal?.budget ? <div className="flex justify-between"><span className="text-muted-foreground">Бюджет</span><span className="font-semibold text-foreground">{fmtBudget(deal.budget)}</span></div> : null}
                      {deal?.deadline ? <div className="flex justify-between"><span className="text-muted-foreground">Дедлайн</span><span className="font-medium text-foreground">{fmtDate(deal.deadline)}</span></div> : null}
                      {termsFields?.revisions && !isBriefEmpty(termsFields.revisions) ? <div className="flex justify-between"><span className="text-muted-foreground">Правки</span><span className="font-medium text-foreground">{termsFields.revisions}</span></div> : null}
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[13px] font-medium text-foreground">Новый бюджет <span className="text-destructive">*</span></label>
                      <CurrencyInput value={counterBudget} onChange={setCounterBudget} placeholder={deal?.budget ? deal.budget.toLocaleString("ru-RU") : "0"} min={1} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[13px] font-medium text-foreground">Новый дедлайн</label>
                      <DatePickerField value={counterDeadline} onChange={setCounterDeadline} placeholder="Выберите дату" minDate={new Date()} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[13px] font-medium text-foreground">Кол-во правок</label>
                        <Input inputMode="numeric" value={counterRevisions} onChange={(e) => setCounterRevisions(e.target.value.replace(/[^0-9]/g, ""))} placeholder={termsFields?.revisions || "2"} className="h-10 text-[14px]" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[13px] font-medium text-foreground">Критерии приёмки</label>
                        <Input value={counterAcceptance} onChange={(e) => setCounterAcceptance(e.target.value)} placeholder={termsFields?.acceptanceCriteria || "Не указаны"} className="h-10 text-[14px]" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[13px] font-medium text-foreground">Комментарий <span className="text-destructive">*</span></label>
                      <Textarea value={counterMessage} onChange={(e) => setCounterMessage(e.target.value)} placeholder="Объясните предлагаемые изменения (мин. 10 символов)…" rows={3} className="text-[14px]" />
                      {counterMessage.trim().length > 0 && counterMessage.trim().length < 10 && <p className="text-[11px] text-destructive">Минимум 10 символов</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 justify-end pt-2">
                    <Button variant="ghost" size="sm" onClick={() => setCounterOfferOpen(false)}>Отмена</Button>
                    <Button size="sm" className="gap-1.5 h-10 px-5 text-[14px]" disabled={!counterBudget.trim() || !counterMessage.trim() || counterMessage.trim().length < 10} onClick={() => setShowCounterPreview(true)}>
                      <Eye className="h-4 w-4" /> Предпросмотр
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                    <p className="text-[13px] font-semibold text-foreground flex items-center gap-2"><Eye className="h-4 w-4 text-primary" /> Предпросмотр изменений</p>
                    <div className="space-y-2">
                      <CounterDiffRow label="Бюджет" oldVal={fmtBudget(termsFields?.budget || deal?.budget)} newVal={counterBudget ? fmtBudget(counterBudget) : null} />
                      <CounterDiffRow label="Дедлайн" oldVal={fmtDate(termsFields?.deadline || deal?.deadline)} newVal={counterDeadline ? fmtDate(counterDeadline.toISOString()) : null} />
                      <CounterDiffRow label="Правки" oldVal={termsFields?.revisions || "—"} newVal={counterRevisions || null} />
                      <CounterDiffRow label="Приёмка" oldVal={termsFields?.acceptanceCriteria || "—"} newVal={counterAcceptance || null} />
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted/30 border border-border px-4 py-3">
                    <p className="text-[12px] font-medium text-muted-foreground mb-1">Ваш комментарий</p>
                    <p className="text-[14px] text-foreground whitespace-pre-wrap safe-text">{counterMessage}</p>
                  </div>
                  <div className="flex items-center gap-2 justify-end pt-2">
                    <Button variant="ghost" size="sm" onClick={() => setShowCounterPreview(false)}>← Редактировать</Button>
                    <Button size="sm" className="gap-1.5 h-10 px-5 text-[14px]" disabled={submittingCounter} onClick={handleCounterOffer}>
                      {submittingCounter ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Отправить
                    </Button>
                  </div>
                </>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

    </div>
  );
}

/* ─── FILES TAB ─── */
function FilesTabContent({ dealId }: { dealId: string }) {
  const { data: dbFiles = [], isLoading } = useDealFiles(dealId);
  const uploadFile = useUploadDealFile();
  const downloadFile = useDownloadDealFile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadCategory, setUploadCategory] = useState("draft");

  const sections = useMemo(() => {
    const groups: Record<string, any[]> = { brief: [], draft: [], final: [], legal: [] };
    dbFiles.forEach((f) => {
      const cat = f.category || "draft";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(f);
    });
    return Object.entries(groups).filter(([, files]) => files.length > 0);
  }, [dbFiles]);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadFile.mutate({ dealId, file, category: uploadCategory });
    e.target.value = "";
  };

  return (
    <div className="p-5 space-y-4 max-w-[820px] mx-auto">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-foreground">Файлы</h3>
        <div className="flex items-center gap-2">
          <Select value={uploadCategory} onValueChange={setUploadCategory}>
            <SelectTrigger className="h-8 w-28 text-[13px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="brief">Бриф</SelectItem>
              <SelectItem value="draft">Черновик</SelectItem>
              <SelectItem value="final">Финальный</SelectItem>
              <SelectItem value="legal">Юридический</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="text-[14px] h-9" onClick={() => fileInputRef.current?.click()} disabled={uploadFile.isPending}>
            <Upload className="h-4 w-4 mr-1.5" /> {uploadFile.isPending ? "Загрузка…" : "Загрузить"}
          </Button>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground text-[14px]">Загрузка…</div>
      ) : sections.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <Files className="h-8 w-8 mx-auto text-muted-foreground/40" />
          <p className="text-[14px] text-muted-foreground">Нет файлов</p>
          <p className="text-[13px] text-muted-foreground/60">Загрузите черновик или финальные материалы</p>
        </div>
      ) : (
        <div className="space-y-5">
          {sections.map(([cat, files]) => (
            <div key={cat}>
              <p className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {fileTypeLabels[cat] || cat}
              </p>
              <div className="space-y-1">
                {files.map((f: any) => (
                  <div key={f.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/30 transition-colors">
                    {f.pinned && <Pin className="h-3.5 w-3.5 text-primary shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <button onClick={() => downloadFile.mutate(f.storage_path)} className="text-[15px] font-medium text-foreground hover:underline truncate block text-left safe-text">
                        {f.file_name}
                      </button>
                      <span className="text-[13px] text-muted-foreground">
                        {((f.file_size || 0) / 1024).toFixed(0)} KB · {fmtDate(f.created_at)}
                      </span>
                    </div>
                    <button onClick={() => downloadFile.mutate(f.storage_path)} className="text-muted-foreground hover:text-foreground shrink-0">
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── PAYMENTS TAB ─── */
function PaymentsTabContent({ escrowItems, invoices, isInvoiceNeeded, isWaitingPayment, isPaid, budget, onSendInvoice }: {
  escrowItems: any[]; invoices: any[]; isInvoiceNeeded: boolean; isWaitingPayment: boolean; isPaid: boolean; budget: number; onSendInvoice: () => void;
}) {
  const total = escrowItems.reduce((s: number, m: any) => s + m.amount, 0);
  const released = escrowItems.filter((m: any) => m.status === "released").reduce((s: number, m: any) => s + m.amount, 0);
  const reserved = escrowItems.filter((m: any) => m.status === "reserved").reduce((s: number, m: any) => s + m.amount, 0);
  const commission = Math.round(total * 0.1);
  const latestInvoice = invoices.length > 0 ? invoices[0] : null;

  return (
    <div className="p-5 space-y-4 max-w-[820px] mx-auto">
      {/* Invoice needed — empty state with CTA */}
      {isInvoiceNeeded && !latestInvoice && (
        <div className="text-center py-12 space-y-3">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground/30" />
          <p className="text-[15px] font-medium text-foreground">Выставите счёт рекламодателю</p>
          <p className="text-[13px] text-muted-foreground/60">Предложение принято. Отправьте счёт для начала работы.</p>
          <Button size="sm" className="text-[14px] h-9 mt-2" onClick={onSendInvoice}>
            <FileText className="h-4 w-4 mr-1.5" /> Отправить счёт
          </Button>
        </div>
      )}

      {/* Invoice card — waiting payment */}
      {latestInvoice && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-[15px] font-semibold">Счёт {latestInvoice.invoice_number}</span>
              </div>
              <Badge variant="outline" className={cn("text-[11px]",
                latestInvoice.status === "paid"
                  ? "bg-green-500/10 text-green-500 border-green-500/30"
                  : "bg-warning/15 text-warning border-warning/30"
              )}>
                {latestInvoice.status === "paid" ? "Оплачено" : "Ожидает оплаты"}
              </Badge>
            </div>
            <div className="space-y-1.5 text-[14px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Сумма</span>
                <span className="font-bold text-foreground">{Number(latestInvoice.amount).toLocaleString("ru-RU")} ₽</span>
              </div>
              {latestInvoice.due_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Срок оплаты</span>
                  <span className="text-foreground">{fmtDate(latestInvoice.due_date)}</span>
                </div>
              )}
              {latestInvoice.comment && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Комментарий</span>
                  <span className="text-foreground/80 text-right max-w-[60%] safe-text">{latestInvoice.comment}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Создан</span>
                <span className="text-foreground/80">{fmtDate(latestInvoice.created_at)}</span>
              </div>
              {latestInvoice.paid_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Оплачен</span>
                  <span className="text-green-500 font-medium">{fmtDate(latestInvoice.paid_at)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Escrow summary */}
      {isPaid && (
        <>
          <div className="flex items-center gap-3 flex-wrap text-[15px]">
            <span className="text-muted-foreground">Итого: <span className="font-semibold text-foreground">{total.toLocaleString()} ₽</span></span>
            <span className="text-border">·</span>
            <span className="text-muted-foreground">Резерв: <span className="font-semibold text-foreground">{reserved.toLocaleString()} ₽</span></span>
            <span className="text-border">·</span>
            <span className="text-muted-foreground">Выплачено: <span className="font-semibold text-green-500">{released.toLocaleString()} ₽</span></span>
          </div>

          {escrowItems.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-0">
                <p className="text-[15px] font-semibold mb-2">Этапы оплаты</p>
                {escrowItems.map((ms: any, i: number) => (
                  <div key={ms.id} className={cn("flex items-center justify-between py-2", i > 0 && "border-t border-border/50")}>
                    <div className="flex items-center gap-2.5">
                      <span className={cn("text-[12px] font-medium px-1.5 py-0.5 rounded", paymentStatusColors[ms.status] || "bg-muted text-muted-foreground")}>
                        {paymentStatusLabels[ms.status] || ms.status}
                      </span>
                      <span className="text-[15px]">{ms.label}</span>
                    </div>
                    <span className="text-[15px] font-medium">{ms.amount.toLocaleString()} ₽</span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 mt-1 border-t border-border/30">
                  <span className="text-[13px] text-muted-foreground/60">Комиссия платформы (10%)</span>
                  <span className="text-[13px] text-muted-foreground/60">{commission.toLocaleString()} ₽</span>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Fallback: no invoice, no escrow, not invoice_needed */}
      {!isInvoiceNeeded && !latestInvoice && escrowItems.length === 0 && (
        <div className="text-center py-12 space-y-2">
          <CreditCard className="h-8 w-8 mx-auto text-muted-foreground/40" />
          <p className="text-[14px] text-muted-foreground">Платежи ещё не зарезервированы</p>
          <p className="text-[13px] text-muted-foreground/60">Рекламодатель зарезервирует средства для начала работы</p>
        </div>
      )}
    </div>
  );
}

/* ─── MORE TAB (History + Audit) ─── */
function MoreTabContent({ deal, auditLog, advertiserDisplayName, allTermsSorted, isAccepted, isRejected, userId, getDiffFields }: {
  deal: any; auditLog: any[]; advertiserDisplayName: string;
  allTermsSorted: any[]; isAccepted: boolean; isRejected: boolean; userId?: string;
  getDiffFields: (cur: Record<string, string> | null, prev: Record<string, string> | null) => { key: string; label: string; from: string; to: string }[];
}) {
  const [showAll, setShowAll] = useState(false);
  const display = showAll ? auditLog : auditLog.slice(0, 10);

  const [selectedVersionIdx, setSelectedVersionIdx] = useState<number | null>(null);
  const effectiveIdx = selectedVersionIdx ?? (allTermsSorted.length > 0 ? allTermsSorted.length - 1 : null);
  const selectedVersion = effectiveIdx !== null ? allTermsSorted[effectiveIdx] : null;
  const selectedFields = selectedVersion ? ((selectedVersion as any).fields as Record<string, string>) : null;
  const prevVersion = effectiveIdx !== null && effectiveIdx > 0 ? allTermsSorted[effectiveIdx - 1] : null;
  const prevFields = prevVersion ? ((prevVersion as any).fields as Record<string, string>) : null;

  return (
    <div className="p-5 space-y-6 max-w-[820px] mx-auto">
      {/* ── Version history (read-only) ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-foreground flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" /> Версии условий
            {allTermsSorted.length > 0 && <span className="text-[12px] text-muted-foreground font-normal">({allTermsSorted.length})</span>}
          </h3>
          {isAccepted && (
            <Badge variant="outline" className="text-[11px] bg-muted text-muted-foreground border-muted-foreground/20">Только чтение</Badge>
          )}
        </div>

        {isAccepted && (
          <div className="rounded-lg border border-green-500/20 bg-green-500/5 px-3.5 py-2.5 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-green-500 shrink-0" />
            <p className="text-[13px] text-foreground/80">Предложение принято, история доступна только для просмотра</p>
          </div>
        )}

        {allTermsSorted.length === 0 ? (
          <div className="text-center py-8">
            <History className="h-7 w-7 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-[14px] text-muted-foreground">Версий условий пока нет</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {allTermsSorted.map((t: any, idx: number) => {
                const isSelected = idx === effectiveIdx;
                const createdByCreator = t.created_by === deal.creator_id;
                const isCurrent = idx === allTermsSorted.length - 1;
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedVersionIdx(idx)}
                    className={cn(
                      "px-3 py-2 rounded-lg text-[13px] font-medium border transition-colors flex flex-col items-start gap-0.5",
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary"
                        : t.status === "accepted"
                          ? "bg-green-500/10 text-green-600 border-green-500/30 hover:bg-green-500/20"
                          : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      v{t.version}
                      {isCurrent && <Badge variant="outline" className="text-[9px] h-4 px-1 border-primary/30 bg-primary/10 text-primary">Текущая</Badge>}
                      {t.status === "accepted" && <Badge variant="outline" className="text-[9px] h-4 px-1 border-green-500/30 bg-green-500/10 text-green-500">Принято</Badge>}
                    </span>
                    <span className={cn("text-[10px]", isSelected ? "text-primary-foreground/70" : "text-muted-foreground")}>
                      {createdByCreator ? "Вы" : "Рекламодатель"} · {fmtDateTime(t.created_at)}
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedVersion && (
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[14px] font-semibold text-foreground">v{(selectedVersion as any).version}</span>
                  <Badge variant="outline" className={cn("text-[10px] h-5",
                    (selectedVersion as any).status === "accepted" ? "bg-green-500/10 text-green-500 border-green-500/30" :
                    effectiveIdx === allTermsSorted.length - 1 ? "bg-primary/10 text-primary border-primary/30" :
                    "bg-muted text-muted-foreground border-muted-foreground/20"
                  )}>
                    {(selectedVersion as any).status === "accepted" ? "Принято" : effectiveIdx === allTermsSorted.length - 1 ? "Текущая" : "Заменена"}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">{fmtDateTime((selectedVersion as any).created_at)}</span>
                  <span className="text-[11px] text-muted-foreground">· {(selectedVersion as any).created_by === deal.creator_id ? "Вы" : advertiserDisplayName}</span>
                </div>

                {selectedFields && (
                  <div className="space-y-2">
                    {selectedFields.budget && <KVRow label="Бюджет" value={fmtBudget(selectedFields.budget)} bold />}
                    {selectedFields.deadline && <KVRow label="Дедлайн" value={fmtDate(selectedFields.deadline)} />}
                    {selectedFields.revisions && !isBriefEmpty(selectedFields.revisions) && <KVRow label="Правки" value={selectedFields.revisions} />}
                    {selectedFields.acceptanceCriteria && !isBriefEmpty(selectedFields.acceptanceCriteria) && <KVRow label="Приёмка" value={selectedFields.acceptanceCriteria} />}
                  </div>
                )}

                {selectedFields?.counterMessage && (
                  <p className="text-[13px] text-foreground/70 italic border-l-2 border-muted-foreground/20 pl-3 safe-text">«{selectedFields.counterMessage}»</p>
                )}

                {prevFields && selectedFields && (() => {
                  const diffs = getDiffFields(selectedFields, prevFields);
                  if (diffs.length === 0) return null;
                  return (
                    <div className="rounded-lg bg-muted/30 border border-border px-3 py-2 space-y-1.5">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Изменения</p>
                      {diffs.map((d) => (
                        <div key={d.key} className="flex items-center gap-2 text-[12px]">
                          <span className="text-muted-foreground w-[90px] shrink-0">{d.label}:</span>
                          <span className="line-through text-muted-foreground/50">{d.from}</span>
                          <span className="text-foreground">→</span>
                          <span className="font-semibold text-primary">{d.to}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </>
        )}
      </div>

      <Separator />

      {/* ── Audit log ── */}
      <div className="space-y-4">
        <h3 className="text-[15px] font-semibold text-foreground flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-muted-foreground" /> Журнал событий
        </h3>

        <div className="relative pl-6 space-y-0">
          <div className="absolute left-0 top-0 bottom-0 w-px bg-border" />

          <AuditEntry icon={<FileText className="h-3.5 w-3.5" />} text={`Предложение создано рекламодателем ${advertiserDisplayName}`} date={deal.created_at} accent />

          {display.map((entry: any) => (
            <AuditEntry
              key={entry.id}
              icon={
                entry.category === "terms" ? <ArrowLeftRight className="h-3.5 w-3.5" /> :
                entry.category === "files" ? <Paperclip className="h-3.5 w-3.5" /> :
                entry.category === "payments" ? <CheckCircle2 className="h-3.5 w-3.5" /> :
                <ScrollText className="h-3.5 w-3.5" />
              }
              text={entry.action}
              date={entry.created_at}
              category={entry.category !== "general" ? entry.category : undefined}
            />
          ))}

          {auditLog.length === 0 && (
            <AuditEntry icon={<Clock className="h-3.5 w-3.5" />} text="Ожидание действий" date={deal.created_at} />
          )}
        </div>

        {auditLog.length > 10 && !showAll && (
          <button onClick={() => setShowAll(true)} className="text-[13px] text-primary hover:underline">Показать все ({auditLog.length})</button>
        )}
      </div>
    </div>
  );
}

/* ─── REQUEST FILES MODAL ─── */
function RequestFilesModal({ open, onClose, dealId }: { open: boolean; onClose: () => void; dealId: string }) {
  const { user, profile } = useAuth();
  const logEvent = useLogDealEvent();
  const qc = useQueryClient();
  const [items, setItems] = useState([
    { label: "Логотип бренда", checked: true },
    { label: "Брендбук / гайдлайны", checked: false },
    { label: "Продуктовые фото/видео", checked: false },
    { label: "Текст для озвучки", checked: false },
    { label: "Ссылки для описания", checked: false },
  ]);
  const [customItem, setCustomItem] = useState("");
  const [sending, setSending] = useState(false);

  const addCustom = () => {
    if (!customItem.trim()) return;
    setItems([...items, { label: customItem.trim(), checked: true }]);
    setCustomItem("");
  };

  const handleSend = async () => {
    if (!user) return;
    const selected = items.filter((i) => i.checked).map((i) => i.label);
    if (selected.length === 0) return;
    setSending(true);
    try {
      const list = selected.map((s) => `• ${s}`).join("\n");
      await supabase.from("messages").insert({
        deal_id: dealId, sender_id: user.id,
        sender_name: profile?.display_name || "Автор",
        content: `📋 Запрос файлов:\n${list}\n\nПожалуйста, загрузите указанные материалы в раздел «Файлы».`,
      });
      logEvent.mutate({ dealId, action: `Запрос файлов: ${selected.join(", ")}`, category: "files" });

      const { data: deal } = await supabase.from("deals").select("advertiser_id, title").eq("id", dealId).single();
      if (deal?.advertiser_id) {
        await supabase.from("notifications").insert({
          user_id: deal.advertiser_id, title: "Запрос файлов",
          message: `Автор запрашивает файлы: ${selected.join(", ")}`,
          type: "deal", link: "/ad-studio",
        });
      }
      toast.success("Запрос отправлен");
      qc.invalidateQueries({ queryKey: ["deal-chat", dealId] });
      onClose();
    } catch { toast.error("Ошибка"); }
    finally { setSending(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Запросить файлы</DialogTitle>
          <DialogDescription>Выберите, какие материалы нужны от рекламодателя</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {items.map((item, i) => (
            <label key={i} className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={item.checked} onChange={() => {
                const copy = [...items]; copy[i].checked = !copy[i].checked; setItems(copy);
              }} className="rounded border-border" />
              <span className="text-[14px]">{item.label}</span>
            </label>
          ))}
          <div className="flex gap-2">
            <Input value={customItem} onChange={(e) => setCustomItem(e.target.value)} placeholder="Другое…" className="h-8 text-[13px] flex-1" />
            <Button size="sm" variant="outline" className="h-8 text-[13px]" onClick={addCustom} disabled={!customItem.trim()}>+</Button>
          </div>
          <Button className="w-full" onClick={handleSend} disabled={sending || items.filter((i) => i.checked).length === 0}>
            {sending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Отправка…</> : "Отправить запрос"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Helper components ─── */

function DetailRow({ label, value, bold, mono }: { label: string; value: string; bold?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[13px] text-muted-foreground shrink-0">{label}</span>
      <span className={cn("text-[14px] text-foreground text-right safe-text", bold && "font-bold", mono && "font-mono text-[12px]")}>{value}</span>
    </div>
  );
}

function KVRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-foreground", bold && "font-bold")}>{value}</span>
    </div>
  );
}

function TermsKV({ label, value }: { label: string; value: React.ReactNode | null }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-[14px] text-muted-foreground shrink-0">{label}</span>
      <span className="text-[15px] text-foreground text-right safe-text">
        {value ?? <span className="text-muted-foreground/60 italic text-[13px]">Не указано</span>}
      </span>
    </div>
  );
}

function AuditEntry({ icon, text, date, category, accent }: { icon: React.ReactNode; text: string; date: string; category?: string; accent?: boolean }) {
  return (
    <div className="relative pb-4 last:pb-0">
      <div className={cn(
        "absolute left-0 top-1 w-5 h-5 rounded-full -translate-x-[10px] flex items-center justify-center",
        accent ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
      )}>
        {icon}
      </div>
      <div className="ml-4">
        <p className="text-[13px] text-foreground">{text}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-muted-foreground">
            {new Date(date).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </span>
          {category && <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">{category}</span>}
        </div>
      </div>
    </div>
  );
}

function CounterDiffRow({ label, oldVal, newVal }: { label: string; oldVal: string; newVal: string | null }) {
  const changed = newVal !== null && newVal !== oldVal;
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <span className="text-muted-foreground w-[120px] shrink-0">{label}:</span>
      {changed ? (
        <>
          <span className="line-through text-muted-foreground/60">{oldVal}</span>
          <span className="text-foreground">→</span>
          <span className="font-semibold text-primary">{newVal}</span>
        </>
      ) : (
        <span className="text-foreground/70">{oldVal} <span className="text-[11px] text-muted-foreground">(без изменений)</span></span>
      )}
    </div>
  );
}
