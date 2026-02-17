import { ratings, deals, users } from "@/data/mockData";
import { Star, TrendingUp, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const TrustRating = () => {
  const [showDispute, setShowDispute] = useState(false);

  const completedDeals = deals.filter((d) => d.status === "completed");

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Рейтинг доверия</h1>
        <p className="text-sm text-muted-foreground">Оценки рекламодателей после подтверждённых сделок</p>
      </div>

      {/* Rating cards */}
      <div className="space-y-4">
        {ratings.map((r) => {
          const deal = deals.find((d) => d.id === r.dealId);
          const ratedUser = users.find((u) => u.id === r.toId);
          return (
            <div key={r.id} className="rounded-xl border border-border bg-card p-5 animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Star className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-card-foreground">{ratedUser?.name || r.toId}</p>
                    <p className="text-xs text-muted-foreground">Сделка: {deal?.title}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-warning">{r.overall.toFixed(1)}</p>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className={`h-3 w-3 ${s <= Math.round(r.overall) ? "text-warning fill-warning" : "text-muted"}`} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Коммуникация", value: r.communication },
                  { label: "Оплата", value: r.payment },
                  { label: "Профессионализм", value: r.professionalism },
                ].map((criterion) => (
                  <div key={criterion.label}>
                    <p className="text-[11px] text-muted-foreground mb-1">{criterion.label}</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-warning rounded-full" style={{ width: `${(criterion.value / 5) * 100}%` }} />
                      </div>
                      <span className="text-xs font-medium text-card-foreground">{criterion.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Dispute */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <h3 className="font-semibold text-sm text-card-foreground">Открыть спор</h3>
        </div>
        <p className="text-xs text-muted-foreground">Если сделка прошла с нарушениями, вы можете открыть спор для рассмотрения службой поддержки.</p>
        <Button variant="outline" size="sm" onClick={() => setShowDispute(!showDispute)}>
          {showDispute ? "Скрыть" : "Открыть спор"}
        </Button>
        {showDispute && (
          <div className="mt-3 p-4 rounded-lg bg-muted space-y-2 animate-fade-in">
            <p className="text-xs text-muted-foreground">Выберите сделку и опишите проблему. Ваш запрос будет передан в службу поддержки.</p>
            <select className="w-full p-2 rounded-lg bg-background border border-border text-sm text-foreground">
              {completedDeals.map((d) => (
                <option key={d.id} value={d.id}>{d.title}</option>
              ))}
            </select>
            <Button size="sm" className="mt-2">Отправить</Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrustRating;
