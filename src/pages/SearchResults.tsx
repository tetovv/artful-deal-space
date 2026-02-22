import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Film,
  Play,
  Lock,
  ChevronDown,
  ChevronUp,
  Loader2,
  SearchX,
  Sparkles,
  ExternalLink,
  Crown,
  Scissors,
  Briefcase,
} from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { MontageWizardModal } from "@/components/montage/MontageWizardModal";
/* ── types ── */

interface MomentResult {
  id: string;
  video_id: string;
  start_sec: number;
  end_sec: number;
  transcript_snippet: string | null;
  access: "allowed" | "locked";
  video_title: string;
  creator_name: string;
  score: number;
  entity_tags?: unknown[];
  action_tags?: unknown[];
}

interface SearchResults {
  best: MomentResult | null;
  moreVideos: MomentResult[];
  montageCandidates: MomentResult[];
}

interface QueryData {
  query_text: string;
  preferences: Record<string, string>;
  include_private_sources: boolean;
}

/* ── helpers ── */

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function durationLabel(start: number, end: number): string {
  const dur = end - start;
  if (dur <= 60) return "Короткое";
  if (dur <= 300) return "Среднее";
  return "Полный";
}

function accessBadge(access: string) {
  if (access === "locked") {
    return (
      <Badge variant="destructive" className="text-xs gap-1">
        <Lock className="h-3 w-3" /> Заблокировано
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-xs">
      Бесплатно
    </Badge>
  );
}

function mockRationale(index: number): string {
  const rationales = [
    "Прямое совпадение по теме запроса",
    "Содержит ключевые понятия из запроса",
    "Подробное объяснение темы",
    "Похожий контекст обсуждения",
    "Релевантный пример по теме",
    "Близкая тематика и формат",
  ];
  return rationales[index % rationales.length];
}

/* ── Moment row ── */

function MomentRow({
  moment,
  index,
  onJump,
  onPaywall,
}: {
  moment: MomentResult;
  index: number;
  onJump: (videoId: string, sec: number) => void;
  onPaywall: (videoId: string) => void;
}) {
  const locked = moment.access === "locked";

  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/50 last:border-0">
      <div className="shrink-0 text-xs font-mono text-muted-foreground bg-muted/50 rounded px-2 py-1 mt-0.5">
        {formatTime(moment.start_sec)}–{formatTime(moment.end_sec)}
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        {moment.transcript_snippet && !locked ? (
          <p className="text-sm text-foreground line-clamp-2">
            {moment.transcript_snippet}
          </p>
        ) : locked ? (
          <p className="text-sm text-muted-foreground italic">
            Содержимое скрыто — требуется доступ
          </p>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Визуальный момент
          </p>
        )}
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          {mockRationale(index)}
        </p>
      </div>
      <div className="shrink-0">
        {locked ? (
          <Button
            size="sm"
            variant="outline"
            className="text-xs gap-1"
            onClick={() => {
              onPaywall(moment.video_id);
              console.log("[analytics] paywall_hit_in_results", {
                videoId: moment.video_id,
                momentId: moment.id,
              });
            }}
          >
            <Crown className="h-3 w-3" /> Доступ
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="text-xs gap-1"
            onClick={() => {
              onJump(moment.video_id, moment.start_sec);
              console.log("[analytics] meaning_search_result_clicked", {
                videoId: moment.video_id,
                momentId: moment.id,
              });
            }}
          >
            <Play className="h-3 w-3" /> Перейти
          </Button>
        )}
      </div>
    </div>
  );
}

/* ── Video card (for More Videos) ── */

function VideoCard({
  moments,
  onJump,
  onPaywall,
}: {
  moments: MomentResult[];
  onJump: (videoId: string, sec: number) => void;
  onPaywall: (videoId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const first = moments[0];
  if (!first) return null;

  const topMoments = expanded ? moments : moments.slice(0, 1);

  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-foreground truncate">
            {first.video_title}
          </h3>
          <p className="text-xs text-muted-foreground">{first.creator_name}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {accessBadge(first.access)}
          <Badge variant="outline" className="text-xs">
            {durationLabel(first.start_sec, first.end_sec)}
          </Badge>
        </div>
      </div>

      {topMoments.map((m, i) => (
        <MomentRow
          key={m.id}
          moment={m}
          index={i}
          onJump={onJump}
          onPaywall={onPaywall}
        />
      ))}

      {moments.length > 1 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 pt-1"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" /> Скрыть
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" /> Ещё {moments.length - 1}{" "}
              момент(ов)
            </>
          )}
        </button>
      )}
    </Card>
  );
}

/* ── No results ── */

