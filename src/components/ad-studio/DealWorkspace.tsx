import { useState, useMemo } from "react";
import { deals, messages as allMessages } from "@/data/mockData";
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";
import { useAdvertiserScores } from "@/hooks/useAdvertiserScores";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search, Send, Paperclip, ArrowLeft, MoreVertical, Copy, ShieldCheck,
  CheckCircle2, AlertTriangle, Clock, FileText, Upload, Download,
  ExternalLink, Pin, RefreshCw, Filter, MessageCircle, ClipboardCopy,
  Archive, Files, CreditCard, Radio, ScrollText, CalendarDays, Star,
} from "lucide-react";
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
};

const statusLabels: Record<DealStatus, string> = {
  pending: "Ожидание",
  briefing: "Бриф",
  in_progress: "В работе",
  review: "На проверке",
  completed: "Завершено",
  disputed: "Спор",
};

const filterStatusMap: Record<string, DealStatus[]> = {
  all: ["pending", "briefing", "in_progress", "review", "completed", "disputed"],
  active: ["in_progress", "briefing"],
  pending: ["pending", "review"],
  disputed: ["disputed"],
  completed: ["completed"],
};

/* ─── Primary action per status ─── */
function getPrimaryAction(status: DealStatus): { label: string; icon: any } | null {
  switch (status) {
    case "pending": return { label: "Подтвердить условия", icon: CheckCircle2 };
    case "briefing": return { label: "Отправить на подтверждение", icon: Send };
    case "in_progress": return { label: "Отправить на проверку", icon: Upload };
    case "review": return { label: "Подтвердить выполнение", icon: CheckCircle2 };
    case "disputed": return { label: "Открыть спор", icon: AlertTriangle };
    default: return null;
  }
}

/* ─── Mock audit entries ─── */
const mockAudit = [
  { id: "a1", ts: "2024-12-01 10:00", who: "Мария Иванова", action: "Создала сделку", category: "terms" },
  { id: "a2", ts: "2024-12-01 10:05", who: "Мария Иванова", action: "Загрузила файл brief_v1.pdf", category: "files", file: "brief_v1.pdf" },
  { id: "a3", ts: "2024-12-02 09:00", who: "Алексей Петров", action: "Подтвердил условия v1", category: "terms" },
  { id: "a4", ts: "2024-12-05 14:00", who: "Система", action: "Средства зарезервированы (45 000 ₽)", category: "payments" },
  { id: "a5", ts: "2024-12-18 16:00", who: "Алексей Петров", action: "Загрузил draft_integration.mp4", category: "files", file: "draft_integration.mp4" },
  { id: "a6", ts: "2024-12-19 12:00", who: "Система", action: "ERID получен: 2SDnjek4fP1", category: "ord" },
];

/* ─── Mock files ─── */
const mockFiles = [
  { id: "f1", name: "brief_v1.pdf", type: "Brief" as const, uploader: "Мария Иванова", date: "2024-12-01", pinned: false },
  { id: "f2", name: "draft_integration.mp4", type: "Draft" as const, uploader: "Алексей Петров", date: "2024-12-18", pinned: false },
  { id: "f3", name: "final_cut.mp4", type: "Final" as const, uploader: "Алексей Петров", date: "2025-01-08", pinned: true },
  { id: "f4", name: "договор_оферты.pdf", type: "Legal" as const, uploader: "Система", date: "2024-12-01", pinned: false },
];

const fileTypeLabels = { Brief: "Бриф", Draft: "Черновик", Final: "Финальный", Legal: "Юридический" };
const fileTypeColors = { Brief: "bg-info/15 text-info", Draft: "bg-warning/15 text-warning", Final: "bg-success/15 text-success", Legal: "bg-muted text-muted-foreground" };

