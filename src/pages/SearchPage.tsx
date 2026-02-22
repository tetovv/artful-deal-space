import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Search as SearchIcon,
  Film,
  ChevronDown,
  Loader2,
  ShieldCheck,
  Briefcase,
  FlaskConical,
  SearchX,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MOCK_QUERIES, findMockQuery, mockQueryId } from "@/data/mockSearchQueries";

/* ── preference chips ── */

const RESULT_PREFS = [
  { value: "one_best", label: "Один лучший" },
  { value: "more_videos", label: "Больше видео" },
  { value: "montage", label: "Монтаж" },
  { value: "just_moment", label: "Только момент" },
];

const LENGTH_PREFS = [
  { value: "short", label: "Короткое" },
  { value: "medium", label: "Среднее" },
  { value: "full", label: "Полный выпуск" },
];

/* ── component ── */

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") || "meaning_video";
  const navigate = useNavigate();
  const { user } = useAuth();

  // Log open
  useEffect(() => {
    if (mode === "meaning_video") {
      console.log("[analytics] meaning_search_opened");
    }
  }, [mode]);

  if (mode === "meaning_video") {
    return <MeaningVideoQuery navigate={navigate} user={user} />;
  }

  // Default / fallback: show mode selector
  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Поиск</h1>
        <p className="text-sm text-muted-foreground">Выберите режим поиска</p>
      </div>

      <button
        onClick={() => navigate("/search?mode=meaning_video")}
        className="w-full text-left"
      >
        <Card className="p-5 hover:bg-muted/30 transition-colors cursor-pointer border-primary/20">
          <div className="flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Film className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-medium text-foreground">
                Meaning (Video)
              </h2>
              <p className="text-sm text-muted-foreground">
                Найдите видео по смыслу — что происходит, о чём говорят
              </p>
            </div>
            <Badge variant="secondary" className="text-xs shrink-0">
              Новое
            </Badge>
          </div>
        </Card>
      </button>
    </div>
  );
}

/* ── Meaning Video query screen ── */

