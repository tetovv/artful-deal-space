import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { ContentType } from "@/types";

/* ── Public filter shape ── */
export interface SearchFilters {
  sort: "relevance" | "newest" | "popular";
  access: "all" | "free" | "subscribed";
  family: boolean;
  meaningMode: boolean;
  duration: "any" | "short" | "medium" | "full";
  timeRange: "any" | "12m";
  quoteMode: boolean;
}

export const DEFAULT_FILTERS: SearchFilters = {
  sort: "relevance",
  access: "all",
  family: false,
  meaningMode: false,
  duration: "any",
  timeRange: "any",
  quoteMode: false,
};

/* ── URL helpers ── */
export function filtersToParams(f: SearchFilters): Record<string, string> {
  const p: Record<string, string> = {};
  if (f.sort !== "relevance") p.sort = f.sort;
  if (f.access !== "all") p.access = f.access;
  if (f.family) p.family = "1";
  if (f.meaningMode) p.mode = "meaning";
  if (f.duration !== "any") p.dur = f.duration;
  if (f.timeRange !== "any") p.time = f.timeRange;
  if (f.quoteMode) p.quote = "1";
  return p;
}

export function paramsToFilters(p: URLSearchParams): SearchFilters {
  return {
    sort: (p.get("sort") as SearchFilters["sort"]) || "relevance",
    access: (p.get("access") as SearchFilters["access"]) || "all",
    family: p.get("family") === "1",
    meaningMode: p.get("mode") === "meaning" || p.get("mode") === "smart",
    duration: (p.get("dur") as SearchFilters["duration"]) || "any",
    timeRange: (p.get("time") as SearchFilters["timeRange"]) || "any",
    quoteMode: p.get("quote") === "1",
  };
}

/* ── Segment control ── */
function Seg<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </Label>
      <div className="flex rounded-lg border border-border overflow-hidden">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex-1 px-3 py-1.5 text-xs font-medium transition-colors",
              "border-r border-border last:border-r-0",
              value === o.value
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-muted/50",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Toggle row ── */
function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="space-y-0.5">
        <Label className="text-sm font-medium">{label}</Label>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/* ── Main drawer ── */
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeType: ContentType | null;
  filters: SearchFilters;
  onApply: (f: SearchFilters) => void;
}

export function SearchFiltersDrawer({
  open,
  onOpenChange,
  activeType,
  filters,
  onApply,
}: Props) {
  const [draft, setDraft] = useState<SearchFilters>(filters);

  // Sync draft when opened
  const handleOpenChange = useCallback(
    (v: boolean) => {
      if (v) setDraft(filters);
      onOpenChange(v);
    },
    [filters, onOpenChange],
  );

  const update = <K extends keyof SearchFilters>(key: K, val: SearchFilters[K]) =>
    setDraft((prev) => ({ ...prev, [key]: val }));

  const handleApply = () => {
    onApply(draft);
    onOpenChange(false);
  };

  const handleReset = () => {
    setDraft(DEFAULT_FILTERS);
  };

  const isSmartCapable = activeType === null || activeType === "video" || activeType === "podcast";
  const isVideo = activeType === "video";
  const isPodcast = activeType === "podcast";
  const isSimple = activeType !== null && !isVideo && !isPodcast;

  const sortOptions = useMemo(
    () => [
      { value: "relevance" as const, label: "Релевантность" },
      { value: "newest" as const, label: "Новые" },
      { value: "popular" as const, label: "Популярные" },
    ],
    [],
  );

  const accessOptions = useMemo(
    () => [
      { value: "all" as const, label: "Все" },
      { value: "free" as const, label: "Бесплатные" },
      { value: "subscribed" as const, label: "По подписке" },
    ],
    [],
  );

  const durationOptions = useMemo(
    () => [
      { value: "any" as const, label: "Любая" },
      { value: "short" as const, label: "Короткие" },
      { value: "medium" as const, label: "Средние" },
      { value: "full" as const, label: "Полные" },
    ],
    [],
  );

  const timeOptions = useMemo(
    () => [
      { value: "any" as const, label: "За всё время" },
      { value: "12m" as const, label: "За 12 месяцев" },
    ],
    [],
  );

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="flex flex-col overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Фильтры</SheetTitle>
          <SheetDescription className="sr-only">
            Настройте параметры поиска
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 py-4">
          {/* ── Global filters ── */}
          <Seg label="Сортировка" value={draft.sort} options={sortOptions} onChange={(v) => update("sort", v)} />
          <Seg label="Доступ" value={draft.access} options={accessOptions} onChange={(v) => update("access", v)} />
          <ToggleRow label="Семейный режим" checked={draft.family} onChange={(v) => update("family", v)} />

          {/* ── Smart / meaning section ── */}
          {isSmartCapable && (
            <>
              <Separator />
              <ToggleRow
                label="Поиск по смыслу"
                description={
                  activeType === null
                    ? "Семантический поиск по видео и подкастам"
                    : isVideo
                      ? "Ищет по содержанию видео"
                      : "Ищет по содержанию подкаста"
                }
                checked={draft.meaningMode}
                onChange={(v) => update("meaningMode", v)}
              />
            </>
          )}

          {/* ── Video-specific ── */}
          {(isVideo || activeType === null) && !isSimple && (
            <>
              <Separator />
              <Seg
                label="Длительность"
                value={draft.duration}
                options={durationOptions}
                onChange={(v) => update("duration", v)}
              />
              <Seg
                label="Период"
                value={draft.timeRange}
                options={timeOptions}
                onChange={(v) => update("timeRange", v)}
              />
            </>
          )}

          {/* ── Podcast-specific ── */}
          {isPodcast && (
            <>
              <Separator />
              <Seg
                label="Длительность"
                value={draft.duration}
                options={durationOptions}
                onChange={(v) => update("duration", v)}
              />
              <ToggleRow
                label="Поиск цитаты"
                description="Искать точную фразу в расшифровке"
                checked={draft.quoteMode}
                onChange={(v) => update("quoteMode", v)}
              />
            </>
          )}

          {/* ── Simple types: just sort/access (already rendered above) ── */}
          {isSimple && (
            <p className="text-xs text-muted-foreground pt-2">
              Дополнительные фильтры недоступны для этого типа контента.
            </p>
          )}
        </div>

        <SheetFooter className="flex-row gap-2 pt-4 border-t border-border">
          <Button variant="ghost" size="sm" onClick={handleReset} className="text-muted-foreground">
            Сбросить
          </Button>
          <Button size="sm" onClick={handleApply} className="flex-1">
            Применить
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
