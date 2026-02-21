import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft, ArrowRight, Video, FileText, Mic, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NICHES = ["Образование", "Технологии", "Дизайн", "Фото", "Музыка", "Подкасты", "Бизнес", "Видео", "Motion"];

const PLACEMENT_TYPES = [
  { value: "video", label: "Видео-интеграция", icon: Video, desc: "Рекламная вставка в видео" },
  { value: "post", label: "Пост", icon: FileText, desc: "Рекламный пост в канале" },
  { value: "podcast", label: "Подкаст", icon: Mic, desc: "Спонсорская вставка в подкасте" },
] as const;

export interface BriefData {
  placementType: string;
  budgetMin: number;
  budgetMax: number;
  deadline: string;
  turnaroundDays: number;
  niches: string[];
  audienceMin: number;
  audienceMax: number;
  excludeNoAnalytics: boolean;
  briefText: string;
}

const defaultBrief: BriefData = {
  placementType: "",
  budgetMin: 0,
  budgetMax: 200000,
  deadline: "",
  turnaroundDays: 14,
  niches: [],
  audienceMin: 0,
  audienceMax: 1000000,
  excludeNoAnalytics: false,
  briefText: "",
};

const STEPS = [
  { title: "Тип размещения", subtitle: "Выберите формат" },
  { title: "Бюджет и сроки", subtitle: "Укажите рамки" },
  { title: "Ниша и аудитория", subtitle: "Целевые параметры" },
  { title: "Требования", subtitle: "Бриф и условия" },
];

interface BriefWizardProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (brief: BriefData) => void;
}

