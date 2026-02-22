import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { contentItems as mockItems, contentTypeLabels } from "@/data/mockData";
import { ContentCard } from "@/components/content/ContentCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Search, Loader2, RefreshCw, Sparkles,
  Video, Mic, Music, FileText, BookOpen, Layout, Layers, SlidersHorizontal,
} from "lucide-react";
import { ContentType } from "@/types";
import { useContentItems } from "@/hooks/useDbData";
import { PageTransition } from "@/components/layout/PageTransition";
import { SelectTabPrompt } from "@/pages/Home";
import { SmartSearchInline, type ResultCounts } from "@/components/search/SmartSearchInline";
import type { SmartState } from "@/components/search/SmartSearchInline";
import {
  SearchFiltersDrawer,
  type SearchFilters,
  DEFAULT_FILTERS,
  filtersToParams,
  paramsToFilters,
} from "@/components/search/SearchFiltersDrawer";
import { cn } from "@/lib/utils";

const types: ContentType[] = ["video", "podcast", "music", "post", "book", "template"];

const typeLabels: Record<string, string> = {
  ...contentTypeLabels,
};

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  video: Video,
  podcast: Mic,
  music: Music,
  post: FileText,
  book: BookOpen,
  template: Layout,
};

type SearchState = "idle" | "loading" | "results" | "no_results" | "error";
type VideoSearchMode = "normal" | "meaning";

const SMART_TYPES = new Set<string>(["video", "podcast"]);