/* ─── Mock terms versions ─── */
const mockTermsVersions = [
  {
    version: 1, status: "accepted" as const, date: "2024-12-02",
    acceptedBy: ["Мария Иванова", "Алексей Петров"],
    fields: {
      deliverable: "60-секундная рекламная интеграция", platform: "YouTube", format: "Видео",
      price: "45 000 ₽", deadline: "15.01.2025", paymentMilestones: "50% аванс, 50% по завершении",
      acceptanceCriteria: "Финальное видео утверждено рекламодателем", eridResponsibility: "Платформа",
      cancellation: "Возврат 100% при отмене до начала работ",
    },
  },
  {
    version: 2, status: "draft" as const, date: "2025-01-05",
    acceptedBy: [],
    fields: {
      deliverable: "60-секундная рекламная интеграция + Stories", platform: "YouTube + Instagram", format: "Видео + Stories",
      price: "55 000 ₽", deadline: "20.01.2025", paymentMilestones: "50% аванс, 50% по завершении",
      acceptanceCriteria: "Финальное видео и Stories утверждены рекламодателем", eridResponsibility: "Платформа",
      cancellation: "Возврат 100% при отмене до начала работ",
    },
  },
];

/* ─── Mock payment state ─── */
const mockPayment = {
  total: 45000, reserved: 45000, released: 22500, commission: 4500, commissionPercent: 10,
  milestones: [
    { id: "pm1", label: "Аванс (50%)", amount: 22500, status: "released" as const },
    { id: "pm2", label: "По завершении (50%)", amount: 22500, status: "reserved" as const },
  ],
};

const paymentStatusLabels = { reserved: "Резерв", in_progress: "В работе", review: "На проверке", released: "Выплачено" };
const paymentStatusColors = { reserved: "bg-warning/15 text-warning", in_progress: "bg-primary/15 text-primary", review: "bg-accent/15 text-accent", released: "bg-success/15 text-success" };

/* ═══════════════════════════════════════════════════════════════
   SIDEBAR
   ═══════════════════════════════════════════════════════════════ */
