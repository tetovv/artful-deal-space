import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";
import {
  useDealAuditLog, useLogDealEvent,
  useDealEscrow, useReserveEscrow, useReleaseEscrow,
  useDealFiles, useUploadDealFile, useDownloadDealFile,
  useDealTerms, useAcceptTerms,
  useRealtimeAuditLog, useRealtimeEscrow,
} from "@/hooks/useDealData";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ArrowLeft, Send, Paperclip, MoreVertical, ShieldCheck,
  CheckCircle2, AlertTriangle, Clock, FileText, Upload, Download,
  Pin, MessageCircle, Files, CreditCard, ScrollText, CalendarDays,
  ChevronDown, ChevronRight, ArrowLeftRight, Loader2,
  HelpCircle, FileQuestion, Palette, PlayCircle, Eye,
  ClipboardCopy, Archive,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PageTransition } from "@/components/layout/PageTransition";
import { ScrollArea } from "@/components/ui/scroll-area";

/* ─── Status config ─── */
const statusLabels: Record<string, string> = {
  pending: "Ожидание",
  briefing: "Подготовка",
  in_progress: "В работе",
  review: "На проверке",
  completed: "Завершено",
  disputed: "Спор",
  needs_changes: "Требует правок",
  waiting_inputs: "Ожидание данных",
};
const statusColors: Record<string, string> = {
  pending: "bg-warning/15 text-warning border-warning/30",
  briefing: "bg-info/15 text-info border-info/30",
  in_progress: "bg-primary/15 text-primary border-primary/30",
  review: "bg-accent/15 text-accent-foreground border-accent/30",
  completed: "bg-green-500/10 text-green-500 border-green-500/30",
  disputed: "bg-destructive/15 text-destructive border-destructive/30",
  needs_changes: "bg-warning/15 text-warning border-warning/30",
  waiting_inputs: "bg-orange-500/15 text-orange-500 border-orange-500/30",
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

type DealTab = "chat" | "terms" | "files" | "payments" | "more";

/* ─── Helpers ─── */
function fmtDate(v: string | null | undefined): string {
  if (!v) return "—";
  try { return new Date(v).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }); }
  catch { return v; }
}
function fmtDateTime(v: string): string {
  try { return new Date(v).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch { return v; }
}

/* ═══════════════════════════════════════
   CHAT TAB
   ═══════════════════════════════════════ */
function DealChatTab({ dealId }: { dealId: string }) {
  useRealtimeMessages(dealId);
  const { user, profile } = useAuth();
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], refetch } = useQuery({
    queryKey: ["deal-chat", dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages").select("*").eq("deal_id", dealId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!dealId,
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!user || !newMsg.trim()) return;
    setSending(true);
    try {
      await supabase.from("messages").insert({
        deal_id: dealId, sender_id: user.id,
        sender_name: profile?.display_name || "Автор",
        content: newMsg.trim(),
      });
      setNewMsg("");
      refetch();
    } catch { toast.error("Не удалось отправить"); }
    finally { setSending(false); }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto py-3">
        <div className="max-w-[820px] mx-auto px-4 space-y-1">
          {messages.length === 0 && (
            <div className="text-center text-[15px] text-muted-foreground py-16">
              Нет сообщений. Начните общение с рекламодателем.
            </div>
          )}
          {messages.map((msg: any, i: number) => {
            const isMe = msg.sender_id === user?.id;
            const prev = i > 0 ? messages[i - 1] : null;
            const isSameSender = (prev as any)?.sender_id === msg.sender_id;
            return (
              <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start", isSameSender ? "mt-0.5" : "mt-2.5")}>
                <div className={cn(
                  "max-w-[63%] px-3.5 py-2.5 rounded-2xl",
                  isMe ? "bg-primary text-primary-foreground rounded-br-md" : "bg-secondary text-secondary-foreground rounded-bl-md",
                )}>
                  {!isSameSender && <p className={cn("text-[13px] font-semibold mb-0.5", isMe ? "opacity-80" : "opacity-75")}>{msg.sender_name}</p>}
                  <p className="text-[15px] leading-relaxed">{msg.content}</p>
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
            value={newMsg} onChange={(e) => setNewMsg(e.target.value)}
            placeholder="Написать сообщение…" className="flex-1 h-10 text-[15px] bg-background"
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          />
          <Button size="icon" className="h-9 w-9 shrink-0" onClick={handleSend} disabled={sending || !newMsg.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   TERMS TAB (read-only agreed + change request)
   ═══════════════════════════════════════ */
const termsSections = [
  { title: "Размещение", fields: [{ label: "Тип", key: "deliverable" }, { label: "Платформа", key: "platform" }, { label: "Формат", key: "format" }] },
  { title: "Сроки", fields: [{ label: "Дедлайн", key: "deadline" }] },
  { title: "Оплата", fields: [{ label: "Стоимость", key: "price" }, { label: "Этапы", key: "paymentMilestones" }] },
  { title: "Приёмка", fields: [{ label: "Критерии", key: "acceptanceCriteria" }, { label: "Правки", key: "revisions" }] },
  { title: "Маркировка", fields: [{ label: "ERID", key: "eridResponsibility" }] },
];

function DealTermsTab({ dealId }: { dealId: string }) {
  const { user } = useAuth();
  const { data: terms = [] } = useDealTerms(dealId);
  const logEvent = useLogDealEvent();
  const qc = useQueryClient();
  const [showChangeRequest, setShowChangeRequest] = useState(false);
  const [changeField, setChangeField] = useState("");
  const [changeValue, setChangeValue] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const allTerms = useMemo(() => [...terms].sort((a: any, b: any) => a.version - b.version), [terms]);
  const latestTerms = allTerms.length > 0 ? allTerms[allTerms.length - 1] : null;
  const fields = latestTerms ? ((latestTerms as any).fields as Record<string, string>) : null;
  const isAccepted = (latestTerms as any)?.status === "accepted";

  const handleSubmitChangeRequest = async () => {
    if (!user || !latestTerms || !changeReason.trim()) return;
    setSubmitting(true);
    try {
      const currentVersion = (latestTerms as any).version;
      const newFields = { ...(fields || {}), ...(changeField && changeValue ? { [changeField]: changeValue } : {}), changeReason: changeReason.trim() };
      await supabase.from("deal_terms").insert({
        deal_id: dealId, created_by: user.id, version: currentVersion + 1,
        status: "draft", fields: newFields,
      } as any);
      await supabase.from("deals").update({ status: "needs_changes" }).eq("id", dealId);
      logEvent.mutate({ dealId, action: `Запрос на изменение условий (v${currentVersion + 1}): ${changeReason}`, category: "terms" });
      toast.success("Запрос на изменение отправлен");
      setShowChangeRequest(false);
      setChangeField(""); setChangeValue(""); setChangeReason("");
      qc.invalidateQueries({ queryKey: ["deal_terms", dealId] });
    } catch { toast.error("Ошибка"); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="p-5 space-y-4 max-w-[820px] mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-[15px] font-semibold text-foreground">Согласованные условия</h3>
          {isAccepted && (
            <Badge variant="outline" className="text-[11px] bg-green-500/10 text-green-500 border-green-500/30">
              <CheckCircle2 className="h-3 w-3 mr-1" /> Согласовано
            </Badge>
          )}
          {latestTerms && <span className="text-[12px] text-muted-foreground">v{(latestTerms as any).version}</span>}
        </div>
        <Button variant="outline" size="sm" className="text-[13px] h-8" onClick={() => setShowChangeRequest(true)}>
          <ArrowLeftRight className="h-3.5 w-3.5 mr-1.5" /> Запросить изменение
        </Button>
      </div>

      {fields ? (
        <Accordion type="multiple" defaultValue={["s0"]}>
          {termsSections.map((section, si) => {
            const visible = section.fields.filter((f) => fields[f.key]);
            if (visible.length === 0) return null;
            return (
              <AccordionItem key={si} value={`s${si}`} className="border-border/50">
                <AccordionTrigger className="py-2.5 px-1 text-[15px] font-semibold hover:no-underline">{section.title}</AccordionTrigger>
                <AccordionContent className="pb-3 px-1">
                  {visible.map((field, fi) => (
                    <div key={field.key} className={cn("flex items-start justify-between py-2", fi > 0 && "border-t border-border/30")}>
                      <span className="text-[14px] text-muted-foreground w-36 shrink-0">{field.label}</span>
                      <span className="text-[15px] font-medium text-foreground text-right flex-1">{fields[field.key]}</span>
                    </div>
                  ))}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      ) : (
        <div className="text-center py-12 text-[14px] text-muted-foreground">Условия ещё не согласованы</div>
      )}

      {/* Version history */}
      {allTerms.length > 1 && (
        <div className="pt-2">
          <p className="text-[13px] text-muted-foreground mb-2">История версий</p>
          <div className="space-y-1">
            {allTerms.map((t: any) => (
              <div key={t.id} className="flex items-center gap-2 text-[13px]">
                <span className="font-medium">v{t.version}</span>
                <Badge variant="outline" className={cn("text-[10px]",
                  t.status === "accepted" ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"
                )}>{t.status === "accepted" ? "Согласовано" : "Черновик"}</Badge>
                <span className="text-muted-foreground">{fmtDate(t.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Change request dialog */}
      <Dialog open={showChangeRequest} onOpenChange={setShowChangeRequest}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Запрос на изменение условий</DialogTitle>
            <DialogDescription>Требует одобрения обеих сторон</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-[13px] font-medium text-foreground mb-1 block">Что изменить (необязательно)</label>
              <Select value={changeField} onValueChange={setChangeField}>
                <SelectTrigger className="h-9 text-[14px]"><SelectValue placeholder="Выберите поле" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="price">Стоимость</SelectItem>
                  <SelectItem value="deadline">Дедлайн</SelectItem>
                  <SelectItem value="revisions">Кол-во правок</SelectItem>
                  <SelectItem value="acceptanceCriteria">Критерии приёмки</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {changeField && (
              <div>
                <label className="text-[13px] font-medium text-foreground mb-1 block">Новое значение</label>
                <Input value={changeValue} onChange={(e) => setChangeValue(e.target.value)} className="h-9 text-[14px]" />
              </div>
            )}
            <div>
              <label className="text-[13px] font-medium text-foreground mb-1 block">Причина изменения *</label>
              <Textarea value={changeReason} onChange={(e) => setChangeReason(e.target.value)} className="text-[14px] min-h-[80px]"
                placeholder="Опишите, почему нужно изменение…" />
            </div>
            <Button className="w-full" onClick={handleSubmitChangeRequest} disabled={submitting || !changeReason.trim()}>
              {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Отправка…</> : "Отправить запрос"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═══════════════════════════════════════
   FILES TAB — sections: Brief, Draft, Final, Legal
   ═══════════════════════════════════════ */
function DealFilesTab({ dealId }: { dealId: string }) {
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
        <h3 className="text-[15px] font-semibold text-foreground">Файлы сделки</h3>
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
                      <button onClick={() => downloadFile.mutate(f.storage_path)} className="text-[15px] font-medium text-foreground hover:underline truncate block text-left">
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

/* ═══════════════════════════════════════
   PAYMENTS TAB
   ═══════════════════════════════════════ */
function DealPaymentsTab({ dealId }: { dealId: string }) {
  const { data: escrowItems = [] } = useDealEscrow(dealId);
  const total = escrowItems.reduce((s: number, m: any) => s + m.amount, 0);
  const released = escrowItems.filter((m: any) => m.status === "released").reduce((s: number, m: any) => s + m.amount, 0);
  const reserved = escrowItems.filter((m: any) => m.status === "reserved").reduce((s: number, m: any) => s + m.amount, 0);
  const commission = Math.round(total * 0.1);

  return (
    <div className="p-5 space-y-4 max-w-[820px] mx-auto">
      <div className="flex items-center gap-3 flex-wrap text-[15px]">
        <span className="text-muted-foreground">Итого: <span className="font-semibold text-foreground">{total.toLocaleString()} ₽</span></span>
        <span className="text-border">·</span>
        <span className="text-muted-foreground">Резерв: <span className="font-semibold text-foreground">{reserved.toLocaleString()} ₽</span></span>
        <span className="text-border">·</span>
        <span className="text-muted-foreground">Выплачено: <span className="font-semibold text-green-500">{released.toLocaleString()} ₽</span></span>
      </div>

      {escrowItems.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <CreditCard className="h-8 w-8 mx-auto text-muted-foreground/40" />
          <p className="text-[14px] text-muted-foreground">Платежи ещё не зарезервированы</p>
          <p className="text-[13px] text-muted-foreground/60">Рекламодатель зарезервирует средства для начала работы</p>
        </div>
      ) : (
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
    </div>
  );
}

/* ═══════════════════════════════════════
   MORE TAB (Audit)
   ═══════════════════════════════════════ */
function DealMoreTab({ dealId }: { dealId: string }) {
  const { data: auditLog = [] } = useDealAuditLog(dealId);
  const [showAll, setShowAll] = useState(false);
  const display = showAll ? auditLog : auditLog.slice(0, 10);
  const categoryIcons: Record<string, any> = { terms: ScrollText, files: Files, payments: CreditCard, general: MessageCircle };

  return (
    <div className="p-5 space-y-4 max-w-[820px] mx-auto">
      <Accordion type="multiple" defaultValue={["audit"]}>
        <AccordionItem value="audit" className="border-border/50">
          <AccordionTrigger className="py-3 text-[15px] font-semibold hover:no-underline">Журнал событий</AccordionTrigger>
          <AccordionContent className="pb-4">
            {auditLog.length === 0 ? (
              <p className="text-[14px] text-muted-foreground py-4 text-center">Нет записей</p>
            ) : (
              <div className="space-y-0">
                {display.map((e: any, i: number) => {
                  const Icon = categoryIcons[e.category] || MessageCircle;
                  return (
                    <div key={e.id} className={cn("flex items-start gap-3 py-2.5", i > 0 && "border-t border-border/30")}>
                      <div className="w-7 h-7 rounded-full bg-muted/60 flex items-center justify-center shrink-0 mt-0.5">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] text-foreground">{e.action}</p>
                        <p className="text-[12px] text-muted-foreground">{fmtDateTime(e.created_at)}</p>
                      </div>
                    </div>
                  );
                })}
                {auditLog.length > 10 && !showAll && (
                  <button onClick={() => setShowAll(true)} className="text-[13px] text-primary hover:underline pt-2">
                    Показать все ({auditLog.length})
                  </button>
                )}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

/* ═══════════════════════════════════════
   REQUEST DETAILS MODAL
   ═══════════════════════════════════════ */
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
      await supabase.from("deals").update({ status: "briefing" }).eq("id", dealId);
      logEvent.mutate({ dealId, action: `Запрос файлов: ${selected.join(", ")}`, category: "files" });

      // Notify advertiser
      const { data: deal } = await supabase.from("deals").select("advertiser_id, title").eq("id", dealId).single();
      if (deal?.advertiser_id) {
        await supabase.from("notifications").insert({
          user_id: deal.advertiser_id, title: "Запрос файлов",
          message: `Автор запрашивает файлы для сделки «${deal.title}»: ${selected.join(", ")}`,
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

/* ═══════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════ */
export default function CreatorDealWorkspace() {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const logEvent = useLogDealEvent();

  const [activeTab, setActiveTab] = useState<DealTab>("chat");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [showFileRequestModal, setShowFileRequestModal] = useState(false);

  /* ── Data ── */
  const { data: deal, isLoading } = useQuery({
    queryKey: ["creator-deal", dealId],
    queryFn: async () => {
      if (!dealId) return null;
      const { data, error } = await supabase.from("deals").select("*").eq("id", dealId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!dealId,
  });

  const { data: advertiserProfile } = useQuery({
    queryKey: ["adv-profile-deal", deal?.advertiser_id],
    queryFn: async () => {
      if (!deal?.advertiser_id) return null;
      const { data } = await supabase.from("profiles").select("display_name, avatar_url").eq("user_id", deal.advertiser_id).single();
      return data;
    },
    enabled: !!deal?.advertiser_id,
  });

  const { data: brand } = useQuery({
    queryKey: ["adv-brand-deal", deal?.advertiser_id],
    queryFn: async () => {
      if (!deal?.advertiser_id) return null;
      const { data } = await supabase.rpc("get_advertiser_brand", { p_user_id: deal.advertiser_id });
      return data?.[0] || null;
    },
    enabled: !!deal?.advertiser_id,
  });

  useRealtimeAuditLog(dealId);
  useRealtimeEscrow(dealId);

  const advertiserName = brand?.brand_name || advertiserProfile?.display_name || deal?.advertiser_name || "Рекламодатель";
  const st = deal?.status || "briefing";
  const stLabel = statusLabels[st] || st;
  const stColor = statusColors[st] || "bg-muted text-muted-foreground border-muted-foreground/20";

  const isWaitingInputs = st === "briefing" || st === "waiting_inputs";
  const isInProgress = st === "in_progress";

  /* ── Request details actions ── */
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

  /* ── Start work / Submit draft ── */
  const handleStartWork = async () => {
    if (!user || !deal) return;
    await supabase.from("deals").update({ status: "in_progress" }).eq("id", deal.id);
    logEvent.mutate({ dealId: deal.id, action: "Автор начал работу", category: "general" });
    toast.success("Статус обновлён: В работе");
    qc.invalidateQueries({ queryKey: ["creator-deal", dealId] });
  };

  const handleSubmitDraft = async () => {
    if (!user || !deal) return;
    await supabase.from("deals").update({ status: "review" }).eq("id", deal.id);
    logEvent.mutate({ dealId: deal.id, action: "Автор отправил черновик на проверку", category: "files" });
    if (deal.advertiser_id) {
      await supabase.from("notifications").insert({ user_id: deal.advertiser_id, title: "Черновик отправлен", message: `Автор отправил черновик для проверки «${deal.title}»`, type: "deal", link: "/ad-studio" });
    }
    toast.success("Черновик отправлен на проверку");
    qc.invalidateQueries({ queryKey: ["creator-deal", dealId] });
  };

  /* ── Loading / not found ── */
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
          <p className="text-[15px] text-muted-foreground">Сделка не найдена</p>
          <Button variant="outline" onClick={() => navigate("/marketplace")}><ArrowLeft className="h-4 w-4 mr-2" /> Назад</Button>
        </div>
      </PageTransition>
    );
  }

  const tabs: { value: DealTab; label: string; icon: any }[] = [
    { value: "chat", label: "Чат", icon: MessageCircle },
    { value: "terms", label: "Условия", icon: ScrollText },
    { value: "files", label: "Файлы", icon: Files },
    { value: "payments", label: "Оплата", icon: CreditCard },
    { value: "more", label: "Ещё", icon: MoreVertical },
  ];

  // Waiting banner
  const showWaitingBanner = st === "briefing";

  return (
    <PageTransition>
      <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
        {/* ── Header ── */}
        <div className="border-b border-border bg-card">
          <div className="max-w-[1100px] mx-auto px-6 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate("/marketplace")}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <h1 className="text-[18px] font-bold text-foreground truncate">{advertiserName}</h1>
                <Badge variant="outline" className={cn("text-[11px] font-medium shrink-0 border", stColor)}>{stLabel}</Badge>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {/* Primary CTA */}
                {isWaitingInputs && (
                  <Button size="sm" className="text-[14px] h-9" onClick={handleStartWork}>
                    <PlayCircle className="h-4 w-4 mr-1.5" /> Начать работу
                  </Button>
                )}
                {isInProgress && (
                  <Button size="sm" className="text-[14px] h-9" onClick={handleSubmitDraft}>
                    <Upload className="h-4 w-4 mr-1.5" /> Отправить черновик
                  </Button>
                )}
                {st === "review" && (
                  <Badge variant="outline" className="text-[13px] py-1 px-2.5 border-warning/30 text-warning">
                    <Clock className="h-3.5 w-3.5 mr-1" /> На проверке
                  </Badge>
                )}

                {/* Request details dropdown */}
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
                    <DropdownMenuItem className="text-[14px]"><Download className="h-4 w-4 mr-2" /> Экспорт</DropdownMenuItem>
                    <DropdownMenuItem className="text-[14px]"><Archive className="h-4 w-4 mr-2" /> Архивировать</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive focus:text-destructive text-[14px]">
                      <AlertTriangle className="h-4 w-4 mr-2" /> Открыть спор
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Meta line */}
            <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
              <CollapsibleTrigger className="flex items-center gap-1.5 mt-1 text-[13px] text-muted-foreground hover:text-foreground transition-colors">
                {detailsOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                <span>Детали</span>
                {!detailsOpen && (
                  <span className="text-muted-foreground/60 ml-1">
                    — {deal.title} · {(deal.budget || 0).toLocaleString()} ₽
                    {deal.deadline && ` · до ${fmtDate(deal.deadline)}`}
                  </span>
                )}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[15px] pb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Сумма:</span>
                    <span className="font-semibold">{(deal.budget || 0).toLocaleString()} ₽</span>
                  </div>
                  {deal.deadline && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Дедлайн:</span>
                      <span className="font-medium flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {fmtDate(deal.deadline)}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Рекламодатель:</span>
                    <span>{advertiserName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5 text-green-500" /> Безопасная сделка
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">ID:</span>
                    <button className="flex items-center gap-1 hover:text-foreground font-mono text-[12px] text-muted-foreground"
                      onClick={() => { navigator.clipboard.writeText(deal.id); toast.success("ID скопирован"); }}>
                      #{deal.id.slice(0, 8)} <ClipboardCopy className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>

        {/* ── Waiting banner ── */}
        {showWaitingBanner && (
          <div className="border-b border-warning/30 bg-warning/5 px-6 py-2">
            <div className="max-w-[1100px] mx-auto flex items-center gap-2 text-[13px]">
              <Clock className="h-4 w-4 text-warning shrink-0" />
              <span className="text-warning font-medium">Подготовка к работе</span>
              <span className="text-muted-foreground">— запросите у рекламодателя недостающие материалы или начните работу</span>
            </div>
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="border-b border-border bg-card">
          <div className="max-w-[1100px] mx-auto px-6">
            <div className="flex items-center gap-0">
              {tabs.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 h-10 text-[15px] font-medium border-b-2 transition-colors",
                    activeTab === tab.value
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Next step hint */}
            {st === "in_progress" && (
              <div className="pb-2 -mt-0.5">
                <p className="text-[13px] text-muted-foreground">
                  <span className="text-primary font-medium">→</span> Загрузите черновик и отправьте на проверку
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Tab content ── */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "chat" && <DealChatTab dealId={deal.id} />}
          {activeTab === "terms" && <DealTermsTab dealId={deal.id} />}
          {activeTab === "files" && <DealFilesTab dealId={deal.id} />}
          {activeTab === "payments" && <DealPaymentsTab dealId={deal.id} />}
          {activeTab === "more" && <DealMoreTab dealId={deal.id} />}
        </div>
      </div>

      {/* File request modal */}
      <RequestFilesModal open={showFileRequestModal} onClose={() => setShowFileRequestModal(false)} dealId={deal.id} />
    </PageTransition>
  );
}
