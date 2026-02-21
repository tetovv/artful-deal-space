import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { deals as mockDeals, messages as allMessages } from "@/data/mockData";
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";
import { useAdvertiserScores } from "@/hooks/useAdvertiserScores";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  useDealAuditLog, useLogDealEvent,
  useDealEscrow, useReserveEscrow, useReleaseEscrow,
  useDealFiles, useUploadDealFile, useDownloadDealFile, useTogglePinFile,
  useDealTerms, useAcceptTerms,
  useRealtimeAuditLog, useRealtimeEscrow,
} from "@/hooks/useDealData";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDealInvoices, usePayInvoice, useRealtimeInvoices } from "@/hooks/useDealInvoices";
import { EscrowPayoutSection } from "@/components/ad-studio/EscrowPayoutSection";
import { MarkingTab } from "@/components/ad-studio/MarkingTab";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Search, Send, Paperclip, MoreVertical, ShieldCheck,
  CheckCircle2, AlertTriangle, Clock, FileText, Upload, Download,
  ExternalLink, Pin, RefreshCw, MessageCircle, ClipboardCopy,
  Archive, Files, CreditCard, Radio, ScrollText, CalendarDays, Copy,
  ChevronDown, ChevronRight, ArrowLeftRight, Loader2, Megaphone,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Deal, DealStatus } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/* ─── Status config ─── */
const statusColors: Record<DealStatus, string> = {
  pending: "bg-warning/15 text-warning border-warning/30",
  briefing: "bg-info/15 text-info border-info/30",
  in_progress: "bg-primary/15 text-primary border-primary/30",
  review: "bg-accent/15 text-accent border-accent/30",
  completed: "bg-success/15 text-success border-success/30",
  disputed: "bg-destructive/15 text-destructive border-destructive/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  needs_changes: "bg-warning/15 text-warning border-warning/30",
  accepted: "bg-success/15 text-success border-success/30",
  invoice_needed: "bg-warning/15 text-warning border-warning/30",
  waiting_payment: "bg-warning/15 text-warning border-warning/30",
};

const statusLabels: Record<string, string> = {
  pending: "Ожидание автора",
  briefing: "Бриф",
  invoice_needed: "Ожидание счёта",
  waiting_payment: "Ожидает оплаты",
  in_progress: "В работе",
  review: "На проверке",
  completed: "Завершено",
  disputed: "Спор",
  needs_changes: "Встречное от автора",
  accepted: "Принято",
  rejected: "Отказ автора",
};

const filterStatusMap: Record<string, string[]> = {
  all: ["pending", "briefing", "in_progress", "review", "completed", "disputed", "needs_changes", "accepted", "invoice_needed", "waiting_payment"],
  action: ["pending", "needs_changes", "review", "accepted", "invoice_needed", "waiting_payment"],
  active: ["in_progress", "briefing"],
  completed: ["completed"],
  rejected: ["rejected"],
};

/* ─── Placement type label for sidebar ─── */
const placementTypeFromTitle = (title: string): string | null => {
  const t = title.toLowerCase();
  if (t.includes("видео") || t.includes("video")) return "Видео";
  if (t.includes("пост") || t.includes("post")) return "Пост";
  if (t.includes("подкаст") || t.includes("podcast")) return "Подкаст";
  return null;
};

/* ─── State-specific primary CTA — explicit next step, not generic ─── */
function getPrimaryAction(status: string, escrowState?: string): { label: string; icon: any; disabled?: boolean } | null {
  // Escrow-state-aware overrides for payment states
  if (status === "waiting_payment" || status === "accepted") {
    if (!escrowState || escrowState === "WAITING_INVOICE") {
      return { label: "Ожидаем счёт", icon: Clock, disabled: true };
    }
    if (escrowState === "INVOICE_SENT") {
      return { label: "Зарезервировать средства", icon: CreditCard };
    }
    if (escrowState === "FUNDS_RESERVED" || escrowState === "ACTIVE_PERIOD") {
      return { label: "Средства зарезервированы", icon: ShieldCheck, disabled: true };
    }
    if (escrowState === "PAYOUT_READY" || escrowState === "PAID_OUT") {
      return null; // no header CTA needed
    }
  }
  switch (status) {
    case "pending": return null;
    case "needs_changes": return { label: "Смотреть изменения", icon: ScrollText };
    case "invoice_needed": return { label: "Ожидаем счёт", icon: Clock, disabled: true };
    case "briefing": return { label: "Отправить черновик на проверку", icon: Send };
    case "in_progress": return { label: "Отправить черновик на проверку", icon: Upload };
    case "review": return { label: "Принять черновик", icon: CheckCircle2 };
    default: return null;
  }
}

/* ─── Next-step hint text (non-interactive) ─── */
function getNextStepHint(status: string): string | null {
  switch (status) {
    case "pending": return "Ожидаем ответа автора на ваше предложение";
    case "needs_changes": return "Автор предложил встречные условия — проверьте и примите решение";
    case "accepted": return "Предложение принято — зарезервируйте средства для начала работы";
    case "invoice_needed": return "Автор принял предложение. Ожидайте счёт.";
    case "waiting_payment": return "Получен счёт — оплатите или зарезервируйте средства для начала работы";
    case "briefing": return "Следующий шаг: Отправить черновик интеграции на проверку";
    case "in_progress": return "Следующий шаг: Загрузить черновик и отправить на проверку";
    case "review": return "Следующий шаг: Принять или запросить правки черновика";
    case "completed": return null;
    case "disputed": return "Ожидаем решения: спор на рассмотрении";
    case "rejected": return "Автор отклонил предложение";
    default: return null;
  }
}

/* ─── Short next-step hint for sidebar deal items ─── */
function getNextStepShort(status: string, escrowState?: string): string | null {
  if ((status === "waiting_payment" || status === "accepted") && escrowState) {
    if (escrowState === "FUNDS_RESERVED" || escrowState === "ACTIVE_PERIOD") return "Зарезервировано";
    if (escrowState === "PAYOUT_READY") return "Готов к выплате";
    if (escrowState === "PAID_OUT") return "Выплачено";
  }
  switch (status) {
    case "pending": return "Ожидание автора";
    case "needs_changes": return "Встречное — решите";
    case "accepted": return "Зарезервировать";
    case "invoice_needed": return "Ожидание счёта";
    case "waiting_payment": return "Оплатить";
    case "briefing": return "Отправить черновик";
    case "in_progress": return "Загрузить черновик";
    case "review": return "Принять черновик";
    case "disputed": return "Спор на рассмотрении";
    case "rejected": return "Отклонено";
    case "completed": return null;
    default: return null;
  }
}

/* ─── Mock data ─── */
const mockAudit = [
  { id: "a1", ts: "01.12.24 10:00", who: "Мария Иванова", action: "Создала сделку", category: "terms" },
  { id: "a2", ts: "01.12.24 10:05", who: "Мария Иванова", action: "Загрузила brief_v1.pdf", category: "files", file: "brief_v1.pdf" },
  { id: "a3", ts: "02.12.24 09:00", who: "Алексей Петров", action: "Подтвердил условия v1", category: "terms" },
  { id: "a4", ts: "05.12.24 14:00", who: "Система", action: "Средства зарезервированы (45 000 ₽)", category: "payments" },
  { id: "a5", ts: "18.12.24 16:00", who: "Алексей Петров", action: "Загрузил draft_integration.mp4", category: "files", file: "draft_integration.mp4" },
  { id: "a6", ts: "19.12.24 12:00", who: "Система", action: "ERID получен: 2SDnjek4fP1", category: "ord" },
];

const mockFiles = [
  { id: "f1", name: "brief_v1.pdf", type: "Brief" as const, uploader: "Мария Иванова", date: "01.12.24", pinned: false },
  { id: "f2", name: "draft_integration.mp4", type: "Draft" as const, uploader: "Алексей Петров", date: "18.12.24", pinned: false },
  { id: "f3", name: "final_cut.mp4", type: "Final" as const, uploader: "Алексей Петров", date: "08.01.25", pinned: true },
  { id: "f4", name: "договор_оферты.pdf", type: "Legal" as const, uploader: "Система", date: "01.12.24", pinned: false },
];