function NoResults({
  queryText,
  onRewrite,
  hasWorkplace,
  includePrivate,
  onTogglePrivate,
}: {
  queryText: string;
  onRewrite: (text: string) => void;
  hasWorkplace: boolean;
  includePrivate: boolean;
  onTogglePrivate: (v: boolean) => void;
}) {
  useEffect(() => {
    console.log("[analytics] no_results_shown");
  }, []);

  const suggestions = useMemo(() => {
    const words = queryText.split(/\s+/).filter((w) => w.length > 3);
    const base = words.slice(0, 3).join(" ");
    return [
      base ? `${base} объяснение` : "объяснение простыми словами",
      base ? `${base} пример` : "примеры и разбор",
      `лучшие моменты ${words[0] || "видео"}`,
      base ? `${base} короткое` : "краткий обзор темы",
    ].slice(0, 4);
  }, [queryText]);

  return (
    <div className="space-y-6 py-8 text-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center">
          <SearchX className="h-7 w-7 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">
          Ничего не найдено
        </h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Попробуйте переформулировать запрос или расширить параметры поиска
        </p>
      </div>

      <div className="space-y-2 max-w-md mx-auto">
        <p className="text-xs font-medium text-muted-foreground text-left">
          Попробуйте:
        </p>
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => onRewrite(s)}
              className="px-3 py-1.5 rounded-full border border-border text-sm text-muted-foreground hover:bg-muted/50 transition-colors text-left"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <Card className="p-4 max-w-md mx-auto space-y-3">
        <p className="text-xs font-medium text-muted-foreground text-left">
          Расширить поиск:
        </p>
        <div className="space-y-3">
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm text-foreground">
              Включить похожие действия
            </span>
            <Switch defaultChecked={false} />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm text-foreground">
              Расширить контекст / шоу
            </span>
            <Switch defaultChecked={false} />
          </label>
          {hasWorkplace && (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm text-foreground cursor-pointer">
                  Рабочие источники
                </Label>
              </div>
              <Switch
                checked={includePrivate}
                onCheckedChange={onTogglePrivate}
              />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

/* ── Main component ── */

export default function SearchResultsPage() {
  const { queryId } = useParams<{ queryId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [queryData, setQueryData] = useState<QueryData | null>(null);
  const [activeTab, setActiveTab] = useState("one_best");
  const [includePrivate, setIncludePrivate] = useState(false);

  useEffect(() => {
    if (!queryId || !user) return;
    (async () => {
      try {
        const session = (await supabase.auth.getSession()).data.session;
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/video-meaning-search/${queryId}`,
          {
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              ...(session?.access_token
                ? { Authorization: `Bearer ${session.access_token}` }
                : {}),
            },
          },
        );
        if (!res.ok) throw new Error();
        const data = await res.json();

        setQueryData({
          query_text: data.query?.query_text || "",
          preferences: data.query?.preferences || {},
          include_private_sources: data.query?.include_private_sources || false,
        });
        setIncludePrivate(data.query?.include_private_sources || false);

        // Reconstruct results from stored data
        const moments: MomentResult[] = (data.results || []).map(
          (r: any) => ({
            id: r.moment_index?.id || r.moment_id,
            video_id: r.moment_index?.video_id || "",
            start_sec: r.moment_index?.start_sec || 0,
            end_sec: r.moment_index?.end_sec || 0,
            transcript_snippet: r.moment_index?.transcript_snippet || null,
            access: r.moment_index?.transcript_snippet ? "allowed" : "locked",
            video_title: r.moment_index?.video_id || "Видео",
            creator_name: "",
            score: r.score || 0,
          }),
        );

        moments.sort((a, b) => b.score - a.score);

        setResults({
          best: moments[0] || null,
          moreVideos: moments.slice(1),
          montageCandidates: moments
            .filter((m) => m.access === "allowed")
            .slice(0, 5),
        });

        // Determine default tab
        const prefs = data.query?.preferences || {};
        const outputType =
          prefs.resultType ||
          data.clarifications?.[0]?.answers?.outputType;
        if (outputType === "just_moment" && moments.length > 0) {
          setActiveTab("one_best");
        } else if (outputType === "more_videos") {
          setActiveTab("more_videos");
        } else if (outputType === "montage") {
          setActiveTab("montage");
        }
      } catch {
        toast.error("Не удалось загрузить результаты");
      } finally {
        setLoading(false);
      }
    })();
  }, [queryId, user]);

  const handleJump = (videoId: string, sec: number) => {
    navigate(`/product/${videoId}?t=${Math.floor(sec)}`);
  };

  const handlePaywall = (videoId: string) => {
    navigate(`/product/${videoId}`);
  };

  const handleRewrite = (text: string) => {
    navigate(`/search?mode=meaning_video&q=${encodeURIComponent(text)}`);
  };

  const [montageWizardOpen, setMontageWizardOpen] = useState(false);

  // Group moments by video for "More videos" tab
  const groupedByVideo = useMemo(() => {
    if (!results) return [];
    const map = new Map<string, MomentResult[]>();
    results.moreVideos.forEach((m) => {
      const arr = map.get(m.video_id) || [];
      arr.push(m);
      map.set(m.video_id, arr);
    });
    return Array.from(map.values())
      .map((arr) => arr.sort((a, b) => b.score - a.score).slice(0, 3))
      .sort((a, b) => b[0].score - a[0].score);
  }, [results]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const noResults = !results?.best && results?.moreVideos.length === 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Film className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold text-foreground">Результаты</h1>
          <p className="text-sm text-muted-foreground truncate">
            «{queryData?.query_text}»
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/search?mode=meaning_video")}
        >
          Новый поиск
        </Button>
      </div>

      {noResults ? (
        <NoResults
          queryText={queryData?.query_text || ""}
          onRewrite={handleRewrite}
          hasWorkplace={true}
          includePrivate={includePrivate}
          onTogglePrivate={setIncludePrivate}
        />
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="one_best" className="flex-1 text-sm">
              Один лучший
            </TabsTrigger>
            <TabsTrigger value="more_videos" className="flex-1 text-sm">
              Больше видео
            </TabsTrigger>
            <TabsTrigger value="montage" className="flex-1 text-sm">
              Монтаж
            </TabsTrigger>
          </TabsList>

          {/* ── One Best ── */}
          <TabsContent value="one_best" className="space-y-4 pt-2">
            {results?.best && (
              <>
                <Card className="p-5 border-primary/30 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant="outline"
                          className="text-xs text-primary border-primary/30"
                        >
                          Best Match
                        </Badge>
                        {accessBadge(results.best.access)}
                      </div>
                      <h2 className="text-base font-medium text-foreground">
                        {results.best.video_title}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {results.best.creator_name || "Автор"}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {durationLabel(
                        results.best.start_sec,
                        results.best.end_sec,
                      )}
                    </Badge>
                  </div>

                  {/* Best moment details */}
                  <MomentRow
                    moment={results.best}
                    index={0}
                    onJump={handleJump}
                    onPaywall={handlePaywall}
                  />

                  {/* Additional moments from same video in moreVideos */}
                  {results.moreVideos
                    .filter((m) => m.video_id === results.best!.video_id)
                    .slice(0, 3)
                    .map((m, i) => (
                      <MomentRow
                        key={m.id}
                        moment={m}
                        index={i + 1}
                        onJump={handleJump}
                        onPaywall={handlePaywall}
                      />
                    ))}
                </Card>

                {/* Primary CTA */}
                <Button
                  className="w-full h-12 text-base"
                  onClick={() => {
                    if (results.best!.access === "locked") {
                      handlePaywall(results.best!.video_id);
                    } else {
                      handleJump(
                        results.best!.video_id,
                        results.best!.start_sec,
                      );
                    }
                  }}
                >
                  {results.best.access === "locked" ? (
                    <>
                      <Crown className="h-4 w-4 mr-2" /> Получить доступ
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" /> Смотреть лучший момент
                    </>
                  )}
                </Button>
              </>
            )}
          </TabsContent>

          {/* ── More Videos ── */}
          <TabsContent value="more_videos" className="space-y-3 pt-2">
            {groupedByVideo.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Дополнительных видео не найдено
              </p>
            ) : (
              groupedByVideo.map((group, gi) => (
                <VideoCard
                  key={group[0].video_id + gi}
                  moments={group}
                  onJump={handleJump}
                  onPaywall={handlePaywall}
                />
              ))
            )}
          </TabsContent>

          {/* ── Montage ── */}
          <TabsContent value="montage" className="space-y-4 pt-2">
            {results?.montageCandidates &&
            results.montageCandidates.length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {results.montageCandidates.length} момент(ов) для монтажа
                </p>
                <div className="space-y-2">
                  {results.montageCandidates.map((m, i) => (
                    <Card key={m.id} className="p-3">
                      <div className="flex items-start gap-3">
                        <div className="shrink-0 text-xs font-mono text-muted-foreground bg-muted/50 rounded px-2 py-1">
                          {formatTime(m.start_sec)}–{formatTime(m.end_sec)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {m.video_title}
                          </p>
                          {m.transcript_snippet && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                              {m.transcript_snippet}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Sparkles className="h-3 w-3" />
                            {mockRationale(i)}
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                <Button
                  className="w-full h-12 text-base"
                  onClick={() => setMontageWizardOpen(true)}
                >
                  <Scissors className="h-4 w-4 mr-2" /> Создать монтаж
                </Button>
              </>
            ) : (
              <div className="text-center py-8 space-y-2">
                <p className="text-sm text-muted-foreground">
                  Нет доступных моментов для монтажа
                </p>
                <p className="text-xs text-muted-foreground">
                  Заблокированные моменты нельзя включить в монтаж
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      <MontageWizardModal
        open={montageWizardOpen}
        onOpenChange={setMontageWizardOpen}
        queryId={queryId}
        useVideoMeaningEndpoint
        selectedMomentIds={results?.montageCandidates?.map((m) => m.id)}
      />
    </div>
  );
}