export function BriefWizard({ open, onClose, onSubmit }: BriefWizardProps) {
  const [step, setStep] = useState(0);
  const [brief, setBrief] = useState<BriefData>({ ...defaultBrief });

  const update = <K extends keyof BriefData>(key: K, val: BriefData[K]) =>
    setBrief((prev) => ({ ...prev, [key]: val }));

  const toggleNiche = (val: string) => {
    setBrief((prev) => ({
      ...prev,
      niches: prev.niches.includes(val) ? prev.niches.filter((v) => v !== val) : [...prev.niches, val],
    }));
  };

  const canNext = () => {
    if (step === 0) return brief.placementType !== "";
    return true;
  };

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
    else {
      onSubmit(brief);
      setStep(0);
      setBrief({ ...defaultBrief });
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleClose = () => {
    onClose();
    setStep(0);
    setBrief({ ...defaultBrief });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-[600px] max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-lg font-semibold">Подобрать авторов по брифу</DialogTitle>
          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-3">
            {STEPS.map((s, i) => (
              <div key={i} className="flex items-center gap-2 flex-1">
                <div className={cn(
                  "h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors",
                  i < step ? "bg-primary text-primary-foreground" :
                  i === step ? "bg-primary text-primary-foreground" :
                  "bg-muted text-muted-foreground"
                )}>
                  {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <div className="min-w-0 hidden sm:block">
                  <p className={cn("text-[12px] font-medium leading-tight truncate",
                    i <= step ? "text-foreground" : "text-muted-foreground"
                  )}>{s.title}</p>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn("h-px flex-1", i < step ? "bg-primary" : "bg-border")} />
                )}
              </div>
            ))}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-5 pb-2">
            {/* ── Step 0: Placement type ── */}
            {step === 0 && (
              <>
                <SectionLabel>Формат размещения <span className="text-destructive">*</span></SectionLabel>
                <div className="space-y-2">
                  {PLACEMENT_TYPES.map((pt) => {
                    const Icon = pt.icon;
                    const selected = brief.placementType === pt.value;
                    return (
                      <button
                        key={pt.value}
                        onClick={() => update("placementType", pt.value)}
                        className={cn(
                          "w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
                          selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/30 bg-background"
                        )}
                      >
                        <Icon className={cn("h-5 w-5 shrink-0", selected ? "text-primary" : "text-muted-foreground")} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-medium text-foreground">{pt.label}</p>
                          <p className="text-[13px] text-muted-foreground">{pt.desc}</p>
                        </div>
                        {selected && <Check className="h-4 w-4 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[12px] text-muted-foreground">Все сделки проходят только внутри платформы</p>
              </>
            )}

            {/* ── Step 1: Budget & timing ── */}
            {step === 1 && (
              <>
                <SectionLabel>Бюджет (₽)</SectionLabel>
                <div className="space-y-3">
                  <Slider
                    min={0} max={500000} step={5000}
                    value={[brief.budgetMin, brief.budgetMax]}
                    onValueChange={(v) => {
                      update("budgetMin", v[0]);
                      update("budgetMax", v[1]);
                    }}
                  />
                  <div className="flex justify-between text-[13px] text-muted-foreground">
                    <span>{brief.budgetMin.toLocaleString("ru-RU")} ₽</span>
                    <span>{brief.budgetMax >= 500000 ? "500K+ ₽" : `${brief.budgetMax.toLocaleString("ru-RU")} ₽`}</span>
                  </div>
                </div>

                <SectionLabel>Дедлайн / окно публикации</SectionLabel>
                <Input
                  type="date"
                  value={brief.deadline}
                  onChange={(e) => update("deadline", e.target.value)}
                  className="bg-background h-10 max-w-[220px]"
                />

                <SectionLabel>Максимальный срок выполнения</SectionLabel>
                <div className="flex items-center gap-3">
                  <Slider
                    min={1} max={30} step={1}
                    value={[brief.turnaroundDays]}
                    onValueChange={(v) => update("turnaroundDays", v[0])}
                    className="flex-1"
                  />
                  <span className="text-[14px] font-medium text-foreground whitespace-nowrap w-16 text-right">
                    ≤ {brief.turnaroundDays} дн
                  </span>
                </div>
              </>
            )}

            {/* ── Step 2: Audience & niche ── */}
            {step === 2 && (
              <>
                <SectionLabel>Ниша / Категория</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {NICHES.map((n) => (
                    <button
                      key={n}
                      onClick={() => toggleNiche(n)}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-[13px] border transition-colors",
                        brief.niches.includes(n)
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-border text-muted-foreground hover:border-primary/30"
                      )}
                    >{n}</button>
                  ))}
                </div>

                <SectionLabel>Размер аудитории</SectionLabel>
                <div className="space-y-3">
                  <Slider
                    min={0} max={1000000} step={10000}
                    value={[brief.audienceMin, brief.audienceMax]}
                    onValueChange={(v) => {
                      update("audienceMin", v[0]);
                      update("audienceMax", v[1]);
                    }}
                  />
                  <div className="flex justify-between text-[13px] text-muted-foreground">
                    <span>{(brief.audienceMin / 1000).toFixed(0)}K</span>
                    <span>{brief.audienceMax >= 1000000 ? "1M+" : `${(brief.audienceMax / 1000).toFixed(0)}K`}</span>
                  </div>
                </div>

                <Separator />
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <Checkbox
                    checked={brief.excludeNoAnalytics}
                    onCheckedChange={(v) => update("excludeNoAnalytics", !!v)}
                  />
                  <span className="text-[14px] text-foreground">Не показывать авторов без подключённой аналитики</span>
                </label>
              </>
            )}

            {/* ── Step 3: Requirements ── */}
            {step === 3 && (
              <>
                <SectionLabel>Бриф</SectionLabel>
                <Textarea
                  value={brief.briefText}
                  onChange={(e) => update("briefText", e.target.value)}
                  placeholder={"• Ключевое сообщение: …\n• Призыв к действию (CTA): …\n• Ограничения: …"}
                  className="min-h-[120px] text-[14px] bg-background resize-none"
                  maxLength={2000}
                />
                <p className="text-[12px] text-muted-foreground text-right">{brief.briefText.length} / 2000</p>
              </>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border">
          <Button variant="ghost" onClick={handleBack} disabled={step === 0} className="gap-1.5 text-[14px]">
            <ArrowLeft className="h-4 w-4" />Назад
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-muted-foreground">Шаг {step + 1} из {STEPS.length}</span>
            <Button onClick={handleNext} disabled={!canNext()} className="gap-1.5 text-[14px]">
              {step < 3 ? (
                <>Далее<ArrowRight className="h-4 w-4" /></>
              ) : (
                <>Найти авторов</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider">{children}</p>
  );
}
