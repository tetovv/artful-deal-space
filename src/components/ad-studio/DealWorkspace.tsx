import { useState, useMemo } from "react";
import { deals, messages as allMessages } from "@/data/mockData";
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";
import { useAdvertiserScores } from "@/hooks/useAdvertiserScores";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Search, Send, Paperclip, MoreVertical, ShieldCheck,
  CheckCircle2, AlertTriangle, Clock, FileText, Upload, Download,
  ExternalLink, Pin, RefreshCw, MessageCircle, ClipboardCopy,
  Archive, Files, CreditCard, Radio, ScrollText, CalendarDays, Copy,
  ChevronDown, ChevronRight,
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
    case "briefing": return { label: "Отправить бриф", icon: Send };
    case "in_progress": return { label: "Отправить на проверку", icon: Upload };
    case "review": return { label: "Подтвердить выполнение", icon: CheckCircle2 };
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

const fileTypeLabels = { Brief: "Бриф", Draft: "Черновик", Final: "Финальный", Legal: "Юридический" };
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

const paymentStatusLabels = { reserved: "Резерв", in_progress: "В работе", review: "На проверке", released: "Выплачено" };
const paymentStatusColors = { reserved: "bg-warning/15 text-warning", in_progress: "bg-primary/15 text-primary", review: "bg-accent/15 text-accent", released: "bg-success/15 text-success" };

