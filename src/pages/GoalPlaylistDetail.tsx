import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, ListMusic, Play, Video, Music, FileText,
  BookOpen, Layout, Clock, AlertTriangle, CheckCircle2,
  SkipForward, Lock, RefreshCw, Loader2, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

/* ── constants ── */

const TYPE_ICONS: Record<string, React.ElementType> = {
  video: Video, audio: Music, podcast: Music, post: FileText, book: BookOpen, template: Layout,
};

const GOAL_LABELS: Record<string, string> = {
  understand: "Разобраться в теме",
  practical: "Получить шаги",
  background: "Фоновое прослушивание",
  overview: "Быстрый обзор",
};

const formatMinutes = (sec: number) => {
  const m = Math.round(sec / 60);
  return m < 1 ? "<1 мин" : `${m} мин`;
};

/* ── types ── */

interface PlaylistItem {
  id: string;
  content_type: string;
  content_id: string | null;
  est_time: number;
  reason: string;
  sort_order: number;
  title?: string;
  creator_name?: string;
  access: "allowed" | "locked";
}

/* ── component ── */

export default function GoalPlaylistDetail() {
  const { playlistId } = useParams<{ playlistId: string }>();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [playlist, setPlaylist] = useState<any>(null);
  const [items, setItems] = useState<PlaylistItem[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [currentIdx, setCurrentIdx] = useState(0);
  const [swapping, setSwapping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  /* ── load data + restore progress ── */

  useEffect(() => {
    if (!playlistId || !user) return;
    let cancelled = false;

    const load = async () => {
      try {
        const session = (await supabase.auth.getSession()).data.session;
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/goal-playlists/${playlistId}`,
          {
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
            },
          },
        );
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        if (cancelled) return;

        setPlaylist(data.playlist);

        // Enrich items
        const rawItems: any[] = data.items || [];
        const contentIds = rawItems.map(i => i.content_id).filter(Boolean) as string[];

        let contentMap: Record<string, any> = {};
        if (contentIds.length > 0) {
          const { data: contents } = await supabase
            .from("content_items")
            .select("id, title, creator_name, monetization_type, price, creator_id")
            .in("id", contentIds);
          if (contents) {
            contentMap = Object.fromEntries(contents.map(c => [c.id, c]));
          }
        }

        // Entitlement check
        const { data: purchases } = await supabase
          .from("purchases" as any)
          .select("content_id")
          .eq("user_id", user.id);
        const purchasedIds = new Set((purchases || []).map((p: any) => p.content_id));

        const { data: subs } = await supabase
          .from("subscriptions" as any)
          .select("creator_id")
          .eq("user_id", user.id);
        const subscribedIds = new Set((subs || []).map((s: any) => s.creator_id));

        const enriched: PlaylistItem[] = rawItems.map(i => {
          const c = i.content_id ? contentMap[i.content_id] : null;
          let access: "allowed" | "locked" = "allowed";
          if (c && c.monetization_type !== "free" && c.price && c.price > 0) {
            if (!purchasedIds.has(c.id) && !subscribedIds.has(c.creator_id)) {
              access = "locked";
            }
          }
          return {
            ...i,
            title: c?.title || "Контент",
            creator_name: c?.creator_name || "",
            access,
          };
        });

        setItems(enriched);

        // Restore progress
        const { data: progress } = await supabase
          .from("playlist_progress" as any)
          .select("*")
          .eq("playlist_id", playlistId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (progress) {
          const p = progress as any;
          const done = new Set<string>(p.completed_items || []);
          setCompletedIds(done);
          // Find current index
          if (p.current_item_id) {
            const idx = enriched.findIndex(i => i.id === p.current_item_id);
            if (idx >= 0) setCurrentIdx(idx);
          }
          setStarted(true);
        }
      } catch {
        if (!cancelled) setError("Не удалось загрузить плейлист");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [playlistId, user]);

  /* ── derived state ── */

  const totalTime = useMemo(() => items.reduce((s, i) => s + i.est_time, 0), [items]);
  const completedTime = useMemo(
    () => items.filter(i => completedIds.has(i.id)).reduce((s, i) => s + i.est_time, 0),
    [items, completedIds],
  );
  const remainingTime = totalTime - completedTime;
  const budgetSec = (playlist?.time_budget || 20) * 60;
  const progressPct = totalTime > 0 ? Math.min((completedTime / totalTime) * 100, 100) : 0;
  const currentItem = items[currentIdx] || null;
  const allDone = items.length > 0 && completedIds.size >= items.length;

  /* ── persist progress ── */

  const saveProgress = useCallback(async (
    newCompleted: Set<string>,
    newCurrentId: string | null,
  ) => {
    if (!playlistId || !user) return;
    const completedArr = Array.from(newCompleted);
    const timeLeft = items
      .filter(i => !newCompleted.has(i.id))
      .reduce((s, i) => s + i.est_time, 0);

    await supabase.from("playlist_progress" as any).upsert({
      playlist_id: playlistId,
      user_id: user.id,
      current_item_id: newCurrentId,
      completed_items: completedArr,
      time_remaining: timeLeft,
      updated_at: new Date().toISOString(),
    }, { onConflict: "playlist_id,user_id" });
  }, [playlistId, user, items]);

  /* ── actions ── */

  const handleStart = () => {
    setStarted(true);
    // Jump to first non-completed
    const idx = items.findIndex(i => !completedIds.has(i.id));
    setCurrentIdx(idx >= 0 ? idx : 0);
    console.log("[analytics] playlist_started");
    if (items[0]) saveProgress(completedIds, items[idx >= 0 ? idx : 0]?.id || null);
  };

  const handleComplete = () => {
    if (!currentItem) return;
    const next = new Set(completedIds);
    next.add(currentItem.id);
    setCompletedIds(next);
    console.log("[analytics] item_completed");

    // Advance to next non-completed
    const nextIdx = items.findIndex((i, idx) => idx > currentIdx && !next.has(i.id));
    if (nextIdx >= 0) {
      setCurrentIdx(nextIdx);
      saveProgress(next, items[nextIdx].id);
    } else {
      // Try wrapping around
      const wrapIdx = items.findIndex(i => !next.has(i.id));
      if (wrapIdx >= 0) {
        setCurrentIdx(wrapIdx);
        saveProgress(next, items[wrapIdx].id);
      } else {
        saveProgress(next, null);
      }
    }
  };

  const handleSkip = () => {
    const nextIdx = items.findIndex((i, idx) => idx > currentIdx && !completedIds.has(i.id));
    if (nextIdx >= 0) {
      setCurrentIdx(nextIdx);
      saveProgress(completedIds, items[nextIdx].id);
    }
  };

  const handleSwap = async () => {
    if (!currentItem || !playlistId || swapping) return;
    setSwapping(true);
    console.log("[analytics] item_swapped");
    try {
      // Find an alternative: same type, not already in playlist
      const existingIds = new Set(items.map(i => i.content_id).filter(Boolean));
      const { data: alternatives } = await supabase
        .from("content_items")
        .select("id, title, type, creator_name, monetization_type, price, duration")
        .eq("type", currentItem.content_type)
        .eq("status", "published")
        .not("id", "in", `(${Array.from(existingIds).join(",")})`)
        .limit(5);

      // Pick the first free or accessible one
      const alt = (alternatives || []).find(
        (a: any) => a.monetization_type === "free" || !a.price || a.price === 0,
      ) || (alternatives || [])[0];

      if (!alt) {
        toast.info("Альтернатив не найдено");
        setSwapping(false);
        return;
      }

      // Update in DB
      await supabase.from("goal_playlist_items" as any).update({
        content_id: alt.id,
        content_type: alt.type,
        est_time: alt.duration || currentItem.est_time,
        reason: "Заменён пользователем",
      }).eq("id", currentItem.id);

      // Update local state
      setItems(prev => prev.map(i =>
        i.id === currentItem.id
          ? { ...i, content_id: alt.id, content_type: alt.type, title: alt.title, creator_name: alt.creator_name, est_time: alt.duration || i.est_time, reason: "Заменён пользователем", access: "allowed" as const }
          : i,
      ));

      toast.success("Элемент заменён");
    } catch {
      toast.error("Ошибка замены");
    } finally {
      setSwapping(false);
    }
  };

  /* ── render helpers ── */

  const renderContentView = (item: PlaylistItem) => {
    const isPlayable = item.content_type === "video" || item.content_type === "audio" || item.content_type === "podcast";
    const link = item.content_id ? `/product/${item.content_id}` : "#";

    if (item.access === "locked") {
      return (
        <Card className="p-6 border-destructive/30 bg-destructive/5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-destructive/10 flex items-center justify-center">
              <Lock className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-foreground">{item.title}</h3>
              <p className="text-xs text-muted-foreground">Требуется подписка или покупка</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{item.reason}</p>
          {(() => { console.log("[analytics] paywall_in_playlist"); return null; })()}
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" className="flex-1">
              <Link to={link}>Получить доступ</Link>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="flex-1"
              onClick={handleSwap}
              disabled={swapping}
            >
              {swapping ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
              Заменить
            </Button>
          </div>
        </Card>
      );
    }

    const Icon = TYPE_ICONS[item.content_type] || FileText;

    return (
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-foreground truncate">{item.title}</h3>
            {item.creator_name && (
              <p className="text-xs text-muted-foreground">{item.creator_name}</p>
            )}
          </div>
          <Badge variant="secondary" className="text-xs shrink-0">
            {formatMinutes(item.est_time)}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{item.reason}</p>

        {/* Content action */}
        {isPlayable ? (
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link to={link}>
              <Play className="h-3.5 w-3.5 mr-1.5" />
              {item.content_type === "video" ? "Смотреть" : "Слушать"}
            </Link>
          </Button>
        ) : (
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link to={link}>
              <BookOpen className="h-3.5 w-3.5 mr-1.5" /> Читать
            </Link>
          </Button>
        )}

        {/* Swap */}
        <div className="flex justify-center">
          <button
            onClick={handleSwap}
            disabled={swapping}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            {swapping ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Заменить элемент
          </button>
        </div>
      </Card>
    );
  };

  /* ── main render ── */

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    );
  }

  if (error || !playlist) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-3">
        <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
        <p className="text-sm font-medium">{error || "Плейлист не найден"}</p>
        <Button asChild variant="outline" size="sm"><Link to="/">На главную</Link></Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <Link to="/playlists/new" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Новый плейлист
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <ListMusic className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {GOAL_LABELS[playlist.goal_type] || "Плейлист"}
          </h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>Осталось: {formatMinutes(remainingTime)}</span>
            <span>·</span>
            <span>{completedIds.size}/{items.length} выполнено</span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <Card className="p-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Прогресс</span>
          <span className="text-muted-foreground font-medium">{Math.round(progressPct)}%</span>
        </div>
        <Progress value={progressPct} className="h-2" />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatMinutes(completedTime)} пройдено</span>
          <span>{formatMinutes(remainingTime)} осталось</span>
        </div>
      </Card>

      {/* Not started state */}
      {!started && !allDone && (
        <div className="space-y-3">
          {/* Item list preview */}
          <div className="space-y-1.5">
            {items.map((item, i) => {
              const Icon = TYPE_ICONS[item.content_type] || FileText;
              return (
                <div key={item.id} className="flex items-center gap-2.5 py-1.5 px-2 rounded-md hover:bg-muted/30 transition-colors">
                  <span className="text-xs font-mono text-muted-foreground w-4 text-right">{i + 1}</span>
                  <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm text-foreground truncate flex-1">{item.title}</span>
                  <Badge variant="secondary" className="text-[10px] shrink-0">{formatMinutes(item.est_time)}</Badge>
                  {item.access === "locked" && <Lock className="h-3 w-3 text-destructive shrink-0" />}
                </div>
              );
            })}
          </div>

          <Button className="w-full" onClick={handleStart}>
            <Play className="h-4 w-4 mr-2" /> Начать плейлист
          </Button>
        </div>
      )}

      {/* Active player */}
      {started && !allDone && currentItem && (
        <div className="space-y-4">
          {/* Step indicator */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {items.map((item, i) => {
              const done = completedIds.has(item.id);
              const active = i === currentIdx;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentIdx(i)}
                  className={`h-2 rounded-full transition-all shrink-0 ${
                    done
                      ? "w-2 bg-primary"
                      : active
                        ? "w-6 bg-primary"
                        : "w-2 bg-border"
                  }`}
                  title={`${i + 1}. ${item.title}`}
                />
              );
            })}
          </div>

          {/* Current item view */}
          {renderContentView(currentItem)}

          {/* Primary CTA */}
          {currentItem.access !== "locked" && (
            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleComplete}>
                <CheckCircle2 className="h-4 w-4 mr-2" /> Готово
              </Button>
              {currentIdx < items.length - 1 && (
                <Button variant="outline" onClick={handleSkip}>
                  <SkipForward className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* All done */}
      {allDone && (
        <Card className="p-6 text-center space-y-3">
          <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
          <h2 className="text-lg font-semibold text-foreground">Плейлист завершён!</h2>
          <p className="text-sm text-muted-foreground">
            Вы прошли все {items.length} элементов за {formatMinutes(totalTime)}.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link to="/playlists/new">
              <ArrowRight className="h-3.5 w-3.5 mr-1.5" /> Создать новый
            </Link>
          </Button>
        </Card>
      )}

      {items.length === 0 && (
        <Card className="p-6 text-center space-y-2">
          <AlertTriangle className="h-6 w-6 text-warning mx-auto" />
          <p className="text-sm text-muted-foreground">Плейлист пуст.</p>
        </Card>
      )}
    </div>
  );
}