const fileTypeLabels: Record<string, string> = { Brief: "Бриф", Draft: "Черновик", Final: "Финальный", Legal: "Юридический", brief: "Бриф", draft: "Черновик", final: "Финальный", legal: "Юридический" };
const fileTypeColors = { Brief: "bg-info/15 text-info", Draft: "bg-warning/15 text-warning", Final: "bg-success/15 text-success", Legal: "bg-muted text-muted-foreground" };

const mockTermsVersions = [
  {
    version: 1, status: "accepted" as const, date: "02.12.24",
    acceptedBy: ["Мария Иванова", "Алексей Петров"],
    fields: {
      deliverable: "60-сек рекламная интеграция", platform: "YouTube", format: "Видео",
      price: "45 000 ₽", deadline: "15.01.2025", paymentMilestones: "50% аванс, 50% по завершении",
      acceptanceCriteria: "Финальное видео утверждено рекламодателем", eridResponsibility: "Платформа",
      cancellation: "Возврат 100% при отмене до начала работ",
    },
  },
  {
    version: 2, status: "draft" as const, date: "05.01.25",
    acceptedBy: [],
    fields: {
      deliverable: "60-сек интеграция + Stories", platform: "YouTube + Instagram", format: "Видео + Stories",
      price: "55 000 ₽", deadline: "20.01.2025", paymentMilestones: "50% аванс, 50% по завершении",
      acceptanceCriteria: "Видео и Stories утверждены", eridResponsibility: "Платформа",
      cancellation: "Возврат 100% при отмене до начала работ",
    },
  },
];

const mockPayment = {
  total: 45000, reserved: 45000, released: 22500, commission: 4500, commissionPercent: 10,
  milestones: [
    { id: "pm1", label: "Аванс (50%)", amount: 22500, status: "released" as const },
    { id: "pm2", label: "По завершении (50%)", amount: 22500, status: "reserved" as const },
  ],
};

const paymentStatusLabels: Record<string, string> = { reserved: "Резерв", in_progress: "В работе", review: "На проверке", released: "Выплачено" };
const paymentStatusColors: Record<string, string> = { reserved: "bg-warning/15 text-warning", in_progress: "bg-primary/15 text-primary", review: "bg-accent/15 text-accent", released: "bg-success/15 text-success" };

const fileSizeMock: Record<string, string> = {
  "f1": "PDF · 1.2 MB", "f2": "MP4 · 84 MB", "f3": "MP4 · 112 MB", "f4": "PDF · 340 KB",
};

/* ═══════════════════════════════════════════════════════
   SIDEBAR
   ═══════════════════════════════════════════════════════ */
