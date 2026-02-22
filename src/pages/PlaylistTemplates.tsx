import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen, Headphones, Zap, Clock, ListMusic, Plus,
  RefreshCw, Share2, Loader2, Trash2, Copy,
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

interface Template {
  id: string;
  name: string;
  goal_type: string;
  time_budget: number;
  mix_prefs: any;
  scope: string;
  share_slug: string | null;
  created_at: string;
}

export default function PlaylistTemplates() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("playlist_templates" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setTemplates((data as any as Template[]) || []);
        setLoading(false);
      });
  }, [user]);

  const handleRegenerate = async (t: Template) => {
    if (regeneratingId) return;
    setRegeneratingId(t.id);
    console.log("[analytics] template_regenerated");

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
            goalType: t.goal_type,
            timeBudget: t.time_budget,
            mixPrefs: t.mix_prefs || {},
            scope: t.scope,
          }),
        },
      );

      if (!res.ok) throw new Error("Failed");
      const data = await res.json();

      if (data.status === "empty") {
        toast.warning("Недостаточно контента");
        return;
      }

      // Record run history
      await supabase.from("template_run_history" as any).insert({
        template_id: t.id,
        user_id: user!.id,
        generated_playlist_id: data.id,
        status: "completed",
      });

      navigate(`/playlists/${data.id}`);
    } catch {
      toast.error("Ошибка генерации плейлиста");
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleShare = async (t: Template) => {
    if (t.share_slug) {
      const url = `${window.location.origin}/playlists/template/${t.share_slug}`;
      await navigator.clipboard.writeText(url);
      toast.success("Ссылка скопирована");
      console.log("[analytics] template_shared");
      return;
    }

    const slug = crypto.randomUUID().slice(0, 8);
    const { error } = await supabase
      .from("playlist_templates" as any)
      .update({ share_slug: slug })
      .eq("id", t.id);

    if (error) {
      toast.error("Ошибка создания ссылки");
      return;
    }

    setTemplates(prev => prev.map(x => x.id === t.id ? { ...x, share_slug: slug } : x));
    const url = `${window.location.origin}/playlists/template/${slug}`;
    await navigator.clipboard.writeText(url);
    toast.success("Ссылка скопирована");
    console.log("[analytics] template_shared");
  };

  const handleDelete = async (id: string) => {
    await supabase.from("playlist_templates" as any).delete().eq("id", id);
    setTemplates(prev => prev.filter(t => t.id !== id));
    toast.success("Шаблон удалён");
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ListMusic className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Шаблоны плейлистов</h1>
            <p className="text-sm text-muted-foreground">Сохранённые настройки для быстрого создания</p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/playlists/new"><Plus className="h-3.5 w-3.5 mr-1.5" />Новый</Link>
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card className="p-6 text-center space-y-3">
          <ListMusic className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">У вас пока нет шаблонов.</p>
          <p className="text-xs text-muted-foreground">Создайте плейлист и сохраните его как шаблон.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {templates.map(t => {
            const Icon = GOAL_ICONS[t.goal_type] || ListMusic;
            const isRegenerating = regeneratingId === t.id;
            return (
              <Card key={t.id} className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-foreground truncate">{t.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{GOAL_LABELS[t.goal_type] || t.goal_type}</span>
                      <span>·</span>
                      <span>{t.time_budget} мин</span>
                    </div>
                  </div>
                  {t.share_slug && (
                    <Badge variant="secondary" className="text-[10px] shrink-0">Shared</Badge>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => handleRegenerate(t)}
                    disabled={isRegenerating}
                  >
                    {isRegenerating
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                    Сгенерировать
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleShare(t)}>
                    {t.share_slug ? <Copy className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(t.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