/* ═══════════════════════════════════════════════════════
   SIDEBAR
   ═══════════════════════════════════════════════════════ */
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
    <div className="w-[320px] border-r border-border bg-card flex flex-col shrink-0 h-full">
      <div className="p-2.5 space-y-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск сделок..."
            className="pl-8 h-8 text-[13px] bg-background"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {[
            { key: "all", label: "Все" },
            { key: "active", label: "В работе" },
            { key: "pending", label: "Ожидание" },
            { key: "disputed", label: "Спор" },
            { key: "completed", label: "Готово" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={cn(
                "px-2 py-0.5 rounded text-[12px] font-medium transition-colors",
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

      <div className="flex-1 overflow-y-auto">
        {filtered.map((deal) => {
          const completedMs = deal.milestones.filter((m) => m.completed).length;
          const totalMs = deal.milestones.length;
          const isSelected = selectedId === deal.id;

          return (
            <button
              key={deal.id}
              onClick={() => onSelect(deal)}
              className={cn(
                "w-full text-left px-3 py-2 border-b border-border/50 transition-colors",
                isSelected ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-muted/30"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold text-card-foreground truncate flex-1">{deal.title}</span>
                <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0", statusColors[deal.status])}>
                  {statusLabels[deal.status]}
                </span>
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-[11px] text-muted-foreground truncate">
                  {deal.advertiserName} → {deal.creatorName}
                </span>
                <span className="text-[12px] font-medium text-card-foreground shrink-0">{deal.budget.toLocaleString()} ₽</span>
              </div>
              {totalMs > 0 && (
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="h-[3px] flex-1 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary/60 rounded-full transition-all" style={{ width: `${(completedMs / totalMs) * 100}%` }} />
                  </div>
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

/* ═══════════════════════════════════════════════════════
   CHAT TAB
   ═══════════════════════════════════════════════════════ */
function ChatTab({ deal }: { deal: Deal }) {
  useRealtimeMessages(deal.id);
  const dealMessages = allMessages.filter((m) => m.dealId === deal.id);
  const [newMsg, setNewMsg] = useState("");

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto py-3">
        <div className="max-w-[820px] mx-auto px-4 space-y-2">
          {dealMessages.map((msg) => {
            const isMe = msg.senderId === "u1";
            return (
              <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[65%] rounded-2xl px-3.5 py-2",
                    isMe
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-secondary text-secondary-foreground rounded-bl-md"
                  )}
                >
                  <p className="text-[11px] font-semibold mb-0.5 opacity-70">{msg.senderName}</p>
                  <p className="text-[15px] leading-relaxed">{msg.content}</p>
                  {msg.attachment && (
                    <div className="mt-1.5 flex items-center gap-2 text-[13px]">
                      <Paperclip className="h-3 w-3 opacity-60" />
                      <a href="#" className="underline hover:no-underline truncate">{msg.attachment}</a>
                      <button className="opacity-60 hover:opacity-100 shrink-0"><Download className="h-3 w-3" /></button>
                    </div>
                  )}
                  <p className="text-[10px] opacity-50 mt-0.5 text-right">
                    {new Date(msg.timestamp).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })}
          {dealMessages.length === 0 && (
            <div className="text-center text-[14px] text-muted-foreground py-16">Нет сообщений</div>
          )}
        </div>
      </div>

      <div className="px-4 py-2 border-t border-border bg-card">
        <div className="max-w-[820px] mx-auto flex gap-2 items-center">
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

/* ═══════════════════════════════════════════════════════
   TERMS TAB
   ═══════════════════════════════════════════════════════ */
function TermsTab() {
  const [selectedVersion, setSelectedVersion] = useState(mockTermsVersions.length - 1);
  const ver = mockTermsVersions[selectedVersion];

  const statusLabel = ver.status === "accepted" ? "Согласовано" : ver.status === "draft" ? "Черновик" : "Ожидает";
  const statusColor = ver.status === "accepted" ? "bg-success/15 text-success border-success/30" : ver.status === "draft" ? "bg-muted text-muted-foreground border-muted-foreground/20" : "bg-warning/15 text-warning border-warning/30";

  const fieldLabels: Record<string, string> = {
    deliverable: "Размещение", platform: "Платформа", format: "Формат",
    price: "Стоимость", deadline: "Дедлайн", paymentMilestones: "Этапы оплаты",
    acceptanceCriteria: "Критерии приёмки", eridResponsibility: "Маркировка",
    cancellation: "Отмена",
  };

  return (
    <div className="p-4 space-y-3 max-w-[820px] mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {mockTermsVersions.map((v, i) => (
            <button
              key={v.version}
              onClick={() => setSelectedVersion(i)}
              className={cn(
                "px-2 py-0.5 rounded text-[12px] font-medium transition-colors border",
                selectedVersion === i
                  ? "bg-primary/15 text-primary border-primary/30"
                  : "text-muted-foreground border-border hover:text-foreground"
              )}
            >
              v{v.version}
            </button>
          ))}
        </div>
        <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded border", statusColor)}>
          {statusLabel}
        </span>
      </div>

      <Card>
        <CardContent className="p-3 space-y-0">
          {Object.entries(ver.fields).map(([key, value], i) => (
            <div key={key} className={cn("flex items-start justify-between py-1.5", i > 0 && "border-t border-border/50")}>
              <span className="text-[13px] text-muted-foreground w-36 shrink-0">{fieldLabels[key] || key}</span>
              <span className="text-[14px] font-medium text-card-foreground text-right flex-1">{value}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {ver.acceptedBy.length > 0 && (
        <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
          Подтвердили: {ver.acceptedBy.join(", ")}
        </div>
      )}

      {ver.status === "draft" && (
        <Button size="sm" className="text-[13px] h-8">
          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
          Подтвердить условия
        </Button>
      )}
      {ver.status === "accepted" && (
        <Button size="sm" variant="outline" className="text-[13px] h-8">
          Предложить изменения (v{ver.version + 1})
        </Button>
      )}

      <div className="flex items-center gap-4 pt-1">
        <button className="text-[12px] text-primary hover:underline flex items-center gap-1">
          <Radio className="h-3 w-3" /> Маркировка (ОРД) →
        </button>
        <button className="text-[12px] text-primary hover:underline flex items-center gap-1">
          <ScrollText className="h-3 w-3" /> Журнал действий →
        </button>
      </div>

      <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
        Платформа фиксирует согласованные условия и подтверждения обеих сторон. Каждое изменение создаёт новую версию.
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   FILES TAB
   ═══════════════════════════════════════════════════════ */
function FilesTab() {
  return (
    <div className="p-4 space-y-3 max-w-[820px] mx-auto">
      {(["Brief", "Draft", "Final", "Legal"] as const).map((type) => {
        const files = mockFiles.filter((f) => f.type === type);
        if (files.length === 0) return null;
        return (
          <div key={type}>
            <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              {fileTypeLabels[type]}
            </p>
            <div className="space-y-0.5">
              {files.map((file) => (
                <div key={file.id} className="flex items-center gap-2.5 px-2.5 py-1.5 rounded bg-muted/30 hover:bg-muted/50 transition-colors">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-[14px] font-medium text-card-foreground truncate flex-1">{file.name}</span>
                  {file.pinned && <Pin className="h-3 w-3 text-primary shrink-0" />}
                  <span className="text-[11px] text-muted-foreground shrink-0">{file.uploader} · {file.date}</span>
                  <a href="#" className="text-muted-foreground hover:text-foreground"><ExternalLink className="h-3.5 w-3.5" /></a>
                  <a href="#" className="text-muted-foreground hover:text-foreground"><Download className="h-3.5 w-3.5" /></a>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <Button variant="outline" size="sm" className="text-[13px] h-8">
        <Upload className="h-3.5 w-3.5 mr-1.5" />
        Загрузить файл
      </Button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   PAYMENT TAB
   ═══════════════════════════════════════════════════════ */
function PaymentTab() {
  return (
    <div className="p-4 space-y-3 max-w-[820px] mx-auto">
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Сумма", value: `${mockPayment.total.toLocaleString()} ₽`, color: "text-card-foreground" },
          { label: "Зарезервировано", value: `${mockPayment.reserved.toLocaleString()} ₽`, color: "text-card-foreground" },
          { label: "Выплачено", value: `${mockPayment.released.toLocaleString()} ₽`, color: "text-success" },
        ].map((item) => (
          <div key={item.label} className="p-2 rounded bg-muted/30">
            <p className="text-[12px] text-muted-foreground">{item.label}</p>
            <p className={cn("text-[16px] font-bold", item.color)}>{item.value}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="p-3 space-y-0">
          <p className="text-[14px] font-semibold text-card-foreground mb-1">Этапы оплаты</p>
          {mockPayment.milestones.map((ms, i) => (
            <div key={ms.id} className={cn("flex items-center justify-between py-1.5", i > 0 && "border-t border-border/50")}>
              <div className="flex items-center gap-2">
                <span className={cn("text-[11px] font-medium px-1.5 py-0.5 rounded", paymentStatusColors[ms.status])}>
                  {paymentStatusLabels[ms.status]}
                </span>
                <span className="text-[14px] text-card-foreground">{ms.label}</span>
              </div>
              <span className="text-[14px] font-medium text-card-foreground">{ms.amount.toLocaleString()} ₽</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between px-3 py-1.5 rounded bg-muted/20 text-[12px]">
        <span className="text-muted-foreground">Комиссия ({mockPayment.commissionPercent}%)</span>
        <span className="font-medium text-card-foreground">{mockPayment.commission.toLocaleString()} ₽</span>
      </div>

      <button className="text-[12px] text-primary hover:underline flex items-center gap-1">
        <Radio className="h-3 w-3" /> Маркировка (ОРД) →
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   ORD TAB
   ═══════════════════════════════════════════════════════ */
function OrdTab() {
  const erid = "2SDnjek4fP1";
  return (
    <div className="p-4 space-y-3 max-w-[820px] mx-auto">
      <Card>
        <CardContent className="p-3 space-y-0">
          <div className="flex items-center justify-between py-1.5">
            <span className="text-[14px] font-semibold text-card-foreground">Статус ОРД</span>
            <span className="flex items-center gap-1 text-[12px] text-success font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" /> Подключено
            </span>
          </div>
          {[
            { label: "ERID", value: erid, mono: true, copyable: true },
            { label: "Синхронизация", value: "19.02.2026, 14:33" },
            { label: "Условия", value: "v1 (согласовано)" },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between py-1.5 border-t border-border/50">
              <span className="text-[13px] text-muted-foreground">{row.label}</span>
              <div className="flex items-center gap-1.5">
                <span className={cn("text-[13px] text-card-foreground", row.mono && "font-mono font-semibold text-primary")}>{row.value}</span>
                {row.copyable && (
                  <button onClick={() => { navigator.clipboard.writeText(row.value); toast.success("ERID скопирован"); }}>
                    <ClipboardCopy className="h-3 w-3 text-primary" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-1">
        <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">Журнал ОРД</p>
        {mockAudit.filter((e) => e.category === "ord").map((e) => (
          <div key={e.id} className="flex items-center gap-2 text-[12px] py-1">
            <span className="text-muted-foreground w-24 shrink-0">{e.ts}</span>
            <span className="text-card-foreground">{e.action}</span>
          </div>
        ))}
      </div>

      <Button variant="outline" size="sm" className="text-[13px] h-8">
        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
        Повторить синхронизацию
      </Button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   AUDIT TAB
   ═══════════════════════════════════════════════════════ */
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
  const categoryIcons: Record<string, any> = { terms: ScrollText, files: Files, payments: CreditCard, ord: Radio };

  return (
    <div className="p-4 space-y-3 max-w-[820px] mx-auto">
      <div className="flex items-center gap-1">
        {categories.map((c) => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            className={cn(
              "px-2 py-0.5 rounded text-[12px] font-medium transition-colors",
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
              <div key={entry.id} className={cn("flex items-start gap-2.5 px-3 py-1.5", i > 0 && "border-t border-border/50")}>
                <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-card-foreground">{entry.action}</p>
                  <span className="text-[11px] text-muted-foreground">{entry.who} · {entry.ts}</span>
                  {entry.file && (
                    <button className="block text-[11px] text-primary underline mt-0.5">{entry.file}</button>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-6 text-[13px] text-muted-foreground">Нет записей</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN DEAL WORKSPACE
   ═══════════════════════════════════════════════════════ */
export function DealWorkspace() {
  const [selectedDeal, setSelectedDeal] = useState<Deal>(deals[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeSubTab, setActiveSubTab] = useState("chat");
  const [detailsOpen, setDetailsOpen] = useState(false);

  const primaryAction = getPrimaryAction(selectedDeal.status);
  const completedMs = selectedDeal.milestones.filter((m) => m.completed).length;
  const totalMs = selectedDeal.milestones.length;

  const coreTabs = [
    { value: "chat", label: "Чат", icon: MessageCircle },
    { value: "terms", label: "Условия", icon: ScrollText },
    { value: "files", label: "Файлы", icon: Files },
    { value: "payment", label: "Оплата", icon: CreditCard },
  ];

  const moreTabs = [
    { value: "ord", label: "Маркировка (ОРД)" },
    { value: "audit", label: "Аудит" },
  ];

  const isMoreTab = moreTabs.some((t) => t.value === activeSubTab);

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      <DealSidebar
        selectedId={selectedDeal.id}
        onSelect={(d) => { setSelectedDeal(d); setActiveSubTab("chat"); setDetailsOpen(false); }}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
      />

      {/* Main workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* ── Header: single source of truth ── */}
        <div className="px-5 py-2 border-b border-border bg-card">
          <div className="max-w-[1100px]">
            {/* Row 1: Title + status + ONE primary CTA + kebab */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <h1 className="text-[19px] font-bold text-card-foreground truncate">{selectedDeal.title}</h1>
                <span className={cn("text-[11px] font-medium px-1.5 py-0.5 rounded border shrink-0", statusColors[selectedDeal.status])}>
                  {statusLabels[selectedDeal.status]}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {primaryAction && (
                  <Button size="sm" className="text-[13px] h-8">
                    <primaryAction.icon className="h-3.5 w-3.5 mr-1" />
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
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive focus:text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5 mr-2" /> Открыть спор
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Collapsible "Deal details" row */}
            <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
              <CollapsibleTrigger className="flex items-center gap-1.5 mt-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors">
                {detailsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                <span>Детали сделки</span>
                {!detailsOpen && (
                  <span className="text-muted-foreground/60 ml-1">
                    — {selectedDeal.budget.toLocaleString()} ₽
                    {selectedDeal.deadline && ` · до ${new Date(selectedDeal.deadline).toLocaleDateString("ru-RU")}`}
                    {totalMs > 0 && ` · ${completedMs}/${totalMs}`}
                  </span>
                )}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-1.5 grid grid-cols-2 gap-x-6 gap-y-1 text-[13px] pb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Сумма:</span>
                    <span className="font-semibold text-card-foreground">{selectedDeal.budget.toLocaleString()} ₽</span>
                  </div>
                  {selectedDeal.deadline && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Дедлайн:</span>
                      <span className="font-medium text-card-foreground flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {new Date(selectedDeal.deadline).toLocaleDateString("ru-RU")}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Стороны:</span>
                    <span className="text-card-foreground">{selectedDeal.advertiserName} → {selectedDeal.creatorName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3 text-success" /> Безопасная сделка
                    </span>
                    {totalMs > 0 && (
                      <span className="text-muted-foreground ml-auto">Этап {completedMs}/{totalMs}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">ID:</span>
                    <button
                      className="flex items-center gap-1 hover:text-foreground transition-colors font-mono text-[11px] text-muted-foreground"
                      onClick={() => { navigator.clipboard.writeText(selectedDeal.id); toast.success("ID скопирован"); }}
                    >
                      #{selectedDeal.id} <ClipboardCopy className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>

        {/* ── Sub-tabs: 4 core + "Ещё" dropdown ── */}
        <div className="border-b border-border bg-card px-5">
          <div className="flex items-center gap-0">
            {coreTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveSubTab(tab.value)}
                className={cn(
                  "flex items-center gap-1.5 px-3 h-9 text-[14px] font-medium border-b-2 transition-colors",
                  activeSubTab === tab.value
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            ))}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "flex items-center gap-1 px-3 h-9 text-[14px] font-medium border-b-2 transition-colors",
                    isMoreTab
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  Ещё
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {moreTabs.map((tab) => (
                  <DropdownMenuItem key={tab.value} onClick={() => setActiveSubTab(tab.value)}>
                    {tab.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* ── Tab content ── */}
        <div className="flex-1 overflow-y-auto">
          {activeSubTab === "chat" && <ChatTab deal={selectedDeal} />}
          {activeSubTab === "terms" && <TermsTab />}
          {activeSubTab === "files" && <FilesTab />}
          {activeSubTab === "payment" && <PaymentTab />}
          {activeSubTab === "ord" && <OrdTab />}
          {activeSubTab === "audit" && <AuditTab />}
        </div>
      </div>
    </div>
  );
}
