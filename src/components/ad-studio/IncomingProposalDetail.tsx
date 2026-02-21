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
import {
  CheckCircle2, MoreVertical, Download, FileText, Shield, CalendarDays,
  Video, FileEdit, Mic, Loader2, Send, ArrowLeftRight, XCircle,
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

  // Latest terms
  const latestTerms = useMemo(() => {
    if (!terms.length) return null;
    return terms[terms.length - 1];
  }, [terms]);

  const termsFields = useMemo(() => {
    if (!latestTerms) return null;
    return latestTerms.fields as Record<string, string>;
  }, [latestTerms]);

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

      toast.success("Предложение принято! Сделка переведена в работу.");
      qc.invalidateQueries({ queryKey: ["creator-incoming-deals"] });
      onClose();
      // Navigate to deal workspace
      navigate("/ad-studio", { state: { openDealId: deal.id } });
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
  const canRespond = isPending || advertiserCountered;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-[720px] max-h-[90vh] p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-0">
            <DialogTitle className="text-lg sr-only">Детали предложения</DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(90vh-80px)]">
            <div className="px-6 pb-6 space-y-5">

              {/* ── Advertiser counter-offer banner ── */}
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

              {/* ── Section 1: Header ── */}
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
                        <span className="text-[15px] font-semibold text-foreground truncate">
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
                    <Badge variant="outline" className={cn("text-[11px] border", st.cls)}>{st.label}</Badge>
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

                {/* Budget + deadline row */}
                <div className="flex items-center gap-4 text-sm">
                  <span className="font-bold text-foreground text-lg">{(deal.budget || 0).toLocaleString()} ₽</span>
                  {deal.deadline && (
                    <span className="text-muted-foreground flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      до {new Date(deal.deadline).toLocaleDateString("ru-RU")}
                    </span>
                  )}
                </div>
              </div>

              <Separator />

              {/* ── Section 2: Brief content ── */}
              <div className="space-y-2">
                <h3 className="text-[14px] font-semibold text-foreground">Бриф</h3>
                <p className="text-[14px] text-foreground/90 leading-relaxed whitespace-pre-wrap">
                  {deal.description || termsFields?.brief || "Нет описания"}
                </p>
              </div>

              <Separator />

              {/* ── Section 3: Placement details ── */}
              <div className="space-y-3">
                <h3 className="text-[14px] font-semibold text-foreground">Детали размещения</h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  <DetailRow label="Тип размещения" value={
                    <span className="flex items-center gap-1.5">
                      <PlacementIcon className="h-3.5 w-3.5 text-primary" />
                      {placement || "—"}
                    </span>
                  } />
                  <DetailRow label="Платформа" value={termsFields?.platform || "—"} />
                  <DetailRow label="Кол-во правок" value={termsFields?.revisions || "Не указано"} />
                  <DetailRow label="Критерии приёмки" value={termsFields?.acceptanceCriteria || "Не указано"} />
                </div>
              </div>

              {/* ── Section 4: Files ── */}
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

              <Separator />

              {/* ── Section 5: Marking ── */}
              <div className="space-y-2">
                <h3 className="text-[14px] font-semibold text-foreground">Маркировка</h3>
                <div className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2.5">
                  <Shield className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-[13px] text-foreground">
                    {termsFields?.markingResponsibility === "Рекламодатель"
                      ? "Маркировку обеспечивает рекламодатель"
                      : "Маркировка обеспечивается платформой"}
                  </span>
                </div>
              </div>

              {/* ── Counter-offer form ── */}
              {showCounterForm && (
                <>
                  <Separator />
                  <div className="space-y-3 bg-muted/20 rounded-xl p-4 border border-border">
                    <h3 className="text-[14px] font-semibold text-foreground flex items-center gap-2">
                      <ArrowLeftRight className="h-4 w-4 text-primary" />
                      Предложить изменения
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[12px] font-medium text-muted-foreground">Ваша цена (₽)</label>
                        <Input
                          type="number"
                          value={counterBudget}
                          onChange={(e) => setCounterBudget(e.target.value)}
                          placeholder={String(deal.budget || 0)}
                          className="h-8 text-[13px]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[12px] font-medium text-muted-foreground">Дедлайн</label>
                        <Input
                          type="date"
                          value={counterDeadline}
                          onChange={(e) => setCounterDeadline(e.target.value)}
                          className="h-8 text-[13px]"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[12px] font-medium text-muted-foreground">
                        Сообщение <span className="text-destructive">*</span>
                      </label>
                      <Textarea
                        value={counterMessage}
                        onChange={(e) => setCounterMessage(e.target.value)}
                        placeholder="Объясните предлагаемые изменения..."
                        rows={3}
                        className="text-[13px]"
                      />
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-[13px]"
                        onClick={() => setShowCounterForm(false)}
                      >
                        Отмена
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 text-[13px] gap-1.5"
                        disabled={!counterMessage.trim() || submittingCounter}
                        onClick={handleCounterOffer}
                      >
                        {submittingCounter ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        Отправить
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>

          {/* ── Footer with max 2 actions ── */}
          {canRespond && !showCounterForm && (
            <div className="flex items-center justify-end gap-2.5 px-6 py-3.5 border-t border-border bg-card">
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5"
                onClick={() => setShowCounterForm(true)}
              >
                <ArrowLeftRight className="h-4 w-4" />
                Предложить изменения
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

      {/* ── Reject confirmation dialog ── */}
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

/* ─── Small helper component ─── */
function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className="text-[14px] font-medium text-foreground">{typeof value === "string" ? value : value}</span>
    </div>
  );
}
