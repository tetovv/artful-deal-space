/**
 * SmartSearchInline – single-page meaning search flow for Video, Podcast, or "All".
 * State machine: idle → querying → clarifying → results → error | no_results
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  SearchX,
  SkipForward,
  Play,
  Lock,
  Crown,
  Sparkles,
  RefreshCw,
  Briefcase,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Film,
  Mic,
  Layers,
} from "lucide-react";
import { MontageWizardModal } from "@/components/montage/MontageWizardModal";
import { findMockQuery, mockQueryId, MOCK_QUERIES } from "@/data/mockSearchQueries";
import type { MomentResult, SearchResults, ClarificationQuestion } from "@/data/mockSearchTypes";
import { ContentCard } from "@/components/content/ContentCard";

/* ── Types ── */

export type SmartState = "idle" | "querying" | "clarifying" | "results" | "no_results" | "error" | "index_not_ready";
type SmartContentType = "video" | "podcast" | "all";

export type ResultCounts = Record<string, number>;

interface SmartSearchInlineProps {
  query: string;
  contentType: SmartContentType;
  /** Called to switch back to normal search */
  onSwitchToNormal: () => void;
  /** Standard keyword results for non-meaning types in "all" mode */
  standardResults?: any[];
  /** Called when results are computed with per-type counts */
  onResultCounts?: (counts: ResultCounts, state: SmartState) => void;
}

/* ── Helpers ── */

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getEndpointForType(type: SmartContentType): string {
  if (type === "podcast") return "podcast-meaning-search";
  return "video-meaning-search";
}

/* ── Moment Row ── */

function MomentRow({ moment, index, onJump, onPaywall }: {
  moment: MomentResult;
  index: number;
  onJump: (videoId: string, sec: number) => void;
  onPaywall: (videoId: string) => void;
}) {
  const locked = moment.access === "locked";
  const rationales = [
    "Прямое совпадение по теме запроса",
    "Содержит ключевые понятия из запроса",
    "Подробное объяснение темы",
    "Похожий контекст обсуждения",
  ];

  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/50 last:border-0">
      <div className="shrink-0 text-xs font-mono text-muted-foreground bg-muted/50 rounded px-2 py-1 mt-0.5">
        {formatTime(moment.start_sec)}–{formatTime(moment.end_sec)}
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        {!locked && moment.transcript_snippet ? (
          <p className="text-sm text-foreground line-clamp-2">{moment.transcript_snippet}</p>
        ) : locked ? (
          <p className="text-sm text-muted-foreground italic">Содержимое скрыто — требуется доступ</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">Визуальный момент</p>
        )}
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          {rationales[index % rationales.length]}
        </p>
      </div>
      <div className="shrink-0">
        {locked ? (
          <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => onPaywall(moment.video_id)}>
            <Crown className="h-3 w-3" /> Доступ
          </Button>
        ) : (
          <Button size="sm" variant="ghost" className="text-xs gap-1" onClick={() => onJump(moment.video_id, moment.start_sec)}>
            <Play className="h-3 w-3" /> Перейти
          </Button>
        )}
      </div>
    </div>
  );
}

/* ── Video/Podcast Card (group by source) ── */

