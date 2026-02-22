import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen, Headphones, Zap, Clock, ListMusic,
  AlertTriangle, Loader2, Play,
} from "lucide-react";
import { toast } from "sonner";

const GOAL_LABELS: Record<string, string> = {
  understand: "Разобраться в теме",
  practical: "Получить шаги",
  background: "Фоновое прослушивание",
  overview: "Быстрый обзор",
};

const GOAL_ICONS: Record<string, React.ElementType> = {
  understand: BookOpen,
  practical: Zap,
  background: Headphones,
  overview: Clock,
};

export default function SharedTemplate() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [template, setTemplate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!slug) return;
    supabase
      .from("playlist_templates" as any)
      .select("*")
      .eq("share_slug", slug)
      .maybeSingle()
      .then(({ data }) => {
        setTemplate(data);
        setLoading(false);
      });
  }, [slug]);

  const handleGenerate = async () => {
    if (!template || !user || generating) return;
    setGenerating(true);

    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/goal-playlists`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({
            goalType: template.goal_type,
            timeBudget: template.time_budget,
            mixPrefs: template.mix_prefs || {},
            scope: template.scope,
          }),
        },
      );

      if (!res.ok) throw new Error("Failed");
      const data = await res.json();

      if (data.status === "empty") {
        toast.warning("Недостаточно контента");
        setGenerating(false);
        return;
      }

      // Record in run history
      await supabase.from("template_run_history" as any).insert({
        template_id: template.id,
        user_id: user.id,
        generated_playlist_id: data.id,
        status: "completed",
      });

      navigate(`/playlists/${data.id}`);
    } catch {
      toast.error("Ошибка генерации");
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 space-y-4">
        <Skeleton className="h-8 w-48 mx-auto" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-3">
        <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
        <p className="text-sm font-medium">Шаблон не найден</p>
      </div>
    );
  }

  const Icon = GOAL_ICONS[template.goal_type] || ListMusic;

  return (
    <div className="max-w-lg mx-auto px-4 py-16 space-y-6">
      <div className="text-center space-y-2">
        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-xl font-semibold text-foreground">{template.name}</h1>
        <p className="text-sm text-muted-foreground">Шаблон плейлиста</p>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Цель</span>
          <Badge variant="secondary">{GOAL_LABELS[template.goal_type] || template.goal_type}</Badge>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Бюджет времени</span>
          <span className="font-medium">{template.time_budget} мин</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Источники</span>
          <span className="font-medium capitalize">{template.scope}</span>
        </div>
      </Card>

      <p className="text-xs text-center text-muted-foreground">
        Плейлист будет создан на основе вашего доступа к контенту. Платный контент будет заменён доступными аналогами.
      </p>

      <Button className="w-full" onClick={handleGenerate} disabled={generating}>
        {generating ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Генерируем…</>
        ) : (
          <><Play className="h-4 w-4 mr-2" />Создать плейлист по шаблону</>
        )}
      </Button>
    </div>
  );
}
