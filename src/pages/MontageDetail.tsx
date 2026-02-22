import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, Film, Clock, Play, Video, Music, FileText,
  BookOpen, Layout, CheckCircle2, AlertTriangle, XCircle,
  Minus, Plus, ArrowUp, ArrowDown, Trash2, Lock, Save, RefreshCw, Loader2,
} from "lucide-react";
import { toast } from "sonner";

const SOURCE_ICONS: Record<string, React.ElementType> = {
  video: Video, audio: Music, podcast: Music, post: FileText, book: BookOpen, template: Layout,
};

const STATUS_META: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  pending: { label: "В очереди", icon: Clock, className: "text-muted-foreground" },
  processing: { label: "Генерация…", icon: Clock, className: "text-warning" },
  ready: { label: "Готов", icon: CheckCircle2, className: "text-success" },
  saved: { label: "Сохранён", icon: CheckCircle2, className: "text-success" },
  empty: { label: "Нет контента", icon: AlertTriangle, className: "text-warning" },
  error: { label: "Ошибка", icon: XCircle, className: "text-destructive" },
};

interface Segment {
  id: string;
  source_type: string;
  source_id: string | null;
  start_sec: number;
  end_sec: number;
  deep_link: string | null;
  rationale: string;
  sort_order: number;
  segment_status: string;
}

