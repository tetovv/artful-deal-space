import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  ExternalLink, Upload, CheckCircle2, AlertTriangle, Loader2, Clock, Link2,
  CreditCard, Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EscrowStepIndicator } from "./EscrowStepIndicator";
import {
  type EscrowState, getEscrowStateLabel,
  useSubmitProof, useConfirmPublication, useLockEscrowDispute, useExecutePayout,
} from "@/hooks/useEscrowPayout";
import { useAuth } from "@/contexts/AuthContext";

interface EscrowPayoutSectionProps {
  escrowItem: any;
  deal: any;
  isCreator: boolean;
  isAdvertiser: boolean;
}

export function EscrowPayoutSection({ escrowItem, deal, isCreator, isAdvertiser }: EscrowPayoutSectionProps) {
  const { user } = useAuth();
  const escrowState = (escrowItem.escrow_state || "FUNDS_RESERVED") as EscrowState;
  const submitProof = useSubmitProof();
  const confirmPub = useConfirmPublication();
  const lockDispute = useLockEscrowDispute();
  const executePayout = useExecutePayout();

  const [showProofModal, setShowProofModal] = useState(false);
  const [proofUrl, setProofUrl] = useState("");
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");

  const placementDays = deal.placement_duration_days;
  const activeEndsAt = escrowItem.active_ends_at;
  const activeStartedAt = escrowItem.active_started_at;

  // Check if active period expired → auto-eligible for payout
  const isExpired = activeEndsAt && new Date(activeEndsAt).getTime() <= Date.now();
  const canPayout = escrowState === "PAYOUT_READY" || (escrowState === "ACTIVE_PERIOD" && isExpired);
  const canDispute = escrowState === "ACTIVE_PERIOD" || escrowState === "PAYOUT_READY";

  return (
    <Card className="border-primary/20">
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <span className="text-[15px] font-semibold text-foreground">Безопасная сделка</span>
          </div>
          <Badge variant="outline" className={cn("text-[11px]",
            escrowState === "PAID_OUT" ? "bg-green-500/10 text-green-500 border-green-500/30" :
            escrowState === "DISPUTE_LOCKED" ? "bg-destructive/10 text-destructive border-destructive/30" :
            escrowState === "PAYOUT_READY" ? "bg-green-500/10 text-green-500 border-green-500/30" :
            "bg-primary/10 text-primary border-primary/30"
          )}>
            {getEscrowStateLabel(escrowState)}
          </Badge>
        </div>

        {/* Step indicator */}
        <EscrowStepIndicator
          currentState={escrowState}
          activeEndsAt={activeEndsAt}
          activeStartedAt={activeStartedAt}
        />

        {/* Amount info */}
        <div className="flex items-center justify-between text-[14px]">
          <span className="text-muted-foreground">Зарезервировано</span>
          <span className="font-bold text-foreground">{escrowItem.amount?.toLocaleString("ru-RU")} ₽</span>
        </div>
        {escrowItem.payout_amount > 0 && (
          <div className="flex items-center justify-between text-[14px]">
            <span className="text-muted-foreground">Выплата (за вычетом комиссии)</span>
            <span className="font-bold text-green-500">{escrowItem.payout_amount?.toLocaleString("ru-RU")} ₽</span>
          </div>
        )}
        {escrowItem.platform_fee > 0 && (
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-muted-foreground/60">Комиссия платформы</span>
            <span className="text-muted-foreground/60">{escrowItem.platform_fee?.toLocaleString("ru-RU")} ₽</span>
          </div>
        )}

        {/* Publication URL */}
        {escrowItem.publication_url && (
          <div className="flex items-center gap-2 text-[13px]">
            <Link2 className="h-3.5 w-3.5 text-primary shrink-0" />
            <a href={escrowItem.publication_url} target="_blank" rel="noopener noreferrer"
              className="text-primary hover:underline truncate">
              {escrowItem.publication_url}
            </a>
            <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
          </div>
        )}

        {/* Timestamps */}
        {activeStartedAt && (
          <div className="flex items-center gap-4 text-[12px] text-muted-foreground">
            <span>Публикация: {new Date(activeStartedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
            {activeEndsAt && placementDays && (
              <span>До: {new Date(activeEndsAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</span>
            )}
          </div>
        )}
        {escrowItem.paid_out_at && (
          <div className="flex items-center gap-1.5 text-[12px] text-green-500">
            <CheckCircle2 className="h-3 w-3" />
            <span>Выплачено: {new Date(escrowItem.paid_out_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        )}

        {/* ── ACTIONS ── */}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          {/* Creator: Submit proof */}
          {isCreator && escrowState === "FUNDS_RESERVED" && (
            <Button size="sm" className="text-[14px] h-9" onClick={() => setShowProofModal(true)}>
              <Upload className="h-4 w-4 mr-1.5" />
              Подтвердить публикацию
            </Button>
          )}

          {/* Advertiser: Confirm publication (optional) */}
          {isAdvertiser && escrowState === "ACTIVE_PERIOD" && !isExpired && (
            <Button size="sm" variant="outline" className="text-[14px] h-9"
              onClick={() => confirmPub.mutate({ escrowId: escrowItem.id, dealId: deal.id })}
              disabled={confirmPub.isPending}>
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              Подтвердить публикацию
            </Button>
          )}

          {/* Advertiser: Dispute during active period */}
          {isAdvertiser && canDispute && (
            <Button size="sm" variant="ghost" className="text-[14px] h-9 text-destructive hover:text-destructive"
              onClick={() => setShowDisputeModal(true)}>
              <AlertTriangle className="h-4 w-4 mr-1.5" />
              Проблема
            </Button>
          )}

          {/* Payout button (when eligible) */}
          {canPayout && escrowState !== ("DISPUTE_LOCKED" as EscrowState) && (
            <Button size="sm" className="text-[14px] h-9 bg-green-600 hover:bg-green-700"
              onClick={() => executePayout.mutate({ escrowId: escrowItem.id, dealId: deal.id })}
              disabled={executePayout.isPending}>
              {executePayout.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <CreditCard className="h-4 w-4 mr-1.5" />}
              Выплатить автору
            </Button>
          )}
        </div>
      </CardContent>

      {/* ── Proof submission modal ── */}
      <Dialog open={showProofModal} onOpenChange={setShowProofModal}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" /> Подтверждение публикации
            </DialogTitle>
            <DialogDescription>Укажите ссылку на опубликованный материал</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium">Ссылка на публикацию <span className="text-destructive">*</span></label>
              <Input value={proofUrl} onChange={(e) => setProofUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..." className="text-[14px]" />
            </div>
            {placementDays && (
              <div className="rounded-lg bg-muted/50 px-3 py-2 text-[13px] text-muted-foreground flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>Материал должен оставаться опубликованным {placementDays} дн.</span>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setShowProofModal(false)}>Отмена</Button>
              <Button size="sm" className="h-10 px-5" disabled={!proofUrl.trim() || submitProof.isPending}
                onClick={() => {
                  submitProof.mutate({
                    escrowId: escrowItem.id,
                    dealId: deal.id,
                    publicationUrl: proofUrl.trim(),
                    placementDurationDays: placementDays,
                  });
                  setShowProofModal(false);
                  setProofUrl("");
                }}>
                {submitProof.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
                Подтвердить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dispute modal ── */}
      <Dialog open={showDisputeModal} onOpenChange={setShowDisputeModal}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Открыть проблему
            </DialogTitle>
            <DialogDescription>Выплата будет приостановлена до решения проблемы</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Textarea value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="Опишите проблему…" rows={3} className="text-[14px]" />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowDisputeModal(false)}>Отмена</Button>
              <Button size="sm" variant="destructive" disabled={!disputeReason.trim() || lockDispute.isPending}
                onClick={() => {
                  lockDispute.mutate({
                    escrowId: escrowItem.id,
                    dealId: deal.id,
                    reason: disputeReason.trim(),
                  });
                  setShowDisputeModal(false);
                  setDisputeReason("");
                }}>
                Приостановить выплату
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