function DealSidebar({
  selectedId, onSelect, searchQuery, setSearchQuery, statusFilter, setStatusFilter, allDeals,
}: {
  selectedId: string;
  onSelect: (d: Deal) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  allDeals: Deal[];
}) {
  const filtered = useMemo(() => {
    let list = [...allDeals];
    const statuses = filterStatusMap[statusFilter] || filterStatusMap.all;
    list = list.filter((d) => statuses.includes(d.status));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.advertiserName.toLowerCase().includes(q) ||
          d.creatorName.toLowerCase().includes(q)
      );
    }
    return list;
  }, [allDeals, searchQuery, statusFilter]);

  const actionCount = useMemo(() =>
    allDeals.filter((d) => ["pending", "needs_changes", "review", "accepted"].includes(d.status)).length
  , [allDeals]);

  const rejectedCount = useMemo(() =>
    allDeals.filter((d) => d.status === "rejected").length
  , [allDeals]);

  // Mock unread indicators (new messages / new files per deal)
  const unreadMap = useMemo(() => {
    const map: Record<string, { messages: number; files: number }> = {};
    allDeals.forEach((d) => {
      // Simulate: deals in certain statuses might have unread
      const hasUnread = ["needs_changes", "review", "in_progress"].includes(d.status);
      map[d.id] = {
        messages: hasUnread ? Math.floor(Math.random() * 3) : 0,
        files: d.status === "review" ? 1 : 0,
      };
    });
    return map;
  }, [allDeals]);

  return (
    <div className="w-[340px] border-r border-border bg-card flex flex-col shrink-0 h-full">
      <div className="p-3 space-y-2.5 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск сделок..."
            className="pl-8 h-9 text-[14px] bg-background"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto max-w-full [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {[
            { key: "all", label: "Все" },
            { key: "action", label: "Действие", count: actionCount },
            { key: "active", label: "В работе" },
            { key: "completed", label: "Готово" },
            { key: "rejected", label: "Отказы", count: rejectedCount },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[13px] font-medium transition-colors flex items-center gap-1 whitespace-nowrap shrink-0",
                statusFilter === f.key
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {f.label}
              {f.count !== undefined && f.count > 0 && (
                <span className="bg-primary/20 text-primary text-[10px] font-bold px-1.5 rounded-full leading-4">{f.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.map((deal) => {
          const isSelected = selectedId === deal.id;
          const placement = placementTypeFromTitle(deal.title);
          const statusColor = statusColors[deal.status as DealStatus] || "bg-muted text-muted-foreground border-muted-foreground/20";
          const nextStep = getNextStepShort(deal.status);
          const unread = unreadMap[deal.id] || { messages: 0, files: 0 };
          const hasUnread = unread.messages > 0 || unread.files > 0;

          return (
            <button
              key={deal.id}
              onClick={() => onSelect(deal)}
              className={cn(
                "w-full text-left px-3.5 py-3 border-b border-border/40 transition-colors min-h-[60px]",
                isSelected ? "bg-primary/8 border-l-2 border-l-primary pl-[12px]" : "hover:bg-muted/30"
              )}
            >
              {/* Row 1: Creator name + status */}
              <div className="flex items-start justify-between gap-2 min-w-0">
                <span className="text-[15px] font-semibold text-card-foreground truncate min-w-0 flex-1">{deal.creatorName}</span>
                <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0 whitespace-nowrap max-w-[120px] truncate", statusColor)}>
                  {statusLabels[deal.status] || deal.status}
                </span>
              </div>

              {/* Row 2: Placement type */}
              <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                {placement && (
                  <span className="text-[12px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded shrink-0">{placement}</span>
                )}
                <span className="text-[13px] text-muted-foreground truncate min-w-0">{deal.title}</span>
              </div>

              {/* Row 3: Amount + last activity */}
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[14px] font-semibold text-card-foreground">{deal.budget.toLocaleString()} ₽</span>
                <span className="text-[12px] text-muted-foreground">
                  {new Date(deal.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                </span>
              </div>

              {/* Row 4: Next step hint + unread indicators */}
              <div className="flex items-center justify-between mt-1 min-w-0 gap-1.5">
                {nextStep ? (
                  <span className="text-[12px] text-primary/80 font-medium truncate">→ {nextStep}</span>
                ) : (
                  <span />
                )}
                {hasUnread && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {unread.messages > 0 && (
                      <span className="flex items-center gap-0.5 text-[11px] text-primary font-medium">
                        <MessageCircle className="h-3 w-3" />
                        {unread.messages}
                      </span>
                    )}
                    {unread.files > 0 && (
                      <span className="flex items-center gap-0.5 text-[11px] text-primary font-medium">
                        <Files className="h-3 w-3" />
                        {unread.files}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-10 text-[14px] text-muted-foreground">Сделки не найдены</div>
        )}
      </div>
    </div>
  );
}
/* ═══════════════════════════════════════════════════════
   CHAT TAB — no summary strip, clean centered chat
   ═══════════════════════════════════════════════════════ */

function formatDateSeparator(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (msgDay.getTime() === today.getTime()) return "Сегодня";
  if (msgDay.getTime() === yesterday.getTime()) return "Вчера";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

function ChatTab({ deal }: { deal: Deal }) {
  useRealtimeMessages(deal.id);
  const dealMessages = allMessages.filter((m) => m.dealId === deal.id);
  const [newMsg, setNewMsg] = useState("");

  return (
    <div className="flex flex-col h-full">
      {/* Messages with grouping and date separators — NO summary strip */}
      <div className="flex-1 overflow-y-auto py-3">
        <div className="max-w-[820px] mx-auto px-4">
          {dealMessages.length === 0 && (
            <div className="text-center text-[15px] text-muted-foreground py-16">Нет сообщений</div>
          )}
          {dealMessages.map((msg, i) => {
            const isMe = msg.senderId === "u1";
            const prev = i > 0 ? dealMessages[i - 1] : null;
            const isSameSender = prev?.senderId === msg.senderId;

            const msgDate = new Date(msg.timestamp).toDateString();
            const prevDate = prev ? new Date(prev.timestamp).toDateString() : null;
            const showDateSep = msgDate !== prevDate;

            return (
              <div key={msg.id}>
                {showDateSep && (
                  <div className="flex items-center gap-3 my-3">
                    <div className="flex-1 h-px bg-border/50" />
                    <span className="text-[13px] text-muted-foreground font-medium">{formatDateSeparator(msg.timestamp)}</span>
                    <div className="flex-1 h-px bg-border/50" />
                  </div>
                )}
                <div className={cn(
                  "flex",
                  isMe ? "justify-end" : "justify-start",
                  isSameSender && !showDateSep ? "mt-0.5" : "mt-2.5"
                )}>
                  <div
                    className={cn(
                      "max-w-[63%] px-3.5 py-2.5",
                      isMe
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground",
                      isSameSender && !showDateSep
                        ? isMe ? "rounded-2xl rounded-tr-md rounded-br-md" : "rounded-2xl rounded-tl-md rounded-bl-md"
                        : isMe ? "rounded-2xl rounded-br-md" : "rounded-2xl rounded-bl-md"
                    )}
                  >
                    {(!isSameSender || showDateSep) && (
                      <p className={cn(
                        "text-[13px] font-semibold mb-0.5",
                        isMe ? "opacity-80" : "opacity-75"
                      )}>{msg.senderName}</p>
                    )}
                    <p className="text-[15px] leading-relaxed">{msg.content}</p>
                    {msg.attachment && (
                      <div className="mt-1.5 flex items-center gap-1.5 px-2 py-1 rounded-md bg-background/10 max-w-fit">
                        <FileText className="h-3.5 w-3.5 shrink-0 opacity-70" />
                        <a href="#" className="text-[13px] font-medium underline hover:no-underline truncate max-w-[180px]">
                          {msg.attachment}
                        </a>
                        <button className="opacity-60 hover:opacity-100 shrink-0 ml-1" title="Скачать">
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    <p className={cn(
                      "text-[12px] mt-0.5 text-right",
                      isMe ? "opacity-60" : "text-muted-foreground"
                    )}>
                      {new Date(msg.timestamp).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Composer */}
      <div className="px-4 py-2.5 border-t border-border bg-card">
        <div className="max-w-[820px] mx-auto flex gap-2 items-center">
          <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0">
            <Paperclip className="h-4 w-4" />
          </Button>
          <Input
            value={newMsg}
            onChange={(e) => setNewMsg(e.target.value)}
            placeholder="Написать сообщение..."
            className="flex-1 h-10 text-[15px] bg-background"
          />
          <Button size="icon" className="h-9 w-9 shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TERMS TAB — first section expanded, rest collapsed
   ═══════════════════════════════════════════════════════ */

type TermFieldRow = { label: string; key: string };

const termsSections: { title: string; fields: TermFieldRow[] }[] = [
  {
    title: "Размещение",
    fields: [
      { label: "Тип", key: "deliverable" },
      { label: "Платформа", key: "platform" },
      { label: "Формат", key: "format" },
    ],
  },
  {
    title: "Сроки и доставка",
    fields: [{ label: "Дедлайн", key: "deadline" }],
  },
  {
    title: "Оплата",
    fields: [
      { label: "Стоимость", key: "price" },
      { label: "Этапы", key: "paymentMilestones" },
    ],
  },
  {
    title: "Приёмка и правки",
    fields: [{ label: "Критерии", key: "acceptanceCriteria" }],
  },
  {
    title: "Отмена и маркировка",
    fields: [
      { label: "Правила отмены", key: "cancellation" },
      { label: "Ответственность за ERID", key: "eridResponsibility" },
    ],
  },
];

function TermsTab({ dealId }: { dealId: string }) {
  const { user } = useAuth();
  const { data: dbTerms = [] } = useDealTerms(dealId);
  const acceptTerms = useAcceptTerms();

  // Fetch deal to know role & status
  const { data: deal } = useQuery({
    queryKey: ["deal_detail", dealId],
    queryFn: async () => {
      const { data } = await supabase.from("deals").select("*").eq("id", dealId).single();
      return data;
    },
    enabled: !!dealId,
  });

  const isAdvertiser = deal?.advertiser_id === user?.id;
  const isCreator = deal?.creator_id === user?.id;
  const isNeedsChanges = deal?.status === "needs_changes";

  const termsVersions = dbTerms.length > 0
    ? dbTerms.map((t: any) => {
        const acceptances = t.deal_terms_acceptance || [];
        return {
          id: t.id,
          version: t.version,
          status: t.status as "accepted" | "draft" | "pending",
          date: new Date(t.created_at).toLocaleDateString("ru-RU"),
          acceptedBy: acceptances.map((a: any) => a.user_id === deal?.advertiser_id ? (deal?.advertiser_name || "Рекламодатель") : (deal?.creator_name || "Автор")),
          acceptanceCount: acceptances.length,
          fields: t.fields as Record<string, string>,
          myAccepted: acceptances.some((a: any) => a.user_id === user?.id),
          createdBy: (t as any).created_by,
        };
      })
    : mockTermsVersions.map((v) => ({ ...v, id: "", myAccepted: false, acceptanceCount: v.acceptedBy.length, createdBy: "" }));

  const [selectedVersion, setSelectedVersion] = useState(termsVersions.length - 1);
  const [showChanges, setShowChanges] = useState(false);
  const ver = termsVersions[Math.min(selectedVersion, termsVersions.length - 1)];
  const prevVer = selectedVersion > 0 ? termsVersions[selectedVersion - 1] : null;

  const statusLabel = ver.status === "accepted" ? "Согласовано" : ver.status === "draft" ? "Черновик" : "Ожидает";
  const statusColor = ver.status === "accepted"
    ? "bg-success/15 text-success border-success/30"
    : ver.status === "draft"
      ? "bg-muted text-muted-foreground border-muted-foreground/20"
      : "bg-warning/15 text-warning border-warning/30";

  const changedKeys = new Set<string>();
  if (prevVer) {
    for (const key of Object.keys(ver.fields)) {
      if ((ver.fields as any)[key] !== (prevVer.fields as any)[key]) changedKeys.add(key);
    }
  }

  const canAccept = (ver.status === "draft" || ver.status === "pending") && !ver.myAccepted;
  const hasAcceptedAndNoDraft = ver.status === "accepted" && selectedVersion === termsVersions.length - 1;

  // Determine if the latest version was created by the other party (needs response)
  const latestVer = termsVersions[termsVersions.length - 1];
  const otherPartyProposed = latestVer && latestVer.createdBy && latestVer.createdBy !== user?.id;
  const iWaitingForResponse = isNeedsChanges && otherPartyProposed;
  const otherPartyLabel = isAdvertiser ? "Автор" : "Рекламодатель";

  // Counter-offer state (for both parties)
  const [showCounterForm, setShowCounterForm] = useState(false);
  const [counterBudget, setCounterBudget] = useState("");
  const [counterDeadline, setCounterDeadline] = useState("");
  const [counterRevisions, setCounterRevisions] = useState("");
  const [counterAcceptance, setCounterAcceptance] = useState("");
  const [counterMessage, setCounterMessage] = useState("");
  const [submittingCounter, setSubmittingCounter] = useState(false);

  const [acceptingCounter, setAcceptingCounter] = useState(false);
  const [rejectingCounter, setRejectingCounter] = useState(false);

  const handleAccept = () => {
    if (ver.id) {
      acceptTerms.mutate({ termsId: ver.id, dealId, version: ver.version });
    } else {
      toast.success("Условия подтверждены (демо)");
    }
  };

  const handleAcceptCounterOffer = async () => {
    if (!user || !ver.id) return;
    setAcceptingCounter(true);
    try {
      await supabase.from("deal_terms_acceptance").insert({ terms_id: ver.id, user_id: user.id });
      await supabase.from("deal_terms").update({ status: "accepted" }).eq("id", ver.id);
      await supabase.from("deals").update({ status: "in_progress" }).eq("id", dealId);
      const myRole = isAdvertiser ? "Рекламодатель" : "Автор";
      await supabase.from("deal_audit_log").insert({ deal_id: dealId, user_id: user.id, action: `${myRole} принял условия v${ver.version}`, category: "terms" });
      const notifyUserId = isAdvertiser ? deal?.creator_id : deal?.advertiser_id;
      if (notifyUserId) {
        await supabase.from("notifications").insert({ user_id: notifyUserId, title: "Условия приняты", message: `${myRole} принял условия v${ver.version}`, type: "deal", link: "/ad-studio" });
      }
      toast.success("Условия приняты, сделка переведена в работу");
    } catch { toast.error("Ошибка"); } finally { setAcceptingCounter(false); }
  };

  const handleRejectCounterOffer = async () => {
    if (!user) return;
    setRejectingCounter(true);
    try {
      await supabase.from("deals").update({ status: "rejected" }).eq("id", dealId);
      const myRole = isAdvertiser ? "Рекламодатель" : "Автор";
      await supabase.from("deal_audit_log").insert({ deal_id: dealId, user_id: user.id, action: `${myRole} отклонил условия v${ver.version}`, category: "terms" });
      const notifyUserId = isAdvertiser ? deal?.creator_id : deal?.advertiser_id;
      if (notifyUserId) {
        await supabase.from("notifications").insert({ user_id: notifyUserId, title: "Условия отклонены", message: `${myRole} отклонил условия v${ver.version}`, type: "deal" });
      }
      toast.success("Предложение отклонено");
    } catch { toast.error("Ошибка"); } finally { setRejectingCounter(false); }
  };

  const handleSubmitCounterOffer = async () => {
    if (!user || !counterMessage.trim()) return;
    setSubmittingCounter(true);
    try {
      const currentVersion = latestVer ? latestVer.version : 0;
      const baseFields = latestVer?.fields || {};
      const newFields = {
        ...baseFields,
        ...(counterBudget ? { budget: counterBudget } : {}),
        ...(counterDeadline ? { deadline: counterDeadline } : {}),
        ...(counterRevisions ? { revisions: counterRevisions } : {}),
        ...(counterAcceptance ? { acceptanceCriteria: counterAcceptance } : {}),
        counterMessage,
      };

      await supabase.from("deal_terms").insert({
        deal_id: dealId,
        created_by: user.id,
        version: currentVersion + 1,
        status: "draft",
        fields: newFields,
      });

      await supabase.from("deals").update({ status: "needs_changes" }).eq("id", dealId);

      const myRole = isAdvertiser ? "Рекламодатель" : "Автор";
      await supabase.from("deal_audit_log").insert({
        deal_id: dealId,
        user_id: user.id,
        action: `${myRole} предложил изменения (v${currentVersion + 1})`,
        category: "terms",
        metadata: { counterBudget, counterDeadline },
      });

      const notifyUserId = isAdvertiser ? deal?.creator_id : deal?.advertiser_id;
      if (notifyUserId) {
        await supabase.from("notifications").insert({
          user_id: notifyUserId,
          title: "Предложены изменения",
          message: `${myRole} предложил изменения к условиям (v${currentVersion + 1})`,
          type: "deal",
          link: "/ad-studio",
        });
      }

      toast.success("Контр-предложение отправлено");
      setShowCounterForm(false);
      setCounterBudget(""); setCounterDeadline(""); setCounterRevisions(""); setCounterAcceptance(""); setCounterMessage("");
    } catch (err) {
      console.error(err);
      toast.error("Ошибка при отправке");
    } finally { setSubmittingCounter(false); }
  };

  const openCounterPrefilled = () => {
    const f = latestVer?.fields || {};
    setCounterBudget((f as any).budget || "");
    setCounterDeadline((f as any).deadline || "");
    setCounterRevisions((f as any).revisions || "");
    setCounterAcceptance((f as any).acceptanceCriteria || "");
    setCounterMessage("");
    setShowCounterForm(true);
  };

  return (
    <div className="p-5 space-y-4 max-w-[820px] mx-auto">
      {/* Counter-offer banner — shown when the OTHER party proposed changes */}
      {isNeedsChanges && iWaitingForResponse && (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <span className="text-[14px] font-semibold text-foreground">
              {otherPartyLabel} предложил изменения (v{latestVer.version})
            </span>
          </div>
          {(latestVer.fields as any)?.counterMessage && (
            <p className="text-[14px] text-foreground/80 bg-background/50 rounded-md px-3 py-2">
              «{(latestVer.fields as any).counterMessage}»
            </p>
          )}
          <div className="flex items-center gap-3 text-[14px]">
            {(latestVer.fields as any)?.budget && (
              <span className="text-muted-foreground">Бюджет: <span className="font-semibold text-foreground">{Number((latestVer.fields as any).budget).toLocaleString()} ₽</span></span>
            )}
            {(latestVer.fields as any)?.deadline && (
              <span className="text-muted-foreground">Дедлайн: <span className="font-medium text-foreground">{(latestVer.fields as any).deadline}</span></span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" className="text-[14px] h-9" onClick={handleAcceptCounterOffer} disabled={acceptingCounter}>
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              {acceptingCounter ? "Принятие…" : `Принять v${latestVer.version}`}
            </Button>
            <Button size="sm" variant="outline" className="text-[14px] h-9" onClick={openCounterPrefilled}>
              <ArrowLeftRight className="h-4 w-4 mr-1.5" />
              Предложить свои изменения (v{latestVer.version + 1})
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={handleRejectCounterOffer}
                  disabled={rejectingCounter}
                >
                  {rejectingCounter ? "Отклонение…" : "Отклонить предложение"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      {/* Counter-offer form — structured */}
      {showCounterForm && (
        <div className="bg-muted/20 border border-border rounded-xl p-4 space-y-3">
          <h3 className="text-[14px] font-semibold text-foreground flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-primary" />
            Встречное предложение (v{(latestVer?.version || 0) + 1})
          </h3>

          {/* Current terms summary */}
          <div className="rounded-lg bg-background border border-border px-3 py-2 space-y-1">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Текущие условия</p>
            <div className="flex items-center gap-4 text-[13px] flex-wrap">
              {(ver.fields as any).budget && (
                <span className="text-foreground/80">Бюджет: <span className="font-semibold text-foreground">{Number((ver.fields as any).budget).toLocaleString()} ₽</span></span>
              )}
              {ver.fields.deadline && (
                <span className="text-foreground/80">Дедлайн: <span className="font-semibold text-foreground">{ver.fields.deadline}</span></span>
              )}
              {(ver.fields as any).placementType && (
                <span className="text-foreground/80">Тип: <span className="font-semibold text-foreground">{(ver.fields as any).placementType}</span></span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[12px] font-medium text-muted-foreground">
                Новый бюджет (₽)
                {counterBudget && (ver.fields as any).budget && counterBudget !== (ver.fields as any).budget && (
                  <span className="ml-1 text-primary">{Number((ver.fields as any).budget).toLocaleString()} → {Number(counterBudget).toLocaleString()}</span>
                )}
              </label>
              <Input type="number" value={counterBudget} onChange={(e) => setCounterBudget(e.target.value)} placeholder="Оставить текущий" className="h-9 text-[13px]" />
            </div>
            <div className="space-y-1">
              <label className="text-[12px] font-medium text-muted-foreground">
                Новый дедлайн
                {counterDeadline && ver.fields.deadline && counterDeadline !== ver.fields.deadline && (
                  <span className="ml-1 text-primary">→ {new Date(counterDeadline).toLocaleDateString("ru-RU")}</span>
                )}
              </label>
              <Input type="date" value={counterDeadline} onChange={(e) => setCounterDeadline(e.target.value)} className="h-9 text-[13px]" />
            </div>
            <div className="space-y-1">
              <label className="text-[12px] font-medium text-muted-foreground">Кол-во правок</label>
              <Input value={counterRevisions} onChange={(e) => setCounterRevisions(e.target.value)} placeholder="напр. 2 правки" className="h-9 text-[13px]" />
            </div>
            <div className="space-y-1">
              <label className="text-[12px] font-medium text-muted-foreground">Критерии приёмки</label>
              <Input value={counterAcceptance} onChange={(e) => setCounterAcceptance(e.target.value)} placeholder="Оставить текущий" className="h-9 text-[13px]" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[12px] font-medium text-muted-foreground">Почему предлагаете изменения? <span className="text-destructive">*</span></label>
            <Textarea value={counterMessage} onChange={(e) => setCounterMessage(e.target.value)} placeholder="Например: скорректировал бюджет с учётом охвата и сроков…" rows={2} className="text-[13px]" />
          </div>
          <div className="flex items-center gap-2 justify-end">
            <Button variant="ghost" size="sm" className="h-8 text-[13px]" onClick={() => setShowCounterForm(false)}>Отмена</Button>
            <Button size="sm" className="h-9 text-[13px] gap-1.5" disabled={!counterMessage.trim() || submittingCounter} onClick={handleSubmitCounterOffer}>
              {submittingCounter ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Отправить встречное
            </Button>
          </div>
        </div>
      )}

      {/* Version selector — compact */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-[14px] text-muted-foreground">Версия:</span>
          <Select
            value={String(selectedVersion)}
            onValueChange={(v) => { setSelectedVersion(Number(v)); setShowChanges(false); }}
          >
            <SelectTrigger className="h-8 w-20 text-[14px] bg-background border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {termsVersions.map((v, i) => (
                <SelectItem key={v.version} value={String(i)}>v{v.version}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className={cn("text-[12px] font-medium px-2 py-0.5 rounded border", statusColor)}>
            {statusLabel}
          </span>
          {ver.createdBy && (
            <span className="text-[11px] text-muted-foreground">
              от {ver.createdBy === deal?.advertiser_id ? "рекламодателя" : "автора"}
            </span>
          )}
        </div>
        {prevVer && changedKeys.size > 0 && (
          <button
            onClick={() => setShowChanges(!showChanges)}
            className={cn(
              "text-[13px] font-medium transition-colors",
              showChanges ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {showChanges ? "Все поля" : `Показать изменения (${changedKeys.size})`}
          </button>
        )}
      </div>

      {/* Acceptance status */}
      {ver.acceptedBy.length > 0 && (
        <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
          Подтвердили ({ver.acceptanceCount}/2): {ver.acceptedBy.join(", ")} · {ver.date}
        </div>
      )}
      {ver.myAccepted && ver.status !== "accepted" && (
        <div className="text-[13px] text-muted-foreground flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          Вы подтвердили. Ожидаем подтверждение второй стороны.
        </div>
      )}

      {/* Accordion sections — only first expanded by default */}
      <Accordion type="multiple" defaultValue={["s0"]}>
        {termsSections.map((section, si) => {
          const visibleFields = showChanges
            ? section.fields.filter((f) => changedKeys.has(f.key))
            : section.fields;
          if (showChanges && visibleFields.length === 0) return null;

          return (
            <AccordionItem key={si} value={`s${si}`} className="border-border/50">
              <AccordionTrigger className="py-2.5 px-1 text-[15px] font-semibold text-card-foreground hover:no-underline">
                {section.title}
              </AccordionTrigger>
              <AccordionContent className="pb-3 px-1">
                <div className="space-y-0">
                  {visibleFields.map((field, fi) => {
                    const value = (ver.fields as any)[field.key] || "—";
                    const prevValue = prevVer ? (prevVer.fields as any)[field.key] || "—" : null;
                    const changed = changedKeys.has(field.key);
                    return (
                      <div
                        key={field.key}
                        className={cn(
                          "flex items-start justify-between py-2",
                          fi > 0 && "border-t border-border/30",
                          changed && showChanges && "bg-primary/5 -mx-1 px-1 rounded"
                        )}
                      >
                        <span className="text-[14px] text-muted-foreground w-36 shrink-0">{field.label}</span>
                        <div className="text-right flex-1">
                          {changed && showChanges && prevValue ? (
                            <>
                              <span className="text-[13px] line-through text-destructive/60">{prevValue}</span>
                              <span className="text-[13px] mx-1.5 text-muted-foreground">→</span>
                              <span className="text-[15px] font-medium text-success">{value}</span>
                            </>
                          ) : (
                            <span className="text-[15px] font-medium text-card-foreground">{value}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {/* Action buttons — only when NOT in needs_changes banner mode */}
      {!isNeedsChanges && !showCounterForm && (
        <div className="flex items-center gap-2 pt-1">
          {canAccept && (
            <Button size="sm" className="text-[14px] h-9" onClick={handleAccept} disabled={acceptTerms.isPending}>
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              {acceptTerms.isPending ? "Подтверждение…" : "Подтвердить условия"}
            </Button>
          )}
          <Button size="sm" variant="outline" className="text-[14px] h-9" onClick={openCounterPrefilled}>
            Предложить изменения{hasAcceptedAndNoDraft ? ` (v${ver.version + 1})` : ""}
          </Button>
        </div>
      )}
    </div>
  );
}
/* ═══════════════════════════════════════════════════════
   FILES TAB — deduplicated, one row per file
   ═══════════════════════════════════════════════════════ */

function FilesTab({ dealId }: { dealId: string }) {
  const { data: dbFiles = [], isLoading } = useDealFiles(dealId);
  const uploadFile = useUploadDealFile();
  const downloadFile = useDownloadDealFile();
  const togglePin = useTogglePinFile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadCategory, setUploadCategory] = useState("draft");

  const displayFiles = dbFiles.length > 0
    ? dbFiles.map((f) => ({
        id: f.id, name: f.file_name, type: f.category as string,
        uploader: "Вы", date: new Date(f.created_at).toLocaleDateString("ru-RU"),
        pinned: f.pinned ?? false, storagePath: f.storage_path,
        sizeMeta: `${(f.file_type || "").split("/").pop()?.toUpperCase() || "—"} · ${((f.file_size || 0) / 1024).toFixed(0)} KB`,
      }))
    : mockFiles.map((f) => ({ ...f, storagePath: "", sizeMeta: fileSizeMock[f.id] || "—" }));

  // Deduplicate by file name — keep latest (last in array)
  const deduped = useMemo(() => {
    const seen = new Map<string, typeof displayFiles[0]>();
    for (const f of displayFiles) {
      seen.set(f.name, f);
    }
    return Array.from(seen.values());
  }, [displayFiles]);

  const pinnedFiles = deduped.filter((f) => f.pinned);
  const unpinnedFiles = deduped.filter((f) => !f.pinned);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadFile.mutate({ dealId, file, category: uploadCategory });
    e.target.value = "";
  };

  const handleTogglePin = (file: typeof deduped[0]) => {
    if (!file.storagePath) return; // mock files can't be pinned
    togglePin.mutate({ fileId: file.id, dealId, pinned: !file.pinned, fileName: file.name });
  };

  const renderFileRow = (file: typeof deduped[0]) => (
    <div
      key={file.id}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors hover:bg-muted/30",
        file.pinned && "bg-primary/5 border border-primary/20"
      )}
    >
      <div className="flex-1 min-w-0">
        <span className="text-[15px] font-medium text-card-foreground truncate block safe-text">
          {file.storagePath ? (
            <button
              onClick={() => downloadFile.mutate(file.storagePath)}
              className="hover:underline text-left"
            >
              {file.name}
            </button>
          ) : (
            file.name
          )}
        </span>
        <span className="text-[13px] text-muted-foreground">
          {fileTypeLabels[file.type] || file.type} · {file.sizeMeta} · {file.uploader} · {file.date}
        </span>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => handleTogglePin(file)}
            aria-label={file.pinned ? "Открепить" : "Закрепить"}
            className={cn(
              "shrink-0 p-1 rounded transition-colors",
              file.pinned
                ? "text-primary hover:text-primary/70"
                : "text-muted-foreground/40 hover:text-foreground"
            )}
            disabled={!file.storagePath}
          >
            <Pin className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-[12px]">{file.pinned ? "Открепить" : "Закрепить"}</TooltipContent>
      </Tooltip>
      <button
        onClick={() => file.storagePath && downloadFile.mutate(file.storagePath)}
        title="Скачать"
        className={cn(
          "shrink-0 transition-colors",
          file.storagePath ? "text-muted-foreground hover:text-foreground" : "text-muted-foreground/30"
        )}
        disabled={!file.storagePath}
      >
        <Download className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <div className="p-5 space-y-4 max-w-[820px] mx-auto">
      <div className="flex items-center justify-between">
        <p className="text-[15px] font-semibold text-card-foreground">Файлы сделки</p>
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
            <Upload className="h-4 w-4 mr-1.5" />
            {uploadFile.isPending ? "Загрузка…" : "Загрузить"}
          </Button>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-[14px] text-muted-foreground">Загрузка…</div>
      ) : deduped.length === 0 ? (
        <div className="text-center py-12 text-[14px] text-muted-foreground">Нет файлов</div>
      ) : (
        <div className="space-y-4">
          {pinnedFiles.length > 0 && (
            <div>
              <p className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Pin className="h-3.5 w-3.5" /> Закреплённые
              </p>
              <div className="space-y-1">{pinnedFiles.map(renderFileRow)}</div>
            </div>
          )}
          <div>
            {pinnedFiles.length > 0 && (
              <p className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Все файлы</p>
            )}
            <div className="space-y-1">{unpinnedFiles.map(renderFileRow)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   PAYMENT TAB — with escrow payout flow
   ═══════════════════════════════════════════════════════ */
function PaymentTab({ dealId }: { dealId: string }) {
  const { user } = useAuth();
  const { data: escrowItems = [] } = useDealEscrow(dealId);
  const releaseEscrow = useReleaseEscrow();
  const { data: invoices = [] } = useDealInvoices(dealId);
  const payInvoice = usePayInvoice();
  const latestInvoice = invoices.length > 0 ? invoices[0] : null;

  // Fetch deal for role check and placement fields
  const { data: deal } = useQuery({
    queryKey: ["deal_detail_payment", dealId],
    queryFn: async () => {
      const { data } = await supabase.from("deals").select("*").eq("id", dealId).single();
      return data;
    },
    enabled: !!dealId,
  });

  const isAdvertiser = deal?.advertiser_id === user?.id;
  const isCreator = deal?.creator_id === user?.id;

  // Find escrow items with escrow_state (new payout flow)
  const payoutEscrow = escrowItems.find((e: any) => e.escrow_state && e.escrow_state !== "WAITING_INVOICE");

  const milestones = escrowItems.length > 0
    ? escrowItems.map((e: any) => ({ id: e.id, label: e.label, amount: e.amount, status: e.status as string }))
    : mockPayment.milestones;

  const total = milestones.reduce((s: number, m: any) => s + m.amount, 0);
  const released = milestones.filter((m: any) => m.status === "released").reduce((s: number, m: any) => s + m.amount, 0);
  const reserved = milestones.filter((m: any) => m.status === "reserved").reduce((s: number, m: any) => s + m.amount, 0);
  const remaining = total - released;
  const commission = Math.round(total * 0.1);

  return (
    <div className="p-5 space-y-4 max-w-[820px] mx-auto">
      {/* Escrow payout section — new flow */}
      {payoutEscrow && deal && (
        <EscrowPayoutSection
          escrowItem={payoutEscrow}
          deal={deal}
          isCreator={isCreator}
          isAdvertiser={isAdvertiser}
        />
      )}

      {/* Invoice card — shown when invoice exists */}
      {latestInvoice && (
        <Card className={latestInvoice.status === "pending" ? "border-warning/30" : ""}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-[15px] font-semibold text-card-foreground">Счёт {latestInvoice.invoice_number}</span>
              </div>
              <Badge variant="outline" className={cn("text-[11px]",
                latestInvoice.status === "paid"
                  ? "bg-success/15 text-success border-success/30"
                  : "bg-warning/15 text-warning border-warning/30"
              )}>
                {latestInvoice.status === "paid" ? "Оплачено" : "Ожидает оплаты"}
              </Badge>
            </div>
            <div className="space-y-1.5 text-[14px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Сумма</span>
                <span className="font-bold text-card-foreground">{Number(latestInvoice.amount).toLocaleString("ru-RU")} ₽</span>
              </div>
              {latestInvoice.due_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Срок оплаты</span>
                  <span className="text-card-foreground">{new Date(latestInvoice.due_date).toLocaleDateString("ru-RU")}</span>
                </div>
              )}
              {latestInvoice.comment && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Комментарий</span>
                  <span className="text-card-foreground/80 text-right max-w-[60%]">{latestInvoice.comment}</span>
                </div>
              )}
              {latestInvoice.paid_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Оплачен</span>
                  <span className="text-success font-medium">{new Date(latestInvoice.paid_at).toLocaleDateString("ru-RU")}</span>
                </div>
              )}
            </div>
            {latestInvoice.status === "pending" && !payoutEscrow && (
              <Button className="w-full text-[14px] h-10 mt-1" onClick={() => payInvoice.mutate({ invoiceId: latestInvoice.id, dealId })} disabled={payInvoice.isPending}>
                {payInvoice.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <CreditCard className="h-4 w-4 mr-1.5" />}
                Зарезервировать средства
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Escrow summary */}
      {total > 0 && !payoutEscrow && (
        <>
          <div className="flex items-center gap-3 flex-wrap text-[15px]">
            <span className="text-muted-foreground">Итого: <span className="font-semibold text-card-foreground">{total.toLocaleString()} ₽</span></span>
            <span className="text-border">·</span>
            <span className="text-muted-foreground">Резерв: <span className="font-semibold text-card-foreground">{reserved.toLocaleString()} ₽</span></span>
            <span className="text-border">·</span>
            <span className="text-muted-foreground">Выплачено: <span className="font-semibold text-success">{released.toLocaleString()} ₽</span></span>
            <span className="text-border">·</span>
            <span className="text-muted-foreground">Остаток: <span className="font-semibold text-card-foreground">{remaining.toLocaleString()} ₽</span></span>
          </div>

          <Card>
            <CardContent className="p-4 space-y-0">
              <p className="text-[15px] font-semibold text-card-foreground mb-2">Этапы оплаты</p>
              {milestones.map((ms: any, i: number) => (
                <div key={ms.id} className={cn("flex items-center justify-between py-2", i > 0 && "border-t border-border/50")}>
                  <div className="flex items-center gap-2.5">
                    <span className={cn("text-[12px] font-medium px-1.5 py-0.5 rounded", paymentStatusColors[ms.status] || "bg-muted text-muted-foreground")}>
                      {paymentStatusLabels[ms.status] || ms.status}
                    </span>
                    <span className="text-[15px] text-card-foreground">{ms.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-medium text-card-foreground">{ms.amount.toLocaleString()} ₽</span>
                    {ms.status === "reserved" && escrowItems.length > 0 && (
                      <Button size="sm" variant="outline" className="text-[12px] h-7 px-2" onClick={() => releaseEscrow.mutate({ escrowId: ms.id, dealId })} disabled={releaseEscrow.isPending}>
                        Выплатить
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 mt-1 border-t border-border/30">
                <span className="text-[13px] text-muted-foreground/60">Комиссия платформы (10%)</span>
                <span className="text-[13px] text-muted-foreground/60">{commission.toLocaleString()} ₽</span>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!latestInvoice && total === 0 && (
        <div className="text-center py-12 space-y-2">
          <CreditCard className="h-8 w-8 mx-auto text-muted-foreground/40" />
          <p className="text-[14px] text-muted-foreground">Ожидайте счёт от автора</p>
          <p className="text-[13px] text-muted-foreground/60">После принятия предложения автор выставит счёт</p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MORE TAB — both accordions collapsed by default, audit limited to 5
   ═══════════════════════════════════════════════════════ */
function MoreTab({ dealId }: { dealId: string }) {
  const { data: dbAudit = [] } = useDealAuditLog(dealId);
  const [showFullAudit, setShowFullAudit] = useState(false);
  const erid = "2SDnjek4fP1";
  const ordStatus: "ok" | "error" = "ok";

  const allAudit = dbAudit.length > 0
    ? dbAudit.map((e: any) => ({
        id: e.id, ts: new Date(e.created_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }),
        who: "Участник", action: e.action, category: e.category, file: (e.metadata as any)?.file_name,
      }))
    : mockAudit;

  const displayAudit = showFullAudit ? allAudit : allAudit.slice(0, 5);
  const categoryIcons: Record<string, any> = { terms: ScrollText, files: Files, payments: CreditCard, ord: Radio };

  return (
    <div className="p-5 space-y-0 max-w-[820px] mx-auto">
      {/* Both collapsed by default — defaultValue is empty */}
      <Accordion type="multiple" defaultValue={[]}>
        <AccordionItem value="ord" className="border-border/50">
          <AccordionTrigger className="py-3 text-[15px] font-semibold text-card-foreground hover:no-underline">
            Маркировка (ОРД)
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-[15px]">
                <span className="text-muted-foreground">Статус</span>
                {ordStatus === "ok" ? (
                  <span className="flex items-center gap-1.5 text-success font-medium text-[14px]">
                    <CheckCircle2 className="h-4 w-4" /> Активно
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-destructive font-medium text-[14px]">
                    <AlertTriangle className="h-4 w-4" /> Ошибка
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between text-[15px]">
                <span className="text-muted-foreground">ERID</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-semibold text-primary text-[14px]">{erid}</span>
                  <button onClick={() => { navigator.clipboard.writeText(erid); toast.success("ERID скопирован"); }}>
                    <ClipboardCopy className="h-3.5 w-3.5 text-primary" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between text-[15px]">
                <span className="text-muted-foreground">Последняя синхронизация</span>
                <span className="text-[14px] text-card-foreground">19.02.2026, 14:33</span>
              </div>
              {(ordStatus as string) === "error" && (
                <Button variant="outline" size="sm" className="text-[14px] h-8 mt-1">
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Повторить синхронизацию
                </Button>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="audit" className="border-border/50">
          <AccordionTrigger className="py-3 text-[15px] font-semibold text-card-foreground hover:no-underline">
            Журнал действий
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="space-y-0">
              {displayAudit.map((entry: any, i: number) => {
                const Icon = categoryIcons[entry.category] || ScrollText;
                return (
                  <div key={entry.id} className={cn("flex items-start gap-2.5 py-2", i > 0 && "border-t border-border/30")}>
                    <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] text-card-foreground">{entry.action}</p>
                      <span className="text-[13px] text-muted-foreground">{entry.who} · {entry.ts}</span>
                      {entry.file && (
                        <a href="#" className="block text-[13px] text-primary underline hover:no-underline mt-0.5">{entry.file}</a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {!showFullAudit && allAudit.length > 5 && (
              <button
                onClick={() => setShowFullAudit(true)}
                className="text-[13px] text-primary hover:underline mt-2 flex items-center gap-1"
              >
                Показать все ({allAudit.length}) <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN DEAL WORKSPACE
   ═══════════════════════════════════════════════════════ */
export function DealWorkspace() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { isCreator: isCreatorRole } = useUserRole();
  const location = useLocation();

  // Fetch real deals from DB
  const { data: dbDeals = [] } = useQuery({
    queryKey: ["my_deals", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("deals")
        .select("*")
        .or(`advertiser_id.eq.${user.id},creator_id.eq.${user.id}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Merge DB deals with mock deals, DB takes priority
  const allDeals: Deal[] = useMemo(() => {
    const dbMapped: Deal[] = dbDeals.map((d: any) => ({
      id: d.id,
      advertiserId: d.advertiser_id || "",
      advertiserName: d.advertiser_name || "",
      creatorId: d.creator_id || "",
      creatorName: d.creator_name || "",
      title: d.title,
      description: d.description || "",
      budget: d.budget || 0,
      status: d.status as DealStatus,
      createdAt: d.created_at,
      deadline: d.deadline || "",
      milestones: [],
      rejection_reason: d.rejection_reason || null,
      rejected_at: d.rejected_at || null,
      marking_required: d.marking_required || false,
    }));
    const dbIds = new Set(dbMapped.map((d) => d.id));
    const mock = mockDeals.filter((d) => !dbIds.has(d.id));
    return [...dbMapped, ...mock];
  }, [dbDeals]);

  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);

  // Auto-select deal from navigation state
  useEffect(() => {
    const state = (location.state as { openDealId?: string }) || {};
    if (state.openDealId && allDeals.length > 0) {
      const target = allDeals.find((d) => d.id === state.openDealId);
      if (target) {
        setSelectedDeal(target);
        // Clear state to avoid re-selecting on re-renders
        window.history.replaceState({}, "");
      }
    }
  }, [location.state, allDeals]);

  const activeDeal = selectedDeal;

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeSubTab, setActiveSubTab] = useState("chat");
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Realtime subscriptions for audit log and escrow
  useRealtimeAuditLog(activeDeal?.id);
  useRealtimeEscrow(activeDeal?.id);

  // Realtime: re-fetch deals list when any deal status changes
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`adv-deals-${user.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "deals" }, (payload) => {
        if (payload.new && ((payload.new as any).advertiser_id === user.id || (payload.new as any).creator_id === user.id)) {
          qc.invalidateQueries({ queryKey: ["my_deals", user.id] });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, qc]);

  // Fetch latest terms for counter-offer banner
  const { data: latestTermsForBanner } = useDealTerms(activeDeal?.id || "");
  const latestTermVersion = useMemo(() => {
    if (!latestTermsForBanner || latestTermsForBanner.length === 0) return null;
    const sorted = [...latestTermsForBanner].sort((a: any, b: any) => a.version - b.version);
    return sorted[sorted.length - 1] as any;
  }, [latestTermsForBanner]);

  const isCounterFromCreator = activeDeal &&
    (activeDeal.status as string) === "needs_changes" &&
    latestTermVersion &&
    latestTermVersion.created_by === activeDeal.creatorId &&
    activeDeal.advertiserId === user?.id;

  // Stats for empty state
  const dealStats = useMemo(() => {
    const stats: Record<string, number> = {};
    allDeals.forEach((d) => {
      const label = statusLabels[d.status] || d.status;
      stats[label] = (stats[label] || 0) + 1;
    });
    return stats;
  }, [allDeals]);

  const navigate = useNavigate();

  const showMarkingTab = activeDeal && (activeDeal as any).marking_required === true;

  const coreTabs = activeDeal ? [
    { value: "chat", label: "Чат", icon: MessageCircle },
    { value: "terms", label: "Условия", icon: ScrollText },
    { value: "files", label: "Файлы", icon: Files },
    { value: "payment", label: "Оплата", icon: CreditCard },
    ...(showMarkingTab ? [{ value: "marking", label: "Маркировка", icon: Radio }] : []),
  ] : [];

  // Escrow state for header CTA
  const { data: headerEscrowItems = [] } = useDealEscrow(activeDeal?.id || "");
  const headerEscrowState = useMemo(() => {
    const item = headerEscrowItems.find((e: any) => e.escrow_state);
    return item?.escrow_state as string | undefined;
  }, [headerEscrowItems]);

  const dealStatus = activeDeal?.status as string | undefined;
  const isProposal = dealStatus ? ["pending", "needs_changes", "accepted", "rejected"].includes(dealStatus) : false;
  const primaryAction = dealStatus ? getPrimaryAction(dealStatus, headerEscrowState) : null;
  const nextStepHint = dealStatus ? getNextStepHint(dealStatus) : null;
  const completedMs = activeDeal?.milestones.filter((m) => m.completed).length || 0;
  const totalMs = activeDeal?.milestones.length || 0;
  const isMoreTab = activeSubTab === "more";

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      <DealSidebar
        selectedId={activeDeal?.id || ""}
        onSelect={(d) => {
          setSelectedDeal(d);
          const isProp = ["pending", "needs_changes", "accepted", "rejected"].includes(d.status as string);
          setActiveSubTab(isProp && (d.status as string) === "needs_changes" ? "terms" : "chat");
          setDetailsOpen(false);
        }}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        allDeals={allDeals}
      />

      {/* Main workspace — empty state or deal view */}
      {!activeDeal ? (
        <div className="flex-1 flex flex-col items-center justify-center min-w-0 bg-background/50">
          {allDeals.length === 0 ? (
            /* No deals at all */
            <div className="text-center space-y-4 max-w-md px-6">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center">
                <Megaphone className="h-7 w-7 text-muted-foreground" />
              </div>
              <h2 className="text-[18px] font-semibold text-foreground">У вас пока нет сделок</h2>
              <p className="text-[14px] text-muted-foreground leading-relaxed">
                Найдите авторов на бирже и отправьте предложение о сотрудничестве
              </p>
               <div className="flex gap-2 justify-center pt-2">
                <Button onClick={() => navigate(isCreatorRole ? "/ad-studio" : "/marketplace")} className="text-[14px]">
                  <Search className="h-4 w-4 mr-1.5" />
                  {isCreatorRole ? "Ожидайте предложений" : "Найти авторов"}
                </Button>
              </div>
            </div>
          ) : (
            /* Has deals, but none selected */
            <div className="text-center space-y-5 max-w-md px-6">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center">
                <ArrowLeftRight className="h-7 w-7 text-muted-foreground" />
              </div>
              <h2 className="text-[18px] font-semibold text-foreground">Выберите сделку слева</h2>
              <p className="text-[14px] text-muted-foreground">
                Выберите сделку из списка, чтобы увидеть детали
              </p>
              {/* Deal stats */}
              <div className="flex flex-wrap gap-2 justify-center pt-1">
                {Object.entries(dealStats).map(([label, count]) => (
                  <span key={label} className="text-[12px] px-2.5 py-1 rounded-md bg-muted/60 text-muted-foreground">
                    {label}: <span className="font-semibold text-foreground">{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
      /* Active deal workspace */
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* ── Header: centered container, single source of truth ── */}
        <div className="border-b border-border bg-card">
          <div className="max-w-[1100px] mx-auto px-6 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <h1 className="text-[18px] font-bold text-card-foreground truncate">{activeDeal.title}</h1>
                <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded border shrink-0", statusColors[activeDeal.status as DealStatus] || "bg-muted text-muted-foreground border-muted-foreground/20")}>
                  {statusLabels[activeDeal.status] || activeDeal.status}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {primaryAction ? (
                  primaryAction.disabled ? (
                    <Badge variant="outline" className="text-[13px] py-1 px-2.5 border-muted-foreground/20 text-muted-foreground">
                      <primaryAction.icon className="h-3.5 w-3.5 mr-1" />
                      {primaryAction.label}
                    </Badge>
                  ) : (
                    <Button size="sm" className="text-[14px] h-9" onClick={() => {
                      if ((activeDeal.status as string) === "needs_changes") setActiveSubTab("terms");
                      if ((activeDeal.status as string) === "accepted" || (activeDeal.status as string) === "waiting_payment") setActiveSubTab("payment");
                    }}>
                      <primaryAction.icon className="h-4 w-4 mr-1.5" />
                      {primaryAction.label}
                    </Button>
                  )
                ) : isProposal ? (
                  <Badge variant="outline" className="text-[13px] py-1 px-2.5 border-warning/30 text-warning">
                    <Clock className="h-3.5 w-3.5 mr-1" />
                    {(activeDeal.status as string) === "rejected" ? "Отклонено" : "Ожидание автора"}
                  </Badge>
                ) : null}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem className="text-[14px]"><Download className="h-4 w-4 mr-2" /> Экспорт</DropdownMenuItem>
                    <DropdownMenuItem className="text-[14px]"><Copy className="h-4 w-4 mr-2" /> Дублировать</DropdownMenuItem>
                    <DropdownMenuItem className="text-[14px]"><Archive className="h-4 w-4 mr-2" /> Архивировать</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive focus:text-destructive text-[14px]">
                      <AlertTriangle className="h-4 w-4 mr-2" /> Открыть спор
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Collapsed metadata line — single source of truth */}
            <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
              <CollapsibleTrigger className="flex items-center gap-1.5 mt-1 text-[13px] text-muted-foreground hover:text-foreground transition-colors">
                {detailsOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                <span>Детали</span>
                {!detailsOpen && (
                  <span className="text-muted-foreground/60 ml-1">
                    — {activeDeal.creatorName} · {activeDeal.budget.toLocaleString()} ₽
                    {activeDeal.deadline && ` · до ${new Date(activeDeal.deadline).toLocaleDateString("ru-RU")}`}
                  </span>
                )}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[15px] pb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Сумма:</span>
                    <span className="font-semibold text-card-foreground">{activeDeal.budget.toLocaleString()} ₽</span>
                  </div>
                  {activeDeal.deadline && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Дедлайн:</span>
                      <span className="font-medium text-card-foreground flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {new Date(activeDeal.deadline).toLocaleDateString("ru-RU")}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Стороны:</span>
                    <span className="text-card-foreground">{activeDeal.advertiserName} → {activeDeal.creatorName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5 text-success" /> Безопасная сделка
                    </span>
                    {totalMs > 0 && (
                      <span className="text-muted-foreground ml-auto">Этап {completedMs}/{totalMs}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">ID:</span>
                    <button
                      className="flex items-center gap-1 hover:text-foreground transition-colors font-mono text-[12px] text-muted-foreground"
                      onClick={() => { navigator.clipboard.writeText(activeDeal.id); toast.success("ID скопирован"); }}
                    >
                      #{activeDeal.id.slice(0, 8)} <ClipboardCopy className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>

        {/* ── Tabs — centered under header ── */}
        <div className="border-b border-border bg-card">
          <div className="max-w-[1100px] mx-auto px-6">
            <div className="flex items-center gap-0">
              {coreTabs.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setActiveSubTab(tab.value)}
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 h-10 text-[15px] font-medium border-b-2 transition-colors",
                    activeSubTab === tab.value
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}

              <button
                onClick={() => setActiveSubTab("more")}
                className={cn(
                  "flex items-center gap-1 px-3.5 h-10 text-[15px] font-medium border-b-2 transition-colors",
                  isMoreTab
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                Ещё
              </button>
            </div>

            {/* Next step hint — single non-interactive line */}
            {nextStepHint && (
              <div className="pb-2 -mt-0.5">
                <p className="text-[13px] text-muted-foreground">
                  <span className="text-primary font-medium">→</span> {nextStepHint}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Counter-offer from creator — prominent banner (advertiser side) ── */}
        {isCounterFromCreator && latestTermVersion && (
          <div className="border-b border-warning/30 bg-warning/10">
            <div className="max-w-[1100px] mx-auto px-6 py-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <ArrowLeftRight className="h-5 w-5 text-warning shrink-0" />
                  <span className="text-[14px] font-semibold text-foreground">
                    Автор предложил встречные условия (v{latestTermVersion.version}). Посмотрите изменения и примите решение.
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" className="text-[14px] h-9" onClick={() => setActiveSubTab("terms")}>
                    <ScrollText className="h-4 w-4 mr-1.5" />
                    Смотреть изменения
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Invoice needed banner (advertiser waiting for creator invoice) ── */}
        {dealStatus === "invoice_needed" && (
          <div className="border-b border-primary/20 bg-primary/5">
            <div className="max-w-[1100px] mx-auto px-6 py-3 flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary shrink-0" />
              <span className="text-[14px] font-semibold text-foreground">
                Автор принял предложение. Ожидаем счёт на оплату.
              </span>
            </div>
          </div>
        )}

        {/* ── Rejected banner (author declined) ── */}
        {dealStatus === "rejected" && (
          <div className="border-b border-destructive/20 bg-destructive/5">
            <div className="max-w-[1100px] mx-auto px-6 py-3 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              <div>
                <span className="text-[14px] font-semibold text-foreground">
                  Автор отклонил предложение
                </span>
                {activeDeal.rejection_reason && (
                  <p className="text-[13px] text-muted-foreground mt-0.5">Причина: {activeDeal.rejection_reason}</p>
                )}
                {activeDeal.rejected_at && (
                  <p className="text-[12px] text-muted-foreground mt-0.5">
                    {new Date(activeDeal.rejected_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Tab content ── */}
        <div className="flex-1 overflow-y-auto">
          {activeSubTab === "chat" && <ChatTab deal={activeDeal} />}
          {activeSubTab === "terms" && <TermsTab dealId={activeDeal.id} />}
          {activeSubTab === "files" && <FilesTab dealId={activeDeal.id} />}
          {activeSubTab === "payment" && <PaymentTab dealId={activeDeal.id} />}
          {activeSubTab === "marking" && showMarkingTab && <MarkingTab dealId={activeDeal.id} />}
          {activeSubTab === "more" && <MoreTab dealId={activeDeal.id} />}
        </div>
      </div>
      )}
    </div>
  );
}
