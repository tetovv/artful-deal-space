import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Search, Sparkles, Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function Ask() {
  const [query, setQuery] = useState("");
  const [useWorkplace, setUseWorkplace] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    console.log("[analytics] ask_opened");
  }, []);

  const handleToggle = (val: boolean) => {
    setUseWorkplace(val);
    console.log(`[analytics] toggle_workplace_${val ? "on" : "off"}`);
  };

  const handleSubmit = async () => {
    if (!query.trim() || submitting) return;
    console.log("[analytics] ask_submitted", { query, useWorkplace });
    setSubmitting(true);

    try {
      const session = (await supabase.auth.getSession()).data.session;
      const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ask-answer`;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      };
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const res = await fetch(baseUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({ question: query, includeWorkplace: useWorkplace }),
      });

      if (!res.ok) throw new Error("Request failed");
      const { queryId } = await res.json();
      navigate(`/ask/${queryId}`);
    } catch {
      toast.error("Не удалось отправить вопрос. Попробуйте снова.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 text-primary">
            <Sparkles className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Спросите что угодно</h1>
          <p className="text-muted-foreground text-sm">
            Получите ответ на основе открытых и ваших источников
          </p>
        </div>

        <div className="space-y-3">
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Введите ваш вопрос…"
            className="min-h-[120px] text-base resize-none"
            disabled={submitting}
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
                disabled={submitting}
              />
              <Label htmlFor="workplace" className="text-sm text-muted-foreground cursor-pointer">
                Включить мои источники Workspace
              </Label>
            </div>

            <Button onClick={handleSubmit} disabled={!query.trim() || submitting} size="lg">
              {submitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              {submitting ? "Обработка…" : "Спросить"}
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Shield className="h-3.5 w-3.5" />
          <span>Используются только те источники, к которым у вас есть доступ.</span>
        </div>
      </div>
    </div>
  );
}
