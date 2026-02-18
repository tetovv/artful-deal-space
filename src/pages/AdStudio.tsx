import { useState, useMemo } from "react";
import { deals, messages as allMessages } from "@/data/mockData";
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";
import { useAdvertiserScores } from "@/hooks/useAdvertiserScores";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Send, Paperclip, CheckCircle2, AlertTriangle, ShieldAlert } from "lucide-react";
import { Deal, DealStatus } from "@/types";

const statusColors: Record<DealStatus, string> = {
  pending: "bg-warning/10 text-warning",
  briefing: "bg-info/10 text-info",
  in_progress: "bg-primary/10 text-primary",
  review: "bg-accent/10 text-accent",
  completed: "bg-success/10 text-success",
  disputed: "bg-destructive/10 text-destructive",
};

const statusLabels: Record<DealStatus, string> = {
  pending: "Ожидание",
  briefing: "Бриф",
  in_progress: "В работе",
  review: "На проверке",
  completed: "Завершено",
  disputed: "Спор",
};

const AdStudio = () => {
  const [selectedDeal, setSelectedDeal] = useState<Deal>(deals[0]);
  useRealtimeMessages(selectedDeal?.id);
  const dealMessages = allMessages.filter((m) => m.dealId === selectedDeal.id);
  const [newMsg, setNewMsg] = useState("");
  const { scores: advertiserScores } = useAdvertiserScores();

  // Sort deals: low-score advertisers go to the bottom
  const sortedDeals = useMemo(() => {
    return [...deals].sort((a, b) => {
      const aLow = advertiserScores.get(a.advertiserId)?.isLowScore ? 1 : 0;
      const bLow = advertiserScores.get(b.advertiserId)?.isLowScore ? 1 : 0;
      return aLow - bLow;
    });
  }, [advertiserScores]);

  const selectedAdvertiserScore = advertiserScores.get(selectedDeal.advertiserId);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] max-h-[calc(100vh-3.5rem)]">
      {/* Deals list */}
      <div className="w-72 border-r border-border bg-card overflow-y-auto shrink-0">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-foreground">Сделки</h2>
        </div>
        {sortedDeals.map((deal) => {
          const advScore = advertiserScores.get(deal.advertiserId);
          const isLow = advScore?.isLowScore;
          return (
            <div
              key={deal.id}
              onClick={() => setSelectedDeal(deal)}
              className={`p-4 border-b border-border cursor-pointer hover:bg-muted/50 transition-colors ${
                selectedDeal.id === deal.id ? "bg-muted/80" : ""
              } ${isLow ? "opacity-60" : ""}`}
            >
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-card-foreground truncate flex-1">{deal.title}</p>
                {isLow && (
                  <Tooltip>
                    <TooltipTrigger>
                      <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Низкий Partner Score ({advScore!.partnerScore.toFixed(1)})</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{deal.advertiserName} → {deal.creatorName}</p>
              <div className="flex items-center justify-between mt-2">
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${statusColors[deal.status]}`}>
                  {statusLabels[deal.status]}
                </span>
                <span className="text-[10px] text-muted-foreground">{deal.budget.toLocaleString()} ₽</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Chat + Deal details */}
      <div className="flex-1 flex flex-col">
        {/* Deal header */}
        <div className="p-4 border-b border-border bg-card">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">{selectedDeal.title}</h3>
              <p className="text-xs text-muted-foreground">{selectedDeal.description}</p>
            </div>
            <div className="flex items-center gap-2">
              {selectedAdvertiserScore?.isLowScore && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-destructive/10 text-destructive text-xs font-medium">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Partner Score: {selectedAdvertiserScore.partnerScore.toFixed(1)}
                </div>
              )}
              <span className={`text-xs font-medium px-2 py-1 rounded ${statusColors[selectedDeal.status]}`}>
                {statusLabels[selectedDeal.status]}
              </span>
              {selectedDeal.status === "in_progress" && (
                <Button size="sm" variant="outline"><CheckCircle2 className="h-3 w-3 mr-1" />Подтвердить</Button>
              )}
            </div>
          </div>

          {/* Milestones */}
          <div className="flex gap-2 mt-3">
            {selectedDeal.milestones.map((m, i) => (
              <div key={m.id} className="flex items-center gap-1.5">
                <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  m.completed ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  {m.completed ? "✓" : i + 1}
                </div>
                <span className="text-[11px] text-muted-foreground hidden lg:inline">{m.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background">
          {dealMessages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.senderId === "u1" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[70%] rounded-xl p-3 text-sm ${
                msg.senderId === "u1"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-card-foreground border border-border"
              }`}>
                <p className="text-[10px] font-medium mb-1 opacity-70">{msg.senderName}</p>
                <p>{msg.content}</p>
                {msg.attachment && (
                  <div className="mt-2 flex items-center gap-1 text-[10px] opacity-70">
                    <Paperclip className="h-3 w-3" /> {msg.attachment}
                  </div>
                )}
                <p className="text-[10px] opacity-50 mt-1 text-right">
                  {new Date(msg.timestamp).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}
          {dealMessages.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-12">Нет сообщений</div>
          )}
        </div>

        {/* Input */}
        <div className="p-3 border-t border-border bg-card flex gap-2">
          <Button size="icon" variant="ghost"><Paperclip className="h-4 w-4" /></Button>
          <Input
            value={newMsg}
            onChange={(e) => setNewMsg(e.target.value)}
            placeholder="Написать сообщение..."
            className="flex-1 bg-background"
          />
          <Button size="icon"><Send className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
};

export default AdStudio;
