import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Search, Sparkles, Shield } from "lucide-react";
import { toast } from "sonner";

export default function Ask() {
  const [query, setQuery] = useState("");
  const [useWorkplace, setUseWorkplace] = useState(false);

  useEffect(() => {
    console.log("[analytics] ask_opened");
  }, []);

  const handleToggle = (val: boolean) => {
    setUseWorkplace(val);
    console.log(`[analytics] toggle_workplace_${val ? "on" : "off"}`);
  };

  const handleSubmit = () => {
    if (!query.trim()) return;
    console.log("[analytics] ask_submitted", { query, useWorkplace });
    toast.info("Ответ генерируется…");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 text-primary">
            <Sparkles className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Спросите что угодно</h1>
          <p className="text-muted-foreground text-sm">
            Получите ответ на основе открытых и ваших источников
          </p>
        </div>

        {/* Input */}
        <div className="space-y-3">
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Введите ваш вопрос…"
            className="min-h-[120px] text-base resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
            }}
          />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                id="workplace"
                checked={useWorkplace}
                onCheckedChange={handleToggle}
              />
              <Label htmlFor="workplace" className="text-sm text-muted-foreground cursor-pointer">
                Включить мои источники Workspace
              </Label>
            </div>

            <Button onClick={handleSubmit} disabled={!query.trim()} size="lg">
              <Search className="h-4 w-4 mr-2" />
              Спросить
            </Button>
          </div>
        </div>

        {/* Privacy note */}
        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Shield className="h-3.5 w-3.5" />
          <span>Используются только те источники, к которым у вас есть доступ.</span>
        </div>
      </div>
    </div>
  );
}
