/**
 * SmartSearchInline – single-page meaning search flow for Video, Podcast, or "All".
 * State machine: idle → querying → clarifying → results → error | no_results
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
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
  Scissors,
} from "lucide-react";
import { MontageWizardModal } from "@/components/montage/MontageWizardModal";
import { findMockQuery, mockQueryId, MOCK_QUERIES } from "@/data/mockSearchQueries";
import type { MomentResult, SearchResults, ClarificationQuestion } from "@/data/mockSearchTypes";
import { ContentCard } from "@/components/content/ContentCard";
import { cn } from "@/lib/utils";

/* ── Types ── */

export type SmartState = "idle" | "querying" | "clarifying" | "results" | "no_results" | "error" | "index_not_ready" | "pick_type";
type SmartContentType = "video" | "podcast" | "all";

export type ResultCounts = Record<string, number>;

interface SmartSearchInlineProps {
  query: string;
  contentType: SmartContentType;
  onSwitchToNormal: () => void;
  standardResults?: any[];
  onResultCounts?: (counts: ResultCounts, state: SmartState) => void;
  onAutoSelectType?: (type: string) => void;
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

const RATIONALES = [
  "Прямое совпадение по теме запроса",
  "Содержит ключевые понятия из запроса",
  "Подробное объяснение темы",
  "Похожий контекст обсуждения",
];

/* ── Moment Row (compact) ── */

function MomentRow({ moment, index, onJump, onPaywall }: {
  moment: MomentResult;
  index: number;
  onJump: (videoId: string, sec: number) => void;
  onPaywall: (videoId: string) => void;
}) {
  const locked = moment.access === "locked";

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-0">
      <span className="shrink-0 text-xs font-mono text-primary bg-primary/10 rounded-md px-2 py-1 mt-0.5">
        {formatTime(moment.start_sec)}–{formatTime(moment.end_sec)}
      </span>
      <div className="flex-1 min-w-0 space-y-0.5" style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}>
        {!locked && moment.transcript_snippet ? (
          <p className="text-sm text-foreground leading-relaxed line-clamp-2">{moment.transcript_snippet}</p>
        ) : locked ? (
          <p className="text-sm text-muted-foreground italic">Содержимое скрыто — требуется доступ</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">Визуальный момент</p>
        )}
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Sparkles className="h-3 w-3 shrink-0" />
          {RATIONALES[index % RATIONALES.length]}
        </p>
      </div>
      <div className="shrink-0">
        {locked ? (
          <Button size="sm" variant="outline" className="text-xs gap-1 h-7" onClick={() => onPaywall(moment.video_id)}>
            <Crown className="h-3 w-3" /> Доступ
          </Button>
        ) : (
          <Button size="sm" variant="ghost" className="text-xs gap-1 h-7" onClick={() => onJump(moment.video_id, moment.start_sec)}>
            <Play className="h-3 w-3" /> Перейти
          </Button>
        )}
      </div>
    </div>
  );
}

/* ── Source Card (grouped by video/podcast) ── */

