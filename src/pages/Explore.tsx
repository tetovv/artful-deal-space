import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { contentItems as mockItems, contentTypeLabels } from "@/data/mockData";
import { ContentCard } from "@/components/content/ContentCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { ContentType } from "@/types";
import { useContentItems } from "@/hooks/useDbData";
import { PageTransition } from "@/components/layout/PageTransition";
import { SelectTabPrompt } from "@/pages/Home";
import { SmartSearchInline } from "@/components/search/SmartSearchInline";

const types: (ContentType | "all")[] = ["all", "video", "music", "post", "podcast", "book", "template"];

const typeLabels: Record<string, string> = {
  all: "Все",
  ...contentTypeLabels,
};

type SearchState = "idle" | "loading" | "results" | "no_results" | "error";
type VideoSearchMode = "normal" | "meaning";

const SMART_TYPES = new Set<string>(["video", "podcast", "all"]);

const Explore = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get("q") || "";
  const urlMode = searchParams.get("mode") || "";

  const [inputValue, setInputValue] = useState(urlQuery);
  const [committedQuery, setCommittedQuery] = useState(urlQuery);
  const [activeType, setActiveType] = useState<ContentType | "all" | null>(
    urlMode === "smart" ? "all" : null
  );
  const [searchState, setSearchState] = useState<SearchState>(urlQuery ? "loading" : "idle");
  const [error, setError] = useState(false);
  const [smartMode, setSmartMode] = useState<VideoSearchMode>(
    urlMode === "smart" || urlMode === "meaning" ? "meaning" : "normal"
  );

  const { data: dbItems, isLoading, isError, refetch } = useContentItems();

  // Is smart mode active?
  const isSmartActive = smartMode === "meaning" && activeType !== null && SMART_TYPES.has(activeType);

  // Normalize items
  const allItems = useMemo(() => {
    return (dbItems && dbItems.length > 0 ? dbItems : mockItems).map((item: any) => ({
      id: item.id,
      title: item.title,
      description: item.description || "",
      type: item.type,
      thumbnail: item.thumbnail || "",
      creatorId: item.creator_id || item.creatorId || "",
      creatorName: item.creator_name || item.creatorName || "",
      creatorAvatar: item.creator_avatar || item.creatorAvatar || "",
      price: item.price ?? null,
      views: item.views || 0,
      likes: item.likes || 0,
      createdAt: item.created_at || item.createdAt || "",
      tags: item.tags || [],
      duration: item.duration ?? null,
    }));
  }, [dbItems]);

  // Filter for standard (non-smart) mode
  const filtered = useMemo(() => {
    if (!committedQuery && !activeType) return allItems;
    if (activeType === "all" && !committedQuery) return allItems;
    return allItems.filter((item: any) => {
      const q = committedQuery.toLowerCase();
      const matchSearch = !committedQuery ||
        item.title.toLowerCase().includes(q) ||
        (item.description || "").toLowerCase().includes(q) ||
        (item.tags || []).some((t: string) => t.toLowerCase().includes(q));
      const matchType = !activeType || activeType === "all" || item.type === activeType;
      return matchSearch && matchType;
    });
  }, [allItems, committedQuery, activeType]);

  // Derive state from data (standard mode only)
  useEffect(() => {
    if (isSmartActive) return; // smart mode handles its own state
    if (isError) {
      setSearchState("error");
      setError(true);
      return;
    }
    if (isLoading && committedQuery) {
      setSearchState("loading");
      return;
    }
    if (!committedQuery) {
      setSearchState("idle");
      return;
    }
    if (filtered.length === 0) {
      setSearchState("no_results");
    } else {
      setSearchState("results");
    }
  }, [isLoading, isError, committedQuery, filtered.length, isSmartActive]);

  // Auto-run search from URL on mount
  useEffect(() => {
    if (urlQuery && !committedQuery) {
      setCommittedQuery(urlQuery);
      setInputValue(urlQuery);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submitSearch = useCallback(() => {
    const q = inputValue.trim();
    setCommittedQuery(q);
    if (q) {
      const params: Record<string, string> = { q };
      if (isSmartActive) params.mode = "smart";
      setSearchParams(params, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
    setError(false);
  }, [inputValue, setSearchParams, isSmartActive]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitSearch();
    }
  };

  const handleRetry = () => {
    setError(false);
    refetch();
    submitSearch();
  };

  const handleTypeChange = (t: ContentType | "all") => {
    const newType = activeType === t ? null : t;
    setActiveType(newType);
    // Reset smart mode when switching away from smart-capable types
    if (newType && !SMART_TYPES.has(newType)) {
      setSmartMode("normal");
    }
  };

  const handleSwitchToNormal = () => {
    setSmartMode("normal");
  };

  // Suggestions for no-results
  const suggestions = useMemo(() => {
    const words = committedQuery.split(/\s+/).filter((w) => w.length > 2);
    const base = words.slice(0, 2).join(" ");
    return [
      base ? `${base}` : "популярное",
      words[0] ? `${words[0]} видео` : "видео обзор",
      "подкаст",
      "музыка",
    ].slice(0, 4);
  }, [committedQuery]);

  // Placeholder text
  const placeholder = useMemo(() => {
    if (isSmartActive) {
      if (activeType === "podcast") return "Опишите, что обсуждается в подкасте (темы, фразы, гости)…";
      if (activeType === "video") return "Опишите, что происходит в видео (люди, действия, фразы, эмоции)…";
      return "Опишите, что вы ищете — по смыслу видео, подкастов и других материалов…";
    }
    return "Что посмотреть? Поиск по названию, теме, описанию...";
  }, [isSmartActive, activeType]);

  return (
    <PageTransition>
      <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Search input with button */}
        <div className="space-y-3">
          <div className="relative max-w-2xl mx-auto flex gap-0">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={placeholder}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-9 pr-2 bg-card border-border rounded-r-none border-r-0 h-11"
              />
            </div>
            <Button
              onClick={submitSearch}
              disabled={isLoading}
              className="rounded-l-none h-11 px-5 shrink-0"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Search className="h-4 w-4 mr-1.5" />
                  Найти
                </>
              )}
            </Button>
          </div>

          {/* Smart mode hint */}
          {isSmartActive && (
            <p className="text-xs text-muted-foreground max-w-2xl mx-auto flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 shrink-0 text-primary" />
              Поиск по смыслу ищет конкретные моменты по таймкоду.
            </p>
          )}

          {/* Content type chips + smart mode switch */}
          <div className="flex items-center gap-3 flex-wrap max-w-2xl mx-auto">
            <div className="flex gap-1.5 flex-wrap">
              {types.map((t) => (
                <button
                  key={t}
                  onClick={() => handleTypeChange(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeType === t
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-accent"
                  }`}
                >
                  {typeLabels[t] || t}
                </button>
              ))}
            </div>

            {/* Smart mode switch — only for video, podcast, all */}
            {activeType !== null && SMART_TYPES.has(activeType) && (
              <div className="flex rounded-lg border border-border overflow-hidden ml-auto">
                <button
                  onClick={() => setSmartMode("normal")}
                  className={`px-3 py-1 text-xs font-medium transition-colors ${
                    smartMode === "normal"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  Обычный
                </button>
                <button
                  onClick={() => {
                    setSmartMode("meaning");
                    console.log("[analytics] meaning_search_opened");
                  }}
                  className={`px-3 py-1 text-xs font-medium transition-colors border-l border-border ${
                    smartMode === "meaning"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <Sparkles className="h-3 w-3 inline mr-1 -mt-0.5" />
                  По смыслу
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Smart Search Flow (inline) ── */}
        {isSmartActive && (
          <SmartSearchInline
            query={committedQuery}
            contentType={activeType === "podcast" ? "podcast" : activeType === "video" ? "video" : "all"}
            onSwitchToNormal={handleSwitchToNormal}
            standardResults={activeType === "all" ? filtered : undefined}
          />
        )}

        {/* ── Standard States (only when NOT in smart mode) ── */}
        {!isSmartActive && (
          <>
            {/* Idle (no query) */}
            {searchState === "idle" && !activeType && (
              <SelectTabPrompt onSelectType={(t) => setActiveType(t)} />
            )}

            {/* Idle with type filter but no query */}
            {searchState === "idle" && activeType && (
              <>
                {activeType === "post" ? (
                  <div className="space-y-4 max-w-2xl mx-auto">
                    {filtered.map((item: any) => (
                      <ContentCard key={item.id} item={item} />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filtered.map((item: any) => (
                      <ContentCard key={item.id} item={item} />
                    ))}
                  </div>
                )}
                {filtered.length === 0 && (
                  <p className="text-center py-12 text-muted-foreground text-sm">
                    В этой категории пока ничего нет
                  </p>
                )}
              </>
            )}

            {/* Loading */}
            {searchState === "loading" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="space-y-3">
                    <Skeleton className="aspect-video w-full rounded-lg" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))}
              </div>
            )}

            {/* Error */}
            {searchState === "error" && (
              <div className="text-center py-16 space-y-4">
                <p className="text-muted-foreground">
                  Не удалось выполнить поиск. Попробуйте ещё раз
                </p>
                <Button variant="outline" onClick={handleRetry}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Повторить
                </Button>
              </div>
            )}

            {/* No results */}
            {searchState === "no_results" && (
              <div className="text-center py-16 space-y-4">
                <p className="text-lg font-medium text-foreground">Ничего не найдено</p>
                <p className="text-sm text-muted-foreground">
                  Попробуйте другой запрос или выберите категорию
                </p>
                <div className="flex flex-wrap gap-2 justify-center pt-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setInputValue(s);
                        setCommittedQuery(s);
                        setSearchParams({ q: s }, { replace: true });
                      }}
                      className="px-3 py-1.5 rounded-full border border-border text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Results */}
            {searchState === "results" && (
              <>
                <p className="text-sm text-muted-foreground">
                  Найдено: {filtered.length}
                </p>
                {activeType === "post" ? (
                  <div className="space-y-4 max-w-2xl mx-auto">
                    {filtered.map((item: any) => (
                      <ContentCard key={item.id} item={item} />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filtered.map((item: any) => (
                      <ContentCard key={item.id} item={item} />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </PageTransition>
  );
};

export default Explore;