function SourceCard({ moments, onJump, onPaywall }: {
  moments: MomentResult[];
  onJump: (videoId: string, sec: number) => void;
  onPaywall: (videoId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const first = moments[0];
  if (!first) return null;
  const shown = expanded ? moments : moments.slice(0, 1);

  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-foreground truncate">{first.video_title}</h3>
          <p className="text-xs text-muted-foreground">{first.creator_name}</p>
        </div>
        <Badge variant="secondary" className="text-xs shrink-0">
          {first.access === "locked" ? <><Lock className="h-3 w-3 mr-1" />Заблокировано</> : "Бесплатно"}
        </Badge>
      </div>
      {shown.map((m, i) => (
        <MomentRow key={m.id} moment={m} index={i} onJump={onJump} onPaywall={onPaywall} />
      ))}
      {moments.length > 1 && (
        <button onClick={() => setExpanded(!expanded)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 pt-1">
          {expanded ? <><ChevronUp className="h-3 w-3" /> Скрыть</> : <><ChevronDown className="h-3 w-3" /> Ещё {moments.length - 1} момент(ов)</>}
        </button>
      )}
    </Card>
  );
}

/* ── Main Component ── */

export function SmartSearchInline({ query, contentType, onSwitchToNormal, standardResults, onResultCounts }: SmartSearchInlineProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [state, setState] = useState<SmartState>("idle");
  const [includeWorkplace, setIncludeWorkplace] = useState(false);

  // Clarification
  const [questions, setQuestions] = useState<ClarificationQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [queryId, setQueryId] = useState<string | null>(null);

  // Results
  const [meaningResults, setMeaningResults] = useState<SearchResults | null>(null);

  // Tabs for "all" mode
  const [resultTab, setResultTab] = useState<"meaning" | "standard">("meaning");

  // Montage
  const [montageOpen, setMontageOpen] = useState(false);

  // Count how many types have hits
  const meaningHasHits = meaningResults?.best !== null;
  const standardHasHits = (standardResults?.length ?? 0) > 0;

  const allMoments = useMemo(() => {
    if (!meaningResults) return [];
    const list: MomentResult[] = [];
    if (meaningResults.best) list.push(meaningResults.best);
    list.push(...meaningResults.moreVideos);
    return list;
  }, [meaningResults]);

  // Emit per-type counts to parent
  useEffect(() => {
    if (!onResultCounts) return;
    if (state === "results" || state === "no_results") {
      const counts: ResultCounts = {};
      const meaningCount = allMoments.length;
      if (contentType === "video") {
        counts.video = meaningCount;
      } else if (contentType === "podcast") {
        counts.podcast = meaningCount;
      } else {
        counts.video = meaningCount;
        counts.podcast = 0;
      }
      if (standardResults) {
        for (const item of standardResults) {
          const t = item.type || "other";
          counts[t] = (counts[t] || 0) + 1;
        }
      }
      onResultCounts(counts, state);
    } else {
      onResultCounts({}, state);
    }
  }, [state, allMoments.length, standardResults, contentType, onResultCounts]);

  // Reset when query/contentType changes
  useEffect(() => {
    setState("idle");
    setQuestions([]);
    setAnswers({});
    setQueryId(null);
    setMeaningResults(null);
  }, [contentType]);

  // Auto-submit when query changes
  useEffect(() => {
    if (query.trim()) {
      handleSubmit(query.trim());
    } else {
      setState("idle");
    }
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = useCallback(async (q: string) => {
    if (!q || !user) return;

    setState("querying");
    console.log("[analytics] smart_search_submitted", { query: q, contentType });

    // Check mock queries (video only)
    if (contentType === "video" || contentType === "all") {
      const mock = findMockQuery(q);
      if (mock) {
        const qid = mockQueryId(mock.queryText);
        setQueryId(qid);
        if (mock.needsClarification && mock.clarificationQuestions) {
          setQuestions(mock.clarificationQuestions);
          const defaults: Record<string, string> = {};
          mock.clarificationQuestions.forEach((cq) => { defaults[cq.id] = cq.defaultValue; });
          setAnswers(defaults);
          setState("clarifying");
        } else {
          setMeaningResults(mock.results);
          setState(mock.results.best ? "results" : "no_results");
        }
        return;
      }
    }

    // Call meaning endpoints
    const types: SmartContentType[] = contentType === "all" ? ["video", "podcast"] : [contentType];

    try {
      const session = (await supabase.auth.getSession()).data.session;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      };

      // Run meaning searches in parallel
      const results = await Promise.allSettled(
        types.map(async (t) => {
          const endpoint = getEndpointForType(t);
          const res = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${endpoint}`,
            {
              method: "POST",
              headers,
              body: JSON.stringify({
                queryText: q,
                includePrivateSources: includeWorkplace,
                preferences: {},
              }),
            },
          );

          if (!res.ok) {
            if ([501, 503, 404].includes(res.status)) return { indexNotReady: true };
            throw new Error("Search failed");
          }
          const data = await res.json();
          if (data.indexNotReady || data.error === "empty_index" || data.error === "not_implemented") {
            return { indexNotReady: true };
          }
          return data;
        }),
      );

      // Merge results
      let combinedResults: SearchResults = { best: null, moreVideos: [], montageCandidates: [] };
      let hasClarification = false;
      let firstQueryId: string | null = null;
      let allIndexNotReady = true;

      for (const r of results) {
        if (r.status === "rejected") continue;
        const data = r.value;
        if (data.indexNotReady) continue;
        allIndexNotReady = false;

        if (data.needsClarification && data.questions) {
          hasClarification = true;
          setQuestions(data.questions);
          const defaults: Record<string, string> = {};
          data.questions.forEach((cq: ClarificationQuestion) => { defaults[cq.id] = cq.defaultValue; });
          setAnswers(defaults);
          firstQueryId = data.queryId;
          break;
        }

        if (!firstQueryId) firstQueryId = data.queryId;

        if (data.results) {
          if (!combinedResults.best && data.results.best) {
            combinedResults.best = data.results.best;
          } else if (data.results.best) {
            combinedResults.moreVideos.push(data.results.best);
          }
          combinedResults.moreVideos.push(...(data.results.moreVideos || []));
          combinedResults.montageCandidates.push(...(data.results.montageCandidates || []));
        }
      }

      if (allIndexNotReady) {
        setState("index_not_ready");
        return;
      }

      setQueryId(firstQueryId);

      if (hasClarification) {
        setState("clarifying");
        return;
      }

      setMeaningResults(combinedResults);
      const hasResults = combinedResults.best !== null || combinedResults.moreVideos.length > 0;
      setState(hasResults ? "results" : "no_results");
    } catch {
      setState("error");
    }
  }, [user, contentType, includeWorkplace]);

  const handleClarificationSubmit = useCallback(async (skip: boolean) => {
    if (!queryId || !user) return;
    setState("querying");

    const finalAnswers = skip
      ? Object.fromEntries(questions.map((q) => [q.id, q.defaultValue]))
      : answers;

    console.log("[analytics] smart_search_clarification_answered", { skipped: skip });

    // Check mock
    const mockDef = MOCK_QUERIES.find((q) => mockQueryId(q.queryText) === queryId);
    if (mockDef) {
      setMeaningResults(mockDef.results);
      setState(mockDef.results.best ? "results" : "no_results");
      return;
    }

    try {
      const session = (await supabase.auth.getSession()).data.session;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      };

      const endpoint = contentType === "podcast" ? "podcast-meaning-search" : "video-meaning-search";
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${endpoint}/clarify`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ queryId, answersJson: finalAnswers }),
        },
      );

      if (!res.ok) throw new Error();
      const data = await res.json();

      setMeaningResults(data.results || { best: null, moreVideos: [], montageCandidates: [] });
      const hasResults = data.results?.best !== null || (data.results?.moreVideos?.length ?? 0) > 0;
      setState(hasResults ? "results" : "no_results");
    } catch {
      setState("error");
    }
  }, [queryId, user, questions, answers, contentType]);

  const handleJump = (videoId: string, sec: number) => {
    navigate(`/product/${videoId}?t=${Math.floor(sec)}`);
  };

  const handlePaywall = (videoId: string) => {
    navigate(`/product/${videoId}`);
  };

  const contentTypeIcon = contentType === "podcast" ? Mic : contentType === "video" ? Film : Layers;
  const ContentTypeIcon = contentTypeIcon;

  /* ── IDLE ── */
  if (state === "idle") {
    return (
      <div className="text-center py-12 space-y-3">
        <div className="flex justify-center">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <ContentTypeIcon className="h-6 w-6 text-primary" />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {contentType === "all"
            ? "Введите запрос для умного поиска по всем типам контента"
            : contentType === "podcast"
              ? "Опишите что обсуждается в подкасте"
              : "Опишите что происходит в видео"}
        </p>
        {/* Workplace toggle */}
        <div className="flex items-center justify-center gap-3 pt-2">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="wp-toggle" className="text-sm text-muted-foreground cursor-pointer">Рабочие источники</Label>
          </div>
          <Switch
            id="wp-toggle"
            checked={includeWorkplace}
            onCheckedChange={(v) => {
              setIncludeWorkplace(v);
              console.log(`[analytics] toggle_workplace_${v ? "on" : "off"}`);
            }}
          />
        </div>
        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          Используются только источники, к которым у вас есть доступ.
        </p>
      </div>
    );
  }

  /* ── QUERYING ── */
  if (state === "querying") {
    return (
      <div className="space-y-4 py-8">
        <div className="flex items-center gap-2 justify-center text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Ищем по смыслу…
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-video w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── CLARIFYING ── */
  if (state === "clarifying") {
    return (
      <div className="max-w-2xl mx-auto space-y-5 py-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ContentTypeIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Уточним запрос</h2>
            <p className="text-sm text-muted-foreground line-clamp-1">«{query}»</p>
          </div>
        </div>

        <div className="space-y-4">
          {questions.map((q) => (
            <Card key={q.id} className="p-5 space-y-3">
              <div>
                <p className="text-base font-medium text-foreground">{q.text}</p>
                <p className="text-sm text-muted-foreground mt-1">{q.reason}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {q.options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt.value }))}
                    className={`px-4 py-2 rounded-full border text-sm transition-colors ${
                      answers[q.id] === opt.value
                        ? "border-primary bg-primary/5 text-primary font-medium"
                        : "border-border text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </Card>
          ))}
        </div>

        <div className="flex flex-col gap-3 pt-2">
          <Button className="w-full h-12 text-base" onClick={() => handleClarificationSubmit(false)}>
            Продолжить
          </Button>
          <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => handleClarificationSubmit(true)}>
            <SkipForward className="h-4 w-4 mr-2" />
            Пропустить
          </Button>
        </div>
      </div>
    );
  }

  /* ── ERROR ── */
  if (state === "error") {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-muted-foreground">Не удалось выполнить поиск. Попробуйте ещё раз</p>
        <Button variant="outline" onClick={() => query && handleSubmit(query)}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Повторить
        </Button>
      </div>
    );
  }

  /* ── INDEX NOT READY ── */
  if (state === "index_not_ready") {
    return (
      <div className="rounded-xl border border-border bg-card p-6 space-y-4 text-center max-w-lg mx-auto">
        <div className="flex justify-center">
          <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center">
            <SearchX className="h-7 w-7 text-muted-foreground" />
          </div>
        </div>
        <h2 className="text-lg font-semibold text-foreground">Поиск по смыслу пока не готов</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Нужно проиндексировать контент (распознавание речи и моменты). Попробуйте обычный поиск или вернитесь позже.
        </p>
        <Button onClick={onSwitchToNormal}>
          Перейти к обычному поиску
        </Button>
      </div>
    );
  }

  /* ── NO RESULTS ── */
  if (state === "no_results") {
    const words = query.split(/\s+/).filter((w) => w.length > 2);
    const base = words.slice(0, 2).join(" ");
    const suggestions = [
      base ? `${base} объяснение` : "популярное",
      words[0] ? `${words[0]} пример` : "видео обзор",
      "подкаст",
      "музыка",
    ].slice(0, 4);

    return (
      <div className="text-center py-16 space-y-4">
        <div className="flex justify-center">
          <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center">
            <SearchX className="h-7 w-7 text-muted-foreground" />
          </div>
        </div>
        <p className="text-lg font-medium text-foreground">Ничего не найдено</p>
        <p className="text-sm text-muted-foreground">Попробуйте другой запрос или переключитесь на обычный поиск</p>
        <div className="flex flex-wrap gap-2 justify-center pt-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => handleSubmit(s)}
              className="px-3 py-1.5 rounded-full border border-border text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
        <Button variant="outline" onClick={onSwitchToNormal} className="mt-2">
          Обычный поиск
        </Button>
      </div>
    );
  }

  /* ── RESULTS ── */
  const showTabsForAll = contentType === "all" && (meaningHasHits || standardHasHits);

  return (
    <div className="space-y-4">
      {/* Tab bar for "all" mode */}
      {showTabsForAll && (
        <div className="flex gap-1 border-b border-border pb-0 mb-2">
          <button
            onClick={() => setResultTab("meaning")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              resultTab === "meaning"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
            По смыслу
            {meaningHasHits && <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 px-1">{allMoments.length}</Badge>}
          </button>
          <button
            onClick={() => setResultTab("standard")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              resultTab === "standard"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Обычные
            {standardHasHits && <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 px-1">{standardResults?.length}</Badge>}
          </button>
        </div>
      )}

      {/* Meaning results */}
      {(resultTab === "meaning" || !showTabsForAll) && meaningResults && (
        <div className="space-y-4">
          {/* Best match */}
          {meaningResults.best && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-primary" /> Лучшее совпадение
              </p>
              <Card className="p-4 border-primary/20 bg-primary/5 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-medium text-foreground truncate">{meaningResults.best.video_title}</h3>
                    <p className="text-xs text-muted-foreground">{meaningResults.best.creator_name}</p>
                  </div>
                </div>
                <MomentRow moment={meaningResults.best} index={0} onJump={handleJump} onPaywall={handlePaywall} />
              </Card>
            </div>
          )}

          {/* More results */}
          {meaningResults.moreVideos.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Ещё результаты ({meaningResults.moreVideos.length})
              </p>
              <div className="space-y-2">
                {meaningResults.moreVideos.map((m, i) => (
                  <Card key={m.id} className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-medium text-foreground truncate">{m.video_title}</h3>
                        <p className="text-xs text-muted-foreground">{m.creator_name}</p>
                      </div>
                    </div>
                    <MomentRow moment={m} index={i + 1} onJump={handleJump} onPaywall={handlePaywall} />
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Montage CTA */}
          {(meaningResults.montageCandidates?.length ?? 0) >= 2 && (
            <Card className="p-4 border-dashed">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Создать нарезку</p>
                  <p className="text-xs text-muted-foreground">
                    {meaningResults.montageCandidates!.length} доступных моментов для монтажа
                  </p>
                </div>
                <Button size="sm" onClick={() => setMontageOpen(true)}>
                  Создать нарезку
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Standard results (for "all" mode) */}
      {resultTab === "standard" && showTabsForAll && standardResults && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {standardResults.map((item: any) => (
            <ContentCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {/* Privacy note */}
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground pt-2">
        <ShieldCheck className="h-3.5 w-3.5" />
        Показаны только источники, к которым у вас есть доступ.
      </p>

      {/* Montage wizard */}
      <MontageWizardModal
        open={montageOpen}
        onOpenChange={setMontageOpen}
        queryId={queryId || undefined}
        evidenceSourceIds={allMoments.filter((m) => m.access === "allowed").map((m) => m.video_id)}
      />
    </div>
  );
}