const Explore = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get("q") || "";
  const urlMode = searchParams.get("mode") || "";

  const [inputValue, setInputValue] = useState(urlQuery);
  const [committedQuery, setCommittedQuery] = useState(urlQuery);
  const [activeType, setActiveType] = useState<ContentType | null>(null);
  const [searchState, setSearchState] = useState<SearchState>(urlQuery ? "loading" : "idle");
  const [error, setError] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>(() => paramsToFilters(searchParams));
  const [smartMode, setSmartMode] = useState<VideoSearchMode>(
    filters.meaningMode ? "meaning" : "normal"
  );
  const [resultCounts, setResultCounts] = useState<ResultCounts>({});
  const [smartState, setSmartState] = useState<SmartState>("idle");
  const [pulsingTabs, setPulsingTabs] = useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Count active non-default filters for badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.sort !== DEFAULT_FILTERS.sort) count++;
    if (filters.access !== DEFAULT_FILTERS.access) count++;
    if (filters.family !== DEFAULT_FILTERS.family) count++;
    if (filters.duration !== DEFAULT_FILTERS.duration) count++;
    if (filters.timeRange !== DEFAULT_FILTERS.timeRange) count++;
    if (filters.excludeShorts !== DEFAULT_FILTERS.excludeShorts) count++;
    if (filters.quoteMode !== DEFAULT_FILTERS.quoteMode) count++;
    return count;
  }, [filters]);
  // Callback from SmartSearchInline
  const handleResultCounts = useCallback((counts: ResultCounts, st: SmartState) => {
    setResultCounts(counts);
    setSmartState(st);
    if (st === "results") {
      const tabsWithHits = new Set(Object.entries(counts).filter(([, v]) => v > 0).map(([k]) => k));
      setPulsingTabs(tabsWithHits);
      const timer = setTimeout(() => setPulsingTabs(new Set()), 1600);
      return () => clearTimeout(timer);
    } else {
      setPulsingTabs(new Set());
    }
  }, []);

  const { data: dbItems, isLoading, isError, refetch } = useContentItems();

  // Is smart mode active?
  const isSmartActive = smartMode === "meaning" && (activeType === null || SMART_TYPES.has(activeType));

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
    return allItems.filter((item: any) => {
      const q = committedQuery.toLowerCase();
      const matchSearch = !committedQuery ||
        item.title.toLowerCase().includes(q) ||
        (item.description || "").toLowerCase().includes(q) ||
        (item.tags || []).some((t: string) => t.toLowerCase().includes(q));
      const matchType = !activeType || item.type === activeType;
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

  const buildParams = useCallback((q: string, f: SearchFilters) => {
    const params: Record<string, string> = {};
    if (q) params.q = q;
    if (f.meaningMode) params.mode = "meaning";
    const fp = filtersToParams(f);
    delete fp.mode; // already handled above
    Object.assign(params, fp);
    return params;
  }, []);

  const submitSearch = useCallback(() => {
    const q = inputValue.trim();
    setCommittedQuery(q);
    setSearchParams(buildParams(q, filters), { replace: true });
    setError(false);
  }, [inputValue, setSearchParams, filters, buildParams]);

  const handleApplyFilters = useCallback((newFilters: SearchFilters) => {
    setFilters(newFilters);
    // Sync meaning mode from filters
    setSmartMode(newFilters.meaningMode ? "meaning" : "normal");
    // Update URL with current query + new filters
    const q = committedQuery;
    setSearchParams(buildParams(q, newFilters), { replace: true });
  }, [committedQuery, setSearchParams, buildParams]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading) {
      e.preventDefault();
      submitSearch();
    }
  };

  const handleRetry = () => {
    setError(false);
    refetch();
    submitSearch();
  };

  const handleTypeChange = (t: ContentType) => {
    const newType = activeType === t ? null : t;
    setActiveType(newType);
    // Reset smart mode when switching to a non-smart-capable type
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
        <div className="space-y-3 max-w-2xl">
          <div className="flex gap-2 items-start">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={placeholder}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-9 pr-9 bg-card border-border h-11"
              />
              {isLoading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            <button
              onClick={() => setFiltersOpen(true)}
              className={cn(
                "relative flex items-center justify-center h-11 w-11 shrink-0 rounded-md border border-border bg-card transition-colors hover:bg-muted/50",
                activeFilterCount > 0 && "border-primary/50",
              )}
              aria-label="Фильтры"
            >
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold leading-none">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
          {!committedQuery && (
            <p className="text-xs text-muted-foreground">
              Нажмите Enter для поиска
            </p>
          )}

          {/* Smart mode hint */}
          {isSmartActive && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 shrink-0 text-primary" />
              Поиск по смыслу ищет конкретные моменты по таймкоду.
            </p>
          )}

          {/* Content type tab bar */}
          <div>
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide border-b border-border pb-0">
              {types.map((t) => {
                const Icon = typeIcons[t] || Layers;
                const isActive = activeType === t;
                const count = resultCounts[t] || 0;
                const hasPulse = isSmartActive && pulsingTabs.has(t);
                const hasCount = isSmartActive && smartState === "results" && count > 0;

                return (
                  <button
                    key={t}
                    onClick={() => handleTypeChange(t)}
                    className={cn(
                      "relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors shrink-0",
                      "border-b-2 -mb-px",
                      isActive
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30",
                      hasPulse && "tab-pulse",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 truncate">{typeLabels[t] || t}</span>
                    {hasCount && (
                      <Badge
                        variant="secondary"
                        className="ml-0.5 h-[18px] min-w-[18px] px-1 text-[10px] leading-none font-semibold rounded-full"
                      >
                        {count}
                      </Badge>
                    )}
                  </button>
                );
              })}

              {/* Smart mode switch — right-aligned */}
              {(activeType === null || SMART_TYPES.has(activeType)) && (
                <div className="flex rounded-lg border border-border overflow-hidden ml-auto shrink-0">
                  <button
                    onClick={() => {
                      setSmartMode("normal");
                      setFilters((f) => ({ ...f, meaningMode: false }));
                    }}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium transition-colors",
                      smartMode === "normal"
                        ? "bg-primary text-primary-foreground"
                        : "bg-card text-muted-foreground hover:bg-muted/50",
                    )}
                  >
                    Обычный
                  </button>
                  <button
                    onClick={() => {
                      setSmartMode("meaning");
                      setFilters((f) => ({ ...f, meaningMode: true }));
                    }}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium transition-colors border-l border-border",
                      smartMode === "meaning"
                        ? "bg-primary text-primary-foreground"
                        : "bg-card text-muted-foreground hover:bg-muted/50",
                    )}
                  >
                    <Sparkles className="h-3 w-3 inline mr-1 -mt-0.5" />
                    По смыслу
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Smart Search Flow (inline) ── */}
        {isSmartActive && (
          <>
            {/* Smart summary for "Все" mode */}
            {activeType === null && smartState === "results" && Object.keys(resultCounts).length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground max-w-2xl mx-auto bg-muted/30 rounded-lg px-4 py-2.5">
                <span className="font-medium text-foreground">Найдено:</span>
                {Object.entries(resultCounts)
                  .filter(([, v]) => v > 0)
                  .map(([type, count]) => (
                    <button
                      key={type}
                      onClick={() => handleTypeChange(type as ContentType)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                    >
                      {typeLabels[type] || type} ({count})
                    </button>
                  ))}
              </div>
            )}
            <SmartSearchInline
              query={committedQuery}
              contentType={activeType === "podcast" ? "podcast" : activeType === "video" ? "video" : "all"}
              onSwitchToNormal={handleSwitchToNormal}
              standardResults={activeType === null ? filtered : undefined}
              onResultCounts={handleResultCounts}
            />
          </>
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

      <SearchFiltersDrawer
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        activeType={activeType}
        filters={filters}
        onApply={handleApplyFilters}
      />
    </PageTransition>
  );
};

export default Explore;