function DealSidebar({
  selectedId, onSelect, searchQuery, setSearchQuery, statusFilter, setStatusFilter,
}: {
  selectedId: string;
  onSelect: (d: Deal) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
}) {
  const { scores } = useAdvertiserScores();

  const filtered = useMemo(() => {
    let list = [...deals];
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
  }, [searchQuery, statusFilter]);

  return (
    <div className="w-[340px] border-r border-border bg-card flex flex-col shrink-0 h-full">
      {/* Search */}
      <div className="p-3 space-y-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по сделкам..."
            className="pl-8 h-8 text-[13px] bg-background"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {[
            { key: "all", label: "Все" },
            { key: "active", label: "В работе" },
            { key: "pending", label: "Ожидание" },
            { key: "disputed", label: "Спор" },
            { key: "completed", label: "Завершено" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={cn(
                "px-2 py-0.5 rounded text-[11px] font-medium transition-colors",
                statusFilter === f.key
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Deal list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.map((deal) => {
          const completedMs = deal.milestones.filter((m) => m.completed).length;
          const totalMs = deal.milestones.length;
          const progressPct = totalMs > 0 ? (completedMs / totalMs) * 100 : 0;
          const isSelected = selectedId === deal.id;
          const advScore = scores.get(deal.advertiserId);

          return (
            <button
              key={deal.id}
              onClick={() => onSelect(deal)}
              className={cn(
                "w-full text-left px-3 py-2.5 border-b border-border transition-colors",
                isSelected ? "bg-primary/8 border-l-2 border-l-primary" : "hover:bg-muted/40"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-semibold text-card-foreground truncate">{deal.title}</span>
                    {advScore?.isLowScore && (
                      <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {deal.advertiserName} → {deal.creatorName}
                  </p>
                </div>
                <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-md border whitespace-nowrap", statusColors[deal.status])}>
                  {statusLabels[deal.status]}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1.5 gap-2">
                <span className="text-[12px] font-medium text-card-foreground">{deal.budget.toLocaleString()} ₽</span>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{new Date(deal.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</span>
                </div>
              </div>
              {totalMs > 0 && (
                <div className="mt-1.5 flex items-center gap-2">
                  <Progress value={progressPct} className="h-1 flex-1" />
                  <span className="text-[10px] text-muted-foreground">{completedMs}/{totalMs}</span>
                </div>
              )}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-10 text-[13px] text-muted-foreground">Сделки не найдены</div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CHAT TAB
   ═══════════════════════════════════════════════════════════════ */
function ChatTab({ deal }: { deal: Deal }) {
  useRealtimeMessages(deal.id);
  const dealMessages = allMessages.filter((m) => m.dealId === deal.id);
  const [newMsg, setNewMsg] = useState("");

  return (
    <div className="flex flex-col h-full">
      {/* Pinned deal summary */}
      <div className="px-4 py-2.5 bg-muted/30 border-b border-border">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-[13px]">
            <span className="text-muted-foreground">Формат: <span className="text-card-foreground font-medium">Видео-интеграция</span></span>
            <Separator orientation="vertical" className="h-4" />
            <span className="text-muted-foreground">Сумма: <span className="text-card-foreground font-medium">{deal.budget.toLocaleString()} ₽</span></span>
            <Separator orientation="vertical" className="h-4" />
            <span className="text-muted-foreground">Дедлайн: <span className="text-card-foreground font-medium">{deal.deadline ? new Date(deal.deadline).toLocaleDateString("ru-RU") : "—"}</span></span>
            <Separator orientation="vertical" className="h-4" />
            <span className="text-muted-foreground">Условия: <span className="text-success font-medium">v1 согласовано</span></span>
          </div>
          <Button variant="ghost" size="sm" className="text-[12px] h-7 text-primary">
            Открыть условия
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto space-y-3">
          {dealMessages.map((msg) => {
            const isMe = msg.senderId === "u1";
            return (
              <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[75%] rounded-xl px-3.5 py-2.5",
                    isMe
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground"
                  )}
                >
                  <p className="text-[11px] font-medium mb-0.5 opacity-70">{msg.senderName}</p>
                  <p className="text-[14px] leading-relaxed">{msg.content}</p>
                  {msg.attachment && (
                    <div className="mt-2 flex items-center gap-2 text-[12px] opacity-80">
                      <Paperclip className="h-3 w-3" />
                      <span className="underline cursor-pointer">{msg.attachment}</span>
                      <ExternalLink className="h-3 w-3 cursor-pointer" />
                      <Download className="h-3 w-3 cursor-pointer" />
                    </div>
                  )}
                  <p className="text-[10px] opacity-50 mt-1 text-right">
                    {new Date(msg.timestamp).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })}
          {dealMessages.length === 0 && (
            <div className="text-center text-[13px] text-muted-foreground py-16">Нет сообщений</div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="px-4 py-2.5 border-t border-border bg-card">
        <div className="max-w-2xl mx-auto flex gap-2 items-center">
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0">
            <Paperclip className="h-4 w-4" />
          </Button>
          <Input
            value={newMsg}
            onChange={(e) => setNewMsg(e.target.value)}
            placeholder="Написать сообщение..."
            className="flex-1 h-9 text-[14px] bg-background"
          />
          <Button size="icon" className="h-8 w-8 shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TERMS TAB
   ═══════════════════════════════════════════════════════════════ */
function TermsTab() {
  const [selectedVersion, setSelectedVersion] = useState(mockTermsVersions.length - 1);
  const ver = mockTermsVersions[selectedVersion];

  const statusLabel = ver.status === "accepted" ? "Согласовано обеими сторонами" : ver.status === "draft" ? "Черновик условий" : "Ожидает подтверждения";
  const statusColor = ver.status === "accepted" ? "bg-success/15 text-success border-success/30" : ver.status === "draft" ? "bg-muted text-muted-foreground border-muted-foreground/20" : "bg-warning/15 text-warning border-warning/30";

  const fieldLabels: Record<string, string> = {
    deliverable: "Формат / Размещение", platform: "Платформа", format: "Тип контента",
    price: "Стоимость", deadline: "Дедлайн", paymentMilestones: "Этапы оплаты",
    acceptanceCriteria: "Критерии приёмки", eridResponsibility: "Маркировка (ERID)",
    cancellation: "Условия отмены",
  };

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      {/* Version selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {mockTermsVersions.map((v, i) => (
            <button
              key={v.version}
              onClick={() => setSelectedVersion(i)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors border",
                selectedVersion === i
                  ? "bg-primary/15 text-primary border-primary/30"
                  : "text-muted-foreground border-border hover:text-foreground"
              )}
            >
              v{v.version}
            </button>
          ))}
        </div>
        <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-md border", statusColor)}>
          {statusLabel}
        </span>
      </div>

      {/* Terms card */}
      <Card>
        <CardContent className="p-4 space-y-0">
          {Object.entries(ver.fields).map(([key, value], i) => (
            <div key={key} className={cn("flex items-start justify-between py-2.5", i > 0 && "border-t border-border")}>
              <span className="text-[13px] text-muted-foreground flex-shrink-0 w-44">{fieldLabels[key] || key}</span>
              <span className="text-[13px] font-medium text-card-foreground text-right flex-1">{value}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Accepted by */}
      {ver.acceptedBy.length > 0 && (
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
          Подтвердили: {ver.acceptedBy.join(", ")}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {ver.status === "draft" && (
          <>
            <Button size="sm" className="text-[13px] h-8">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
              Подтвердить условия
            </Button>
            <Button size="sm" variant="outline" className="text-[13px] h-8">
              Предложить изменения
            </Button>
          </>
        )}
        {ver.status === "accepted" && (
          <Button size="sm" variant="outline" className="text-[13px] h-8">
            Предложить изменения (создать v{ver.version + 1})
          </Button>
        )}
      </div>

      {/* Legal note */}
      <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
        Платформа фиксирует согласованные условия и подтверждения обеих сторон. Каждое изменение создаёт новую версию с историей.
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FILES TAB
   ═══════════════════════════════════════════════════════════════ */
function FilesTab() {
  return (
    <div className="p-4 space-y-3 max-w-3xl mx-auto">
      {(["Brief", "Draft", "Final", "Legal"] as const).map((type) => {
        const files = mockFiles.filter((f) => f.type === type);
        if (files.length === 0) return null;
        return (
          <div key={type}>
            <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              {fileTypeLabels[type]}
            </p>
            <div className="space-y-1">
              {files.map((file) => (
                <div key={file.id} className="flex items-center gap-3 px-3 py-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-card-foreground truncate">{file.name}</span>
                      {file.pinned && (
                        <Pin className="h-3 w-3 text-primary shrink-0" />
                      )}
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded", fileTypeColors[file.type])}>
                        {fileTypeLabels[file.type]}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{file.uploader} · {file.date}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <Button variant="outline" size="sm" className="text-[13px] h-8 mt-2">
        <Upload className="h-3.5 w-3.5 mr-1.5" />
        Загрузить файл
      </Button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAYMENT TAB
   ═══════════════════════════════════════════════════════════════ */
function PaymentTab({ deal }: { deal: Deal }) {
  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      {/* Overall status */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[15px] font-semibold text-card-foreground">Безопасная сделка</p>
            <div className="flex items-center gap-1.5 text-[12px] text-success font-medium">
              <ShieldCheck className="h-4 w-4" />
              Escrow / Защищено
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-2.5 rounded-md bg-muted/40">
              <p className="text-[11px] text-muted-foreground">Сумма сделки</p>
              <p className="text-[16px] font-bold text-card-foreground">{deal.budget.toLocaleString()} ₽</p>
            </div>
            <div className="p-2.5 rounded-md bg-muted/40">
              <p className="text-[11px] text-muted-foreground">Зарезервировано</p>
              <p className="text-[16px] font-bold text-card-foreground">{mockPayment.reserved.toLocaleString()} ₽</p>
            </div>
            <div className="p-2.5 rounded-md bg-muted/40">
              <p className="text-[11px] text-muted-foreground">Выплачено</p>
              <p className="text-[16px] font-bold text-success">{mockPayment.released.toLocaleString()} ₽</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Milestones */}
      <Card>
        <CardContent className="p-4 space-y-0">
          <p className="text-[14px] font-semibold text-card-foreground mb-2">Этапы оплаты</p>
          {mockPayment.milestones.map((ms, i) => (
            <div key={ms.id} className={cn("flex items-center justify-between py-2.5", i > 0 && "border-t border-border")}>
              <div className="flex items-center gap-3">
                <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-md", paymentStatusColors[ms.status])}>
                  {paymentStatusLabels[ms.status]}
                </span>
                <span className="text-[13px] text-card-foreground">{ms.label}</span>
              </div>
              <span className="text-[13px] font-medium text-card-foreground">{ms.amount.toLocaleString()} ₽</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Commission */}
      <div className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/20 text-[12px]">
        <span className="text-muted-foreground">Комиссия платформы ({mockPayment.commissionPercent}%)</span>
        <span className="font-medium text-card-foreground">{mockPayment.commission.toLocaleString()} ₽</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button size="sm" className="text-[13px] h-8">
          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
          Подтвердить выполнение
        </Button>
        <Button size="sm" variant="outline" className="text-[13px] h-8 text-destructive border-destructive/30 hover:bg-destructive/10">
          <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
          Открыть спор
        </Button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ORD / MARKING TAB
   ═══════════════════════════════════════════════════════════════ */
function OrdTab() {
  const erid = "2SDnjek4fP1";
  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[15px] font-semibold text-card-foreground">Статус ОРД</p>
            <div className="flex items-center gap-1.5 text-[12px] text-success font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Подключено
            </div>
          </div>

          <div className="flex items-center justify-between py-2 border-t border-border">
            <span className="text-[13px] text-muted-foreground">ERID</span>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-mono font-semibold text-primary">{erid}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                navigator.clipboard.writeText(erid);
                toast.success("ERID скопирован");
              }}>
                <ClipboardCopy className="h-3 w-3 text-primary" />
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between py-2 border-t border-border">
            <span className="text-[13px] text-muted-foreground">Последняя синхронизация</span>
            <span className="text-[13px] text-card-foreground">19.02.2026, 14:33</span>
          </div>

          <div className="flex items-center justify-between py-2 border-t border-border">
            <span className="text-[13px] text-muted-foreground">Привязка к условиям</span>
            <span className="text-[13px] text-card-foreground">v1 (согласовано)</span>
          </div>
        </CardContent>
      </Card>

      {/* Events log */}
      <Card>
        <CardContent className="p-4 space-y-0">
          <p className="text-[14px] font-semibold text-card-foreground mb-2">Журнал ОРД</p>
          {mockAudit.filter((e) => e.category === "ord").length === 0 ? (
            <p className="text-[13px] text-muted-foreground py-3">Нет событий ОРД</p>
          ) : (
            mockAudit
              .filter((e) => e.category === "ord")
              .map((e) => (
                <div key={e.id} className="flex items-center gap-3 py-2 border-t border-border first:border-t-0">
                  <span className="text-[11px] text-muted-foreground w-32 shrink-0">{e.ts}</span>
                  <span className="text-[13px] text-card-foreground">{e.action}</span>
                </div>
              ))
          )}
        </CardContent>
      </Card>

      <Button variant="outline" size="sm" className="text-[13px] h-8">
        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
        Повторить синхронизацию
      </Button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   AUDIT TAB
   ═══════════════════════════════════════════════════════════════ */
function AuditTab() {
  const [filter, setFilter] = useState<string>("all");
  const categories = [
    { key: "all", label: "Все" },
    { key: "terms", label: "Условия" },
    { key: "files", label: "Файлы" },
    { key: "payments", label: "Оплата" },
    { key: "ord", label: "ОРД" },
  ];

  const filtered = filter === "all" ? mockAudit : mockAudit.filter((e) => e.category === filter);

  const categoryIcons: Record<string, any> = {
    terms: ScrollText,
    files: Files,
    payments: CreditCard,
    ord: Radio,
  };

  return (
    <div className="p-4 space-y-3 max-w-3xl mx-auto">
      <div className="flex items-center gap-1">
        {categories.map((c) => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            className={cn(
              "px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors",
              filter === c.key ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.map((entry, i) => {
            const Icon = categoryIcons[entry.category] || ScrollText;
            return (
              <div key={entry.id} className={cn("flex items-start gap-3 px-4 py-2.5", i > 0 && "border-t border-border")}>
                <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-card-foreground">{entry.action}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-muted-foreground">{entry.who}</span>
                    <span className="text-[11px] text-muted-foreground">·</span>
                    <span className="text-[11px] text-muted-foreground">{entry.ts}</span>
                  </div>
                  {entry.file && (
                    <button className="text-[11px] text-primary underline mt-0.5">{entry.file}</button>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-8 text-[13px] text-muted-foreground">Нет записей</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN DEAL WORKSPACE
   ═══════════════════════════════════════════════════════════════ */
export function DealWorkspace() {
  const [selectedDeal, setSelectedDeal] = useState<Deal>(deals[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeSubTab, setActiveSubTab] = useState("chat");
  const [showMobileList, setShowMobileList] = useState(false);

  const primaryAction = getPrimaryAction(selectedDeal.status);
  const completedMs = selectedDeal.milestones.filter((m) => m.completed).length;
  const totalMs = selectedDeal.milestones.length;

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      {/* Sidebar */}
      <DealSidebar
        selectedId={selectedDeal.id}
        onSelect={(d) => { setSelectedDeal(d); setActiveSubTab("chat"); }}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
      />

      {/* Main workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3 border-b border-border bg-card space-y-2">
          {/* Row 1: title + status + actions */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <h1 className="text-[18px] font-bold text-card-foreground truncate">{selectedDeal.title}</h1>
              <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-md border whitespace-nowrap", statusColors[selectedDeal.status])}>
                {statusLabels[selectedDeal.status]}
              </span>
              <span className="text-[14px] font-semibold text-card-foreground whitespace-nowrap">{selectedDeal.budget.toLocaleString()} ₽</span>
              {selectedDeal.deadline && (
                <span className="flex items-center gap-1 text-[12px] text-muted-foreground whitespace-nowrap">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {new Date(selectedDeal.deadline).toLocaleDateString("ru-RU")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {primaryAction && (
                <Button size="sm" className="text-[13px] h-8">
                  <primaryAction.icon className="h-3.5 w-3.5 mr-1.5" />
                  {primaryAction.label}
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem><Download className="h-3.5 w-3.5 mr-2" /> Экспорт</DropdownMenuItem>
                  <DropdownMenuItem><Copy className="h-3.5 w-3.5 mr-2" /> Дублировать</DropdownMenuItem>
                  <DropdownMenuItem><Archive className="h-3.5 w-3.5 mr-2" /> Архивировать</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Row 2: meta */}
          <div className="flex items-center gap-4 text-[12px] text-muted-foreground">
            <span>{selectedDeal.advertiserName} → {selectedDeal.creatorName}</span>
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={() => {
                navigator.clipboard.writeText(selectedDeal.id);
                toast.success("ID скопирован");
              }}
            >
              <span className="font-mono text-[11px]">#{selectedDeal.id}</span>
              <ClipboardCopy className="h-3 w-3" />
            </button>
            <div className="flex items-center gap-1 text-success">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span className="font-medium">Безопасная сделка</span>
            </div>
            {totalMs > 0 && (
              <span>Прогресс: {completedMs}/{totalMs}</span>
            )}
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="border-b border-border bg-card px-5">
          <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
            <TabsList className="bg-transparent h-9 p-0 gap-0">
              {[
                { value: "chat", label: "Чат", icon: MessageCircle },
                { value: "terms", label: "Условия", icon: ScrollText },
                { value: "files", label: "Файлы", icon: Files },
                { value: "payment", label: "Оплата", icon: CreditCard },
                { value: "ord", label: "Маркировка", icon: Radio },
                { value: "audit", label: "Аудит", icon: ScrollText },
              ].map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="text-[13px] gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 h-9"
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {activeSubTab === "chat" && <ChatTab deal={selectedDeal} />}
          {activeSubTab === "terms" && <TermsTab />}
          {activeSubTab === "files" && <FilesTab />}
          {activeSubTab === "payment" && <PaymentTab deal={selectedDeal} />}
          {activeSubTab === "ord" && <OrdTab />}
          {activeSubTab === "audit" && <AuditTab />}
        </div>
      </div>
    </div>
  );
}