function SourceCard({ moments, isBest, onJump, onPaywall }: {
  moments: MomentResult[];
  isBest?: boolean;
  onJump: (videoId: string, sec: number) => void;
  onPaywall: (videoId: string) => void;
}) {
  const [expanded, setExpanded] = useState(isBest ?? false);
  const first = moments[0];
  if (!first) return null;

  const previewCount = isBest ? 3 : 1;
  const shown = expanded ? moments : moments.slice(0, previewCount);
  const hasMore = moments.length > previewCount;

  return (
    <Card
      className={cn(
        "p-4 space-y-1",
        isBest && "border-primary/25 bg-primary/[0.03]",
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1" style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}>
          <h3 className="text-sm font-semibold text-foreground leading-snug">{first.video_title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{first.creator_name}</p>
        </div>
        <Badge
          variant={first.access === "locked" ? "outline" : "secondary"}
          className="text-[11px] shrink-0"
        >
          {first.access === "locked" ? (
            <><Lock className="h-3 w-3 mr-1" />Подписка</>
          ) : (
            "Бесплатно"
          )}
        </Badge>
      </div>

      {/* Moments */}
      <div className="pt-1">
        {shown.map((m, i) => (
          <MomentRow key={m.id} moment={m} index={i} onJump={onJump} onPaywall={onPaywall} />
        ))}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 pt-1 transition-colors"
        >
          {expanded ? (
            <><ChevronUp className="h-3 w-3" /> Скрыть</>
          ) : (
            <><ChevronDown className="h-3 w-3" /> Ещё {moments.length - previewCount} момент(ов)</>
          )}
        </button>
      )}
    </Card>
  );
}

/* ── Clarification Panel (centered card, max ~720px) ── */

function ClarificationPanel({
  query,
  questions,
  answers,
  onAnswerChange,
  onSubmit,
  onSkip,
}: {
  query: string;
  questions: ClarificationQuestion[];
  answers: Record<string, string>;
  onAnswerChange: (id: string, value: string) => void;
  onSubmit: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="flex justify-center py-6">
      <div className="w-full max-w-[720px] rounded-xl border border-border bg-card p-5 sm:p-6 space-y-5 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">Уточним запрос</h3>
            <p className="text-xs text-muted-foreground truncate">«{query}»</p>
          </div>
        </div>

        {/* Questions */}
        <div className="space-y-4">
          {questions.slice(0, 2).map((q) => (
            <div key={q.id} className="space-y-2">
              <div>
                <p className="text-sm font-medium text-foreground">{q.text}</p>
                {q.reason && (
                  <p className="text-xs text-muted-foreground mt-0.5">{q.reason}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {q.options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => onAnswerChange(q.id, opt.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-full border text-xs transition-colors",
                      answers[q.id] === opt.value
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-border text-muted-foreground hover:bg-muted/50",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Actions — right-aligned: Skip (text) then Continue (primary) */}
        <div className="flex items-center justify-end gap-3 pt-1 border-t border-border">
          <Button size="sm" variant="ghost" className="h-9 text-xs text-muted-foreground" onClick={onSkip}>
            <SkipForward className="h-3.5 w-3.5 mr-1.5" />
            Пропустить
          </Button>
          <Button size="sm" className="h-9 px-5 text-xs" onClick={onSubmit}>
            Продолжить
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── Montage Bar (non-sticky, above results) ── */

function MontageBar({ count, onOpen }: { count: number; onOpen: () => void }) {
  if (count < 2) return null;
  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-4 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Scissors className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground">
            Доступно моментов для нарезки: <strong className="text-foreground">{count}</strong>
          </span>
        </div>
        <Button size="sm" variant="outline" className="shrink-0 text-xs h-8" onClick={onOpen}>
          Создать нарезку
        </Button>
      </div>
    </div>
  );
}

/* ── Main Component ── */

export function SmartSearchInline({ query, contentType, onSwitchToNormal, standardResults, onResultCounts, onAutoSelectType }: SmartSearchInlineProps) {
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


  // Montage
  const [montageOpen, setMontageOpen] = useState(false);

  // Per-type counts for pick_type panel
  const [pickTypeCounts, setPickTypeCounts] = useState<ResultCounts>({});

  // AbortController for in-flight requests
  const abortRef = useRef<AbortController | null>(null);


  const allMoments = useMemo(() => {
    if (!meaningResults) return [];
    const list: MomentResult[] = [];
    if (meaningResults.best) list.push(meaningResults.best);
    list.push(...meaningResults.moreVideos);
    return list;
  }, [meaningResults]);

  // Group moments by video for "more results"
  const groupedMore = useMemo(() => {
    if (!meaningResults) return [];
    const map = new Map<string, MomentResult[]>();
    for (const m of meaningResults.moreVideos) {
      const key = m.video_id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return Array.from(map.values());
  }, [meaningResults]);

  const montageCount = useMemo(() => {
    return meaningResults?.montageCandidates?.length ?? allMoments.filter(m => m.access === "allowed").length;
  }, [meaningResults, allMoments]);

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

  // Reset when contentType changes
  useEffect(() => {
    resetAll();
  }, [contentType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Full reset helper
  const resetAll = useCallback(() => {
    // Cancel any in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setState("idle");
    setQuestions([]);
    setAnswers({});
    setQueryId(null);
    setMeaningResults(null);
  }, []);

  // Auto-submit when query changes
  useEffect(() => {
    if (query.trim()) {
      handleSubmit(query.trim());
    } else {
      resetAll();
    }
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = useCallback(async (q: string) => {
    if (!q || !user) return;

    // Abort previous in-flight request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState("querying");
    console.log("[analytics] smart_search_submitted", { query: q, contentType });

    // Check mock queries
    if (contentType === "video" || contentType === "all") {
      const mock = findMockQuery(q);
      if (mock) {
        if (controller.signal.aborted) return;
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
          const hasRes = !!mock.results.best;
          if (contentType === "all" && hasRes) {
            // For mock: auto-select video since mocks are video-based
            onAutoSelectType?.("video");
            setState("results");
          } else {
            setState(hasRes ? "results" : "no_results");
          }
        }
        return;
      }
    }

    const types: SmartContentType[] = contentType === "all" ? ["video", "podcast"] : [contentType];

    try {
      const session = (await supabase.auth.getSession()).data.session;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      };

      const results = await Promise.allSettled(
        types.map(async (t) => {
          const endpoint = getEndpointForType(t);
          const res = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${endpoint}`,
            {
              method: "POST",
              headers,
              signal: controller.signal,
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

      // Guard against stale responses after abort
      if (controller.signal.aborted) return;

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

      // Gate: when searching "all" types, don't show mixed results
      if (contentType === "all" && hasResults) {
        // Compute per-type counts
        const counts: ResultCounts = {};
        const meaningCount = (combinedResults.best ? 1 : 0) + combinedResults.moreVideos.length;
        counts.video = meaningCount;
        counts.podcast = 0; // podcast meaning search results counted separately if available
        if (standardResults) {
          for (const item of standardResults) {
            const t = item.type || "other";
            counts[t] = (counts[t] || 0) + 1;
          }
        }
        const typesWithHits = Object.entries(counts).filter(([, v]) => v > 0).map(([k]) => k);
        if (typesWithHits.length === 1) {
          // Auto-select the single matching type
          onAutoSelectType?.(typesWithHits[0]);
          setState("results"); // will re-render with specific type via parent
        } else {
          setPickTypeCounts(counts);
          setState("pick_type");
        }
      } else {
        setState(hasResults ? "results" : "no_results");
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return; // Aborted intentionally
      setState("error");
    }
  }, [user, contentType, includeWorkplace]);

  const handleClarificationSubmit = useCallback(async (skip: boolean) => {
    if (!queryId || !user) return;
    setState("querying");

    console.log("[analytics] smart_search_clarification_answered", {
      skipped: skip,
      answers: skip ? null : answers,
    });

    if (skip) {
      toast({
        description: "Используем настройки по умолчанию: Один лучший • Короткое",
      });
    }

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

      // Different payloads for Continue vs Skip
      const body = skip
        ? { queryId, skip: true, applyDefaults: true, answersJson: null }
        : { queryId, answersJson: answers };

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${endpoint}/clarify`,
        { method: "POST", headers, body: JSON.stringify(body) },
      );

      if (!res.ok) throw new Error();
      const data = await res.json();

      setMeaningResults(data.results || { best: null, moreVideos: [], montageCandidates: [] });
      const hasResults = data.results?.best !== null || (data.results?.moreVideos?.length ?? 0) > 0;
      setState(hasResults ? "results" : "no_results");
    } catch {
      setState("error");
    }
  }, [queryId, user, answers, contentType]);

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
        {contentType === "all" && (
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
        )}
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
      <div className="space-y-5 py-10 animate-fade-in">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
          <div>
            <p className="text-base font-medium text-foreground">Ищем…</p>
            {contentType === "all" ? (
              <p className="text-sm text-muted-foreground mt-1">Проверяем видео, подкасты и другие типы</p>
            ) : contentType === "podcast" ? (
              <p className="text-sm text-muted-foreground mt-1">Анализируем подкасты по смыслу</p>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">Анализируем видео по смыслу</p>
            )}
          </div>
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

  /* ── CLARIFYING (inline panel, not full-page) ── */
  if (state === "clarifying") {
    return (
      <ClarificationPanel
        query={query}
        questions={questions}
        answers={answers}
        onAnswerChange={(id, value) => setAnswers((prev) => ({ ...prev, [id]: value }))}
        onSubmit={() => handleClarificationSubmit(false)}
        onSkip={() => handleClarificationSubmit(true)}
      />
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

  /* ── PICK TYPE (multiple types matched, user must choose) ── */
  if (state === "pick_type") {
    const typeChipIcons: Record<string, React.ComponentType<{ className?: string }>> = {
      video: Film,
      podcast: Mic,
    };
    const typeChipLabels: Record<string, string> = {
      video: "Видео",
      podcast: "Подкасты",
      music: "Музыка",
      post: "Посты",
      book: "Книги",
      template: "Шаблоны",
    };
    const matchingTypes = Object.entries(pickTypeCounts)
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => b - a);

    return (
      <div className="py-10 space-y-5 animate-fade-in">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-base font-medium text-foreground">Найдено в нескольких типах</p>
            <p className="text-sm text-muted-foreground mt-1">Выберите тип, чтобы посмотреть результаты</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 justify-center">
          {matchingTypes.map(([type, count]) => {
            const Icon = typeChipIcons[type] || Layers;
            return (
              <button
                key={type}
                onClick={() => onAutoSelectType?.(type)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors text-sm font-medium text-foreground"
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                {typeChipLabels[type] || type}
                <Badge variant="secondary" className="text-[10px] h-[18px] min-w-[18px] px-1 rounded-full">
                  {count}
                </Badge>
              </button>
            );
          })}
        </div>
      </div>
    );
  }


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
      <div className="text-center py-16 space-y-4 animate-fade-in">
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

  /* ── RESULTS (only rendered for a specific content type, never mixed) ── */

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Montage bar — above results, non-sticky, secondary */}
      <MontageBar count={montageCount} onOpen={() => setMontageOpen(true)} />

      {/* Meaning results */}
      {meaningResults && (
        <div className="space-y-5">
          {meaningResults.best && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-primary" /> Лучшее совпадение
              </p>
              <SourceCard
                moments={[meaningResults.best]}
                isBest
                onJump={handleJump}
                onPaywall={handlePaywall}
              />
            </div>
          )}

          {groupedMore.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Ещё результаты ({meaningResults.moreVideos.length})
              </p>
              <div className="space-y-2">
                {groupedMore.map((group, gi) => (
                  <SourceCard
                    key={group[0]?.video_id ?? gi}
                    moments={group}
                    onJump={handleJump}
                    onPaywall={handlePaywall}
                  />
                ))}
              </div>
            </div>
          )}
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
