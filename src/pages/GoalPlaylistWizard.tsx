import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  BookOpen, Headphones, Zap, Clock, ListMusic,
  ChevronDown, Loader2, Video, FileText, Music, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

const GOALS = [
  { value: "understand", label: "Разобраться в теме", icon: BookOpen, desc: "Глубокое погружение" },
  { value: "practical", label: "Получить шаги", icon: Zap, desc: "Практические действия" },
  { value: "background", label: "Фоновое прослушивание", icon: Headphones, desc: "Аудио в дороге" },
  { value: "overview", label: "Быстрый обзор", icon: Clock, desc: "Ключевые моменты" },
];

const TIME_OPTIONS = [10, 20, 45, 90];

const MIX_OPTIONS = [
  { value: "video", label: "Больше видео", icon: Video },
  { value: "audio", label: "Больше аудио", icon: Music },
  { value: "reading", label: "Больше чтения", icon: FileText },
];

const SCOPE_OPTIONS = [
  { value: "platform", label: "Контент платформы", desc: "Публичный каталог" },
  { value: "library", label: "Включить Библиотеку", desc: "Ваши закладки и покупки" },
  { value: "all", label: "Включить Рабочее пространство", desc: "Артефакты проектов (по умолчанию выключено)" },
];

export default function GoalPlaylistWizard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [goalType, setGoalType] = useState<string | null>(null);
  const [timeBudget, setTimeBudget] = useState<number | null>(null);
  const [mixPref, setMixPref] = useState<string | null>(null);
  const [scope, setScope] = useState("platform");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [building, setBuilding] = useState(false);

  const canBuild = goalType && timeBudget && !building;

  const handleBuild = async () => {
    if (!canBuild || !user) return;
    setBuilding(true);
    console.log("[analytics] goal_selected", goalType);
    console.log("[analytics] time_budget_selected", timeBudget);

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
            goalType,
            timeBudget,
            mixPrefs: mixPref ? { preference: mixPref } : {},
            scope,
          }),
        }
      );

      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      console.log("[analytics] playlist_created");

      if (data.status === "empty") {
        toast.warning("Недостаточно контента для создания плейлиста");
        setBuilding(false);
        return;
      }

      navigate(`/playlists/${data.id}`);
    } catch {
      toast.error("Не удалось создать плейлист");
      setBuilding(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <ListMusic className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Целевой плейлист</h1>
          <p className="text-sm text-muted-foreground">Подборка контента под вашу задачу</p>
        </div>
      </div>

      {/* Step 1: Goal */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Цель</label>
        <div className="grid grid-cols-2 gap-2">
          {GOALS.map(g => {
            const Icon = g.icon;
            const selected = goalType === g.value;
            return (
              <button
                key={g.value}
                onClick={() => setGoalType(g.value)}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  selected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`h-4 w-4 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="text-sm font-medium">{g.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">{g.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2: Time */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Бюджет времени</label>
        <div className="flex gap-2">
          {TIME_OPTIONS.map(t => (
            <button
              key={t}
              onClick={() => setTimeBudget(t)}
              className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                timeBudget === t
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {t} мин
            </button>
          ))}
        </div>
      </div>

      {/* Advanced options */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
            Дополнительные настройки
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-3">
          {/* Mix preference */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Предпочтение формата</label>
            <div className="flex gap-2">
              {MIX_OPTIONS.map(m => {
                const Icon = m.icon;
                const selected = mixPref === m.value;
                return (
                  <button
                    key={m.value}
                    onClick={() => setMixPref(selected ? null : m.value)}
                    className={`flex-1 py-2 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                      selected
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scope */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Источники</label>
            <div className="space-y-1.5">
              {SCOPE_OPTIONS.map(s => (
                <button
                  key={s.value}
                  onClick={() => setScope(s.value)}
                  className={`w-full p-2.5 rounded-lg border text-left transition-colors ${
                    scope === s.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <span className="text-sm font-medium">{s.label}</span>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </button>
              ))}
            </div>
            {scope === "all" && (
              <p className="text-xs text-warning flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Артефакты рабочего пространства могут содержать конфиденциальные данные.
              </p>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* CTA */}
      <Button
        className="w-full"
        onClick={handleBuild}
        disabled={!canBuild}
      >
        {building ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Подбираем контент…</>
        ) : (
          <><ListMusic className="h-4 w-4 mr-2" /> Собрать плейлист</>
        )}
      </Button>
    </div>
  );
}
