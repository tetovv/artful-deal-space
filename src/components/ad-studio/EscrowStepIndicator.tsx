import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Clock, AlertTriangle, Loader2 } from "lucide-react";
import { type EscrowState, ESCROW_STEP_COMPACT, getEscrowStepIndex } from "@/hooks/useEscrowPayout";

interface EscrowStepIndicatorProps {
  currentState: EscrowState;
  activeEndsAt?: string | null;
  activeStartedAt?: string | null;
  className?: string;
}

export function EscrowStepIndicator({ currentState, activeEndsAt, activeStartedAt, className }: EscrowStepIndicatorProps) {
  const currentIdx = getEscrowStepIndex(currentState);
  const isDispute = currentState === "DISPUTE_LOCKED";
  const isRefunded = currentState === "REFUNDED";

  // Calculate remaining time
  const remainingMs = activeEndsAt ? new Date(activeEndsAt).getTime() - Date.now() : 0;
  const remainingDays = Math.max(0, Math.ceil(remainingMs / 86400000));
  const remainingHours = Math.max(0, Math.ceil(remainingMs / 3600000));
  const isExpired = remainingMs <= 0 && currentState === "ACTIVE_PERIOD";

  return (
    <div className={cn("space-y-2", className)}>
      {/* Step indicators */}
      <div className="flex items-center gap-0">
        {ESCROW_STEP_COMPACT.map((step, i) => {
          const isDone = i < currentIdx || currentState === "PAID_OUT";
          const isCurrent = i === currentIdx && currentState !== "PAID_OUT";
          const isFuture = i > currentIdx && currentState !== "PAID_OUT";

          return (
            <div key={step.key} className="flex items-center flex-1 min-w-0 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                {isDispute && isCurrent ? (
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                ) : isDone ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : isCurrent ? (
                  <Loader2 className="h-4 w-4 text-primary animate-spin" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground/30" />
                )}
                <span className={cn(
                  "text-[11px] font-medium whitespace-nowrap",
                  isDone ? "text-green-500" :
                  isCurrent ? (isDispute ? "text-destructive" : "text-primary") :
                  "text-muted-foreground/50"
                )}>
                  {isDispute && isCurrent ? "Спор" : step.label}
                </span>
              </div>
              {i < ESCROW_STEP_COMPACT.length - 1 && (
                <div className={cn(
                  "h-px flex-1 mx-1.5 mt-[-14px]",
                  isDone ? "bg-green-500/60" :
                  isCurrent ? "bg-primary/30" :
                  "bg-muted-foreground/15"
                )} />
              )}
            </div>
          );
        })}
      </div>

      {/* Time remaining badge */}
      {currentState === "ACTIVE_PERIOD" && activeEndsAt && !isExpired && (
        <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>
            Осталось: {remainingDays > 0 ? `${remainingDays} дн.` : `${remainingHours} ч.`}
            {activeEndsAt && (
              <span className="ml-1 text-muted-foreground/60">
                (до {new Date(activeEndsAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })})
              </span>
            )}
          </span>
        </div>
      )}

      {isExpired && (
        <div className="flex items-center gap-1.5 text-[12px] text-green-500 font-medium">
          <CheckCircle2 className="h-3 w-3" />
          <span>Период размещения завершён — готов к выплате</span>
        </div>
      )}

      {isDispute && (
        <div className="flex items-center gap-1.5 text-[12px] text-destructive font-medium">
          <AlertTriangle className="h-3 w-3" />
          <span>Выплата приостановлена — спор на рассмотрении</span>
        </div>
      )}

      {isRefunded && (
        <div className="flex items-center gap-1.5 text-[12px] text-destructive font-medium">
          <AlertTriangle className="h-3 w-3" />
          <span>Средства возвращены</span>
        </div>
      )}

      {currentState === "PAID_OUT" && (
        <div className="flex items-center gap-1.5 text-[12px] text-green-500 font-medium">
          <CheckCircle2 className="h-3 w-3" />
          <span>Выплата выполнена</span>
        </div>
      )}
    </div>
  );
}