const formatTime = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export default function MontageDetail() {
  const { montageId } = useParams<{ montageId: string }>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Fetch montage data with polling for processing state
  useEffect(() => {
    if (!montageId || !user) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const session = (await supabase.auth.getSession()).data.session;
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        };
        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`;
        }

        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/montage/${montageId}`,
          { headers }
        );
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        if (cancelled) return;

        setProject(data.project);
        setSegments(data.segments || []);

        if (data.project.status === "processing" || data.project.status === "pending") {
          setTimeout(poll, 2000);
        } else {
          setLoading(false);
          console.log("[analytics] montage_generated");
          // Check accessibility of segments
          if (data.segments?.length > 0) {
            checkAccessibility(data.segments, session?.access_token);
          }
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    };

    const checkAccessibility = async (segs: Segment[], token?: string) => {
      const sourceIds = segs.map(s => s.source_id).filter(Boolean) as string[];
      if (sourceIds.length === 0) return;

      const { data: accessible } = await supabase
        .from("content_items")
        .select("id")
        .in("id", sourceIds);

      const accessibleIds = new Set((accessible || []).map(c => c.id));

      // Check entitlements
      const { data: purchases } = await supabase
        .from("purchases")
        .select("content_id")
        .eq("user_id", user!.id);
      const purchasedIds = new Set((purchases || []).map(p => p.content_id));

      const { data: paidContent } = await supabase
        .from("content_items")
        .select("id, monetization_type, price, creator_id")
        .in("id", sourceIds);

      const { data: subs } = await supabase
        .from("subscriptions" as any)
        .select("creator_id")
        .eq("user_id", user!.id);
      const subscribedIds = new Set((subs || []).map((s: any) => s.creator_id));

      setSegments(prev => prev.map(seg => {
        if (!seg.source_id) return seg;
        if (!accessibleIds.has(seg.source_id)) {
          return { ...seg, segment_status: "LOCKED" };
        }
        const content = (paidContent || []).find(c => c.id === seg.source_id);
        if (content && content.monetization_type !== "free" && content.price && content.price > 0) {
          if (!purchasedIds.has(seg.source_id) && !subscribedIds.has(content.creator_id)) {
            return { ...seg, segment_status: "LOCKED" };
          }
        }
        return seg;
      }));
    };

    poll();
    return () => { cancelled = true; };
  }, [montageId, user]);

  const activeSegments = useMemo(
    () => segments.filter(s => s.segment_status !== "REMOVED"),
    [segments]
  );

  const totalDuration = useMemo(
    () => activeSegments.reduce((sum, s) => sum + (s.end_sec - s.start_sec), 0),
    [activeSegments]
  );

  const targetDuration = project?.target_duration || 30;
  const durationPercent = Math.min((totalDuration / targetDuration) * 100, 100);
  const isOverTarget = totalDuration > targetDuration;
  const hasLocked = activeSegments.some(s => s.segment_status === "LOCKED");
  const canSave = !hasLocked && activeSegments.length > 0;

  // Edit action logger
  const logEdit = useCallback(async (actionType: string, payload: any) => {
    if (!montageId) return;
    await supabase.from("montage_edit_history").insert({
      montage_id: montageId,
      action_type: actionType,
      payload,
    });
  }, [montageId]);

  const handleTrim = useCallback((segId: string, edge: "start" | "end", delta: number) => {
    setSegments(prev => prev.map(s => {
      if (s.id !== segId) return s;
      if (edge === "start") {
        const newStart = Math.max(0, s.start_sec + delta);
        if (newStart >= s.end_sec) return s;
        return { ...s, start_sec: newStart };
      } else {
        const newEnd = Math.max(s.start_sec + 1, s.end_sec + delta);
        return { ...s, end_sec: newEnd };
      }
    }));
    setDirty(true);
    console.log("[analytics] segment_trimmed");
    logEdit("trim", { segmentId: segId, edge, delta });
  }, [logEdit]);

  const handleReorder = useCallback((index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= segments.length) return;
    setSegments(prev => {
      const arr = [...prev];
      [arr[index], arr[targetIndex]] = [arr[targetIndex], arr[index]];
      return arr.map((s, i) => ({ ...s, sort_order: i }));
    });
    setDirty(true);
    logEdit("reorder", { fromIndex: index, toIndex: targetIndex });
  }, [segments.length, logEdit]);

  const handleRemove = useCallback((segId: string) => {
    setSegments(prev => prev.map(s =>
      s.id === segId ? { ...s, segment_status: "REMOVED" } : s
    ));
    setDirty(true);
    console.log("[analytics] segment_removed");
    logEdit("remove", { segmentId: segId });
  }, [logEdit]);

  const handleSave = async () => {
    if (!montageId || !canSave || saving) return;
    setSaving(true);
    try {
      // Delete removed segments
      const removedIds = segments.filter(s => s.segment_status === "REMOVED").map(s => s.id);
      if (removedIds.length > 0) {
        await supabase.from("montage_segments").delete().in("id", removedIds);
      }

      // Update remaining segments
      for (const seg of activeSegments) {
        await supabase.from("montage_segments").update({
          start_sec: seg.start_sec,
          end_sec: seg.end_sec,
          sort_order: seg.sort_order,
          segment_status: seg.segment_status,
        }).eq("id", seg.id);
      }

      // Update project status
      await supabase.from("montage_projects").update({ status: "saved" }).eq("id", montageId);
      setProject((p: any) => ({ ...p, status: "saved" }));
      setDirty(false);
      console.log("[analytics] montage_saved");
      toast.success("Монтаж сохранён");
    } catch {
      toast.error("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const statusMeta = STATUS_META[project?.status] || STATUS_META.pending;
  const StatusIcon = statusMeta.icon;
  const isReady = !loading && (project?.status === "ready" || project?.status === "saved");

  // visible index tracking for active segments
  let visibleIndex = 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <Link to="/ask" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Назад
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Film className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Монтаж</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <StatusIcon className={`h-3.5 w-3.5 ${statusMeta.className}`} />
              <span>{statusMeta.label}</span>
              {project && (
                <>
                  <span>·</span>
                  <span>Цель: {project.target_duration}с</span>
                </>
              )}
            </div>
          </div>
        </div>
        {isReady && project?.source_query_id && (
          <Button asChild variant="ghost" size="sm">
            <Link to={`/ask/${project.source_query_id}`}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Уточнить запрос
            </Link>
          </Button>
        )}
      </div>

      {/* Loading / Processing */}
      {(loading || project?.status === "processing" || project?.status === "pending") && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 animate-pulse" /> Генерируем сегменты…
          </div>
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      )}

      {/* Ready state with editing */}
      {isReady && activeSegments.length > 0 && (
        <>
          {/* Duration meter */}
          <Card className="p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {activeSegments.length} сегментов · {formatTime(totalDuration)}
              </span>
              <span className={isOverTarget ? "text-destructive font-medium" : "text-muted-foreground"}>
                {isOverTarget ? `+${Math.round(totalDuration - targetDuration)}с сверх цели` : `${Math.round(targetDuration - totalDuration)}с осталось`}
              </span>
            </div>
            <Progress
              value={durationPercent}
              className={`h-2 ${isOverTarget ? "[&>div]:bg-destructive" : ""}`}
            />
            {isOverTarget && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Общая длительность превышает целевую. Сократите или удалите сегменты.
              </p>
            )}
            {hasLocked && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Некоторые сегменты недоступны. Удалите их перед сохранением.
              </p>
            )}
          </Card>

          {/* Segment list */}
          <div className="space-y-2">
            {segments.map((seg, arrIndex) => {
              if (seg.segment_status === "REMOVED") return null;
              visibleIndex++;
              const currentVisibleIndex = visibleIndex;
              const Icon = SOURCE_ICONS[seg.source_type] || FileText;
              const link = seg.deep_link || (seg.source_id ? `/product/${seg.source_id}` : "#");
              const isLocked = seg.segment_status === "LOCKED";
              const segDuration = Math.round(seg.end_sec - seg.start_sec);

              return (
                <Card
                  key={seg.id}
                  className={`p-4 transition-colors ${isLocked ? "border-destructive/30 bg-destructive/5" : "hover:bg-muted/30"}`}
                >
                  <div className="flex items-start gap-3">
                    {/* Index + Icon */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono text-muted-foreground w-5 text-right">
                        {currentVisibleIndex}
                      </span>
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                        isLocked ? "bg-destructive/10" : "bg-muted"
                      }`}>
                        {isLocked
                          ? <Lock className="h-4 w-4 text-destructive" />
                          : <Icon className="h-4 w-4 text-muted-foreground" />
                        }
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-[10px] font-mono">
                          {formatTime(seg.start_sec)} — {formatTime(seg.end_sec)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">({segDuration}с)</span>
                        {isLocked && (
                          <Badge variant="destructive" className="text-[10px]">
                            <Lock className="h-2.5 w-2.5 mr-0.5" /> Недоступен
                          </Badge>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground leading-relaxed">{seg.rationale}</p>

                      {!isLocked && (
                        <Link
                          to={link}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <Play className="h-3 w-3" /> К фрагменту
                        </Link>
                      )}

                      {/* Trim controls */}
                      {!isLocked && (
                        <div className="flex items-center gap-3 pt-1">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <span>Начало:</span>
                            <button
                              onClick={() => handleTrim(seg.id, "start", -2)}
                              className="h-6 w-6 rounded border border-border flex items-center justify-center hover:bg-muted transition-colors"
                              title="-2с"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => handleTrim(seg.id, "start", 2)}
                              className="h-6 w-6 rounded border border-border flex items-center justify-center hover:bg-muted transition-colors"
                              title="+2с"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <span>Конец:</span>
                            <button
                              onClick={() => handleTrim(seg.id, "end", -2)}
                              className="h-6 w-6 rounded border border-border flex items-center justify-center hover:bg-muted transition-colors"
                              title="-2с"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => handleTrim(seg.id, "end", 2)}
                              className="h-6 w-6 rounded border border-border flex items-center justify-center hover:bg-muted transition-colors"
                              title="+2с"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions column */}
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        onClick={() => handleReorder(arrIndex, -1)}
                        disabled={arrIndex === 0}
                        className="h-6 w-6 rounded border border-border flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Вверх"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleReorder(arrIndex, 1)}
                        disabled={arrIndex === segments.length - 1}
                        className="h-6 w-6 rounded border border-border flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Вниз"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleRemove(seg.id)}
                        className="h-6 w-6 rounded border border-destructive/30 flex items-center justify-center text-destructive hover:bg-destructive/10 transition-colors"
                        title="Удалить"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Primary CTA */}
          <Button
            className="w-full"
            onClick={handleSave}
            disabled={!canSave || saving}
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Сохранение…</>
            ) : (
              <><Save className="h-4 w-4 mr-2" /> Сохранить монтаж</>
            )}
          </Button>
          {!canSave && hasLocked && (
            <p className="text-xs text-center text-destructive">
              Удалите недоступные сегменты для сохранения
            </p>
          )}
        </>
      )}

      {/* Empty state */}
      {!loading && project?.status === "empty" && (
        <Card className="p-6 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-warning mx-auto" />
          <p className="text-sm font-medium text-foreground">Нет доступного контента для монтажа</p>
          <p className="text-xs text-muted-foreground">Попробуйте расширить область источников.</p>
          <Button asChild variant="outline" size="sm">
            <Link to="/ask">Назад</Link>
          </Button>
        </Card>
      )}

      {/* Error state */}
      {!loading && project?.status === "error" && (
        <Card className="p-6 text-center space-y-3">
          <XCircle className="h-8 w-8 text-destructive mx-auto" />
          <p className="text-sm font-medium text-foreground">Ошибка генерации монтажа</p>
          <Button asChild variant="outline" size="sm">
            <Link to="/ask">Попробовать снова</Link>
          </Button>
        </Card>
      )}
    </div>
  );
}