function MeaningVideoQuery({
  navigate,
  user,
}: {
  navigate: ReturnType<typeof useNavigate>;
  user: any;
}) {
  const [queryText, setQueryText] = useState("");
  const [includeWorkplace, setIncludeWorkplace] = useState(false);
  const [resultPref, setResultPref] = useState<string | null>(null);
  const [lengthPref, setLengthPref] = useState<string | null>(null);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [indexNotReady, setIndexNotReady] = useState(false);
  const [learnMoreOpen, setLearnMoreOpen] = useState(false);

  const canSubmit = queryText.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit || !user) return;
    setSubmitting(true);
    console.log("[analytics] meaning_search_submitted");

    // Check for mock query first
    const mock = findMockQuery(queryText.trim());
    if (mock) {
      const qid = mockQueryId(mock.queryText);
      if (mock.needsClarification) {
        navigate(`/search/clarify/${qid}`);
      } else {
        navigate(`/search/results/${qid}`);
      }
      return;
    }

    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/video-meaning-search`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            ...(session?.access_token
              ? { Authorization: `Bearer ${session.access_token}` }
              : {}),
          },
          body: JSON.stringify({
            queryText: queryText.trim(),
            includePrivateSources: includeWorkplace,
            preferences: {
              ...(resultPref ? { resultType: resultPref } : {}),
              ...(lengthPref ? { length: lengthPref } : {}),
            },
          }),
        },
      );

      if (!res.ok) {
        // Treat 501/503/404 or specific body as "index not ready"
        if (res.status === 501 || res.status === 503 || res.status === 404) {
          setIndexNotReady(true);
          setSubmitting(false);
          return;
        }
        throw new Error("Search failed");
      }
      const data = await res.json();

      // Check for explicit "not ready" / empty index signal from backend
      if (data.indexNotReady || data.error === "empty_index" || data.error === "not_implemented") {
        setIndexNotReady(true);
        setSubmitting(false);
        return;
      }

      if (data.needsClarification) {
        navigate(`/search/clarify/${data.queryId}`);
      } else {
        navigate(`/search/results/${data.queryId}`);
      }
    } catch {
      // Network error or unexpected failure → also show fallback
      setIndexNotReady(true);
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Film className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Поиск по смыслу видео
          </h1>
          <p className="text-sm text-muted-foreground">
            Опишите, что вы хотите найти
          </p>
        </div>
      </div>

      {/* Query input */}
      <div className="space-y-2">
        <Textarea
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          placeholder="Например: момент где объясняют работу нейросетей на простых примерах"
          className="min-h-[100px] text-base leading-relaxed resize-none"
          maxLength={500}
        />
        <p className="text-xs text-muted-foreground text-right">
          {queryText.length}/500
        </p>
      </div>

      {/* Preferences (collapsed) */}
      <Collapsible open={prefsOpen} onOpenChange={setPrefsOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${prefsOpen ? "rotate-180" : ""}`}
            />
            Предпочтения результатов
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-3">
          {/* Result type */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Тип результата
            </label>
            <div className="flex flex-wrap gap-2">
              {RESULT_PREFS.map((p) => (
                <button
                  key={p.value}
                  onClick={() =>
                    setResultPref(resultPref === p.value ? null : p.value)
                  }
                  className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                    resultPref === p.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Length preference */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Длительность
            </label>
            <div className="flex flex-wrap gap-2">
              {LENGTH_PREFS.map((p) => (
                <button
                  key={p.value}
                  onClick={() =>
                    setLengthPref(lengthPref === p.value ? null : p.value)
                  }
                  className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                    lengthPref === p.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Workplace toggle */}
      <Card className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <Label
                htmlFor="workplace-toggle"
                className="text-sm font-medium text-foreground cursor-pointer"
              >
                Мои рабочие источники
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Искать также в приватных материалах
              </p>
            </div>
          </div>
          <Switch
            id="workplace-toggle"
            checked={includeWorkplace}
            onCheckedChange={(v) => {
              setIncludeWorkplace(v);
              console.log(
                `[analytics] toggle_workplace_${v ? "on" : "off"}`,
              );
            }}
          />
        </div>
      </Card>

      {/* Privacy note */}
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
        Используются только источники, к которым у вас есть доступ.
      </p>

      {/* Index not ready fallback */}
      {indexNotReady ? (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4 text-center">
          <div className="flex justify-center">
            <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center">
              <SearchX className="h-7 w-7 text-muted-foreground" />
            </div>
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            Поиск по смыслу пока не готов
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Нужно проиндексировать видео (распознавание речи и моменты).
            Попробуйте обычный поиск или вернитесь позже.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
            <Button
              onClick={() => {
                setIndexNotReady(false);
                navigate("/explore");
              }}
            >
              <SearchIcon className="h-4 w-4 mr-2" />
              Перейти к обычному поиску
            </Button>
            <Button variant="outline" onClick={() => setLearnMoreOpen(true)}>
              <Info className="h-4 w-4 mr-2" />
              Подробнее
            </Button>
          </div>
        </div>
      ) : (
        /* Primary CTA */
        <Button
          className="w-full h-12 text-base"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Ищем…
            </>
          ) : (
            <>
              <SearchIcon className="h-4 w-4 mr-2" /> Найти
            </>
          )}
        </Button>
      )}

      {/* Learn more modal */}
      <Dialog open={learnMoreOpen} onOpenChange={setLearnMoreOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Как работает поиск по смыслу?</DialogTitle>
            <DialogDescription>
              Поиск по смыслу анализирует содержимое видео — речь, действия и эмоции — чтобы находить конкретные моменты по таймкоду.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Для работы этого режима каждое видео должно пройти индексацию:
            </p>
            <ol className="list-decimal list-inside space-y-1.5">
              <li>Распознавание речи (транскрипция)</li>
              <li>Анализ визуальных сцен и действий</li>
              <li>Создание семантического индекса моментов</li>
            </ol>
            <p>
              Если индекс ещё не создан, поиск по смыслу временно недоступен.
              Используйте обычный поиск по названиям и описаниям, пока видео индексируются.
            </p>
          </div>
          <div className="pt-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setLearnMoreOpen(false)}
            >
              Понятно
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Test queries panel */}
      <Collapsible>
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <FlaskConical className="h-3.5 w-3.5" />
            Тестовые запросы ({MOCK_QUERIES.length})
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-1.5 pt-2">
          {MOCK_QUERIES.map((mq, i) => (
            <button
              key={i}
              onClick={() => setQueryText(mq.queryText)}
              className="w-full text-left px-3 py-2 rounded-lg border border-border/50 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            >
              <span className="font-mono text-xs text-muted-foreground mr-2">
                {i + 1}.
              </span>
              {mq.queryText}
              {mq.needsClarification && (
                <Badge variant="outline" className="ml-2 text-[10px]">
                  уточнение
                </Badge>
              )}
              {mq.results.best === null && (
                <Badge variant="destructive" className="ml-2 text-[10px]">
                  0 результатов
                </Badge>
              )}
              {(mq.results.montageCandidates?.length ?? 0) > 0 && (
                <Badge variant="secondary" className="ml-2 text-[10px]">
                  монтаж
                </Badge>
              )}
            </button>
          ))}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
