import { useState, useMemo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePickerField } from "@/components/ui/date-picker-field";
import {
  ArrowLeft, ArrowRight, CheckCircle2, Image, Video, Link2, Type,
  CalendarDays, Wallet, ShieldCheck, AlertTriangle, Loader2, Lock,
  MonitorPlay, Rss, LayoutGrid, Upload, Eye, Rocket,
} from "lucide-react";
import { toast } from "sonner";
import type { Campaign, Placement } from "./CampaignManageView";
import { saveDraft, deleteDraft, createDraftId, fileToDataUrl, dataUrlToFile, type CampaignDraft } from "./campaignDrafts";

interface ManualCampaignWizardProps {
  isVerified: boolean;
  ordConnected: boolean;
  onBack: () => void;
  onComplete: (campaign: Campaign) => void;
  onGoToSettings: () => void;
  initialDraft?: CampaignDraft;
}

type WizardStep = 1 | 2 | 3 | 4 | 5;

const STEP_LABELS: Record<WizardStep, string> = {
  1: "Размещение",
  2: "Креатив",
  3: "Бюджет и расписание",
  4: "Маркировка (ОРД)",
  5: "Обзор и запуск",
};

interface PlacementOption {
  value: Placement;
  label: string;
  description: string;
  icon: React.ElementType;
  dimensions: string;
}

const PLACEMENTS: PlacementOption[] = [
  { value: "banner", label: "Баннер в каталоге", description: "Горизонтальный баннер среди карточек контента", icon: MonitorPlay, dimensions: "728×90 или 1200×300" },
  { value: "feed", label: "Промо в ленте подписок", description: "Карточка-промо в ленте подписок пользователя", icon: Rss, dimensions: "600×400 или 1:1" },
  { value: "recommendations", label: "Рекомендации — карточка", description: "Карточка в блоке рекомендаций", icon: LayoutGrid, dimensions: "300×250 или 4:3" },
];

const ACCEPTED_IMAGE = ".jpg,.jpeg,.png,.webp";
const ACCEPTED_VIDEO = ".mp4,.webm";
const MAX_FILE_MB = 10;

export function ManualCampaignWizard({ isVerified, ordConnected, onBack, onComplete, onGoToSettings, initialDraft }: ManualCampaignWizardProps) {
  const draftIdRef = useRef(initialDraft?.id ?? createDraftId());
  const [step, setStep] = useState<WizardStep>((initialDraft?.step ?? 1) as WizardStep);

  // Step 1 - Placement
  const [placement, setPlacement] = useState<Placement | null>(initialDraft?.placement ?? null);

  // Step 2 - Creative
  const [creativeFile, setCreativeFile] = useState<File | null>(() => {
    if (initialDraft?.creativeDataUrl && initialDraft.creativeFileName) {
      return dataUrlToFile(initialDraft.creativeDataUrl, initialDraft.creativeFileName);
    }
    return null;
  });
  const [creativePreview, setCreativePreview] = useState<string | null>(initialDraft?.creativeDataUrl ?? null);
  const [creativeType, setCreativeType] = useState<"image" | "video" | null>(initialDraft?.creativeType ?? null);
  const [destinationUrl, setDestinationUrl] = useState(initialDraft?.destinationUrl ?? "");
  const [utmParams, setUtmParams] = useState(initialDraft?.utmParams ?? "");
  const [creativeTitle, setCreativeTitle] = useState(initialDraft?.creativeTitle ?? "");
  const [creativeText, setCreativeText] = useState(initialDraft?.creativeText ?? "");

  // Step 3 - Budget & schedule
  const [totalBudget, setTotalBudget] = useState(initialDraft?.totalBudget ?? "");
  const [startDateVal, setStartDateVal] = useState<Date | undefined>(initialDraft?.startDate ? new Date(initialDraft.startDate) : undefined);
  const [endDateVal, setEndDateVal] = useState<Date | undefined>(initialDraft?.endDate ? new Date(initialDraft.endDate) : undefined);
  const [noEndDate, setNoEndDate] = useState(initialDraft?.noEndDate ?? false);
  const [dailyCap, setDailyCap] = useState(initialDraft?.dailyCap ?? "");

  // Step 4 - ORD
  const [eridStatus, setEridStatus] = useState<"idle" | "pending" | "issued">("idle");
  const [eridValue, setEridValue] = useState("");

  // Step 5 - launching
  const [launching, setLaunching] = useState(false);

  // Audit log
  const [auditLog, setAuditLog] = useState<{ timestamp: string; action: string; user: string }[]>([]);

  // Track creative data URL for draft persistence
  const [creativeDataUrl, setCreativeDataUrl] = useState<string | null>(initialDraft?.creativeDataUrl ?? null);

  // Convert file to data URL when creative changes
  useEffect(() => {
    if (creativeFile && !creativeDataUrl) {
      fileToDataUrl(creativeFile)
        .then((url) => { if (url) setCreativeDataUrl(url); })
        .catch(() => { /* file too large or unreadable — skip persisting */ });
    }
  }, [creativeFile]);

  // ── Auto-save draft ──
  useEffect(() => {
    const draft: CampaignDraft = {
      id: draftIdRef.current,
      updatedAt: new Date().toISOString(),
      step,
      placement,
      destinationUrl,
      utmParams,
      creativeTitle,
      creativeText,
      totalBudget,
      startDate: startDateVal?.toISOString() ?? null,
      endDate: endDateVal?.toISOString() ?? null,
      noEndDate,
      dailyCap,
      creativeFileName: creativeFile?.name ?? initialDraft?.creativeFileName ?? null,
      creativeFileSize: creativeFile?.size ?? initialDraft?.creativeFileSize ?? null,
      creativeType,
      creativeDataUrl,
    };
    try {
      saveDraft(draft);
    } catch {
      // localStorage quota exceeded — try saving without the file data
      try {
        saveDraft({ ...draft, creativeDataUrl: null });
      } catch {
        // localStorage completely full — silently skip
      }
    }
  }, [step, placement, destinationUrl, utmParams, creativeTitle, creativeText, totalBudget, startDateVal, endDateVal, noEndDate, dailyCap, creativeFile, creativeType, creativeDataUrl]);

  const addAudit = (action: string) => {
    setAuditLog((prev) => [...prev, { timestamp: new Date().toISOString(), action, user: "Вы" }]);
  };

  // Navigation
  const canNext = useMemo(() => {
    switch (step) {
      case 1: return placement !== null;
      case 2: return creativeFile !== null && destinationUrl.trim().length > 0;
      case 3: return totalBudget.trim().length > 0 && Number(totalBudget) > 0 && startDateVal !== undefined;
      case 4: return true; // Can view step 5 even without ERID, launch is blocked
      case 5: return false;
      default: return false;
    }
  }, [step, placement, creativeFile, destinationUrl, totalBudget, startDateVal]);

  const goNext = () => {
    if (step < 5) setStep((step + 1) as WizardStep);
  };
  const goBack = () => {
    if (step > 1) setStep((step - 1) as WizardStep);
    else onBack();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error(`Файл слишком большой (макс. ${MAX_FILE_MB} МБ)`);
      return;
    }
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isVideo && !isImage) {
      toast.error("Поддерживаются только изображения (JPG, PNG, WebP) и видео (MP4, WebM)");
      return;
    }
    setCreativeFile(file);
    setCreativeType(isVideo ? "video" : "image");
    setCreativePreview(URL.createObjectURL(file));
    setCreativeDataUrl(null); // will be computed by useEffect
    addAudit("Креатив загружен: " + file.name);
  };

  const requestErid = () => {
    if (!isVerified || !ordConnected) return;
    setEridStatus("pending");
    addAudit("Запрос ERID отправлен");
    // Simulate ERID issuance after 2s
    setTimeout(() => {
      const fakeErid = "ORD-" + Math.random().toString(36).substring(2, 10).toUpperCase();
      setEridValue(fakeErid);
      setEridStatus("issued");
      addAudit("ERID получен: " + fakeErid);
    }, 2000);
  };

  const canLaunch = eridStatus === "issued" && isVerified && ordConnected;

  const handleLaunch = () => {
    if (!canLaunch) return;
    setLaunching(true);
    addAudit("Кампания запущена");
    setTimeout(() => {
      const newCampaign: Campaign = {
        id: Date.now(),
        name: creativeTitle || "Новая кампания",
        placement: placement!,
        status: "active",
        impressions: 0,
        clicks: 0,
        ctr: 0,
        budget: Number(totalBudget),
        spent: 0,
        startDate: startDateVal ? startDateVal.toISOString().split("T")[0] : "",
        endDate: noEndDate ? "" : (endDateVal ? endDateVal.toISOString().split("T")[0] : ""),
        erid: eridValue,
        ordProvider: "MediaOS ОРД",
        ordStatus: "connected",
        auditLog: [...auditLog, { timestamp: new Date().toISOString(), action: "Кампания запущена", user: "Вы" }],
      };
      deleteDraft(draftIdRef.current);
      onComplete(newCampaign);
      toast.success("Кампания запущена!");
    }, 1200);
  };

  // ── Stepper ──
  const stepper = (
    <div className="flex items-center gap-1.5 mb-6">
      {([1, 2, 3, 4, 5] as WizardStep[]).map((s) => {
        const isDone = s < step;
        const isCurrent = s === step;
        return (
          <div key={s} className="flex items-center gap-1.5 flex-1">
            <button
              type="button"
              onClick={() => s < step && setStep(s)}
              disabled={s > step}
              className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors ${
                isDone ? "bg-primary text-primary-foreground" :
                isCurrent ? "bg-primary text-primary-foreground ring-2 ring-primary/30" :
                "bg-muted text-muted-foreground"
              }`}
            >
              {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : s}
            </button>
            <span className={`text-[12px] hidden sm:inline truncate ${isCurrent ? "text-foreground font-medium" : "text-muted-foreground"}`}>
              {STEP_LABELS[s]}
            </span>
            {s < 5 && <div className={`flex-1 h-px ${isDone ? "bg-primary/50" : "bg-border"}`} />}
          </div>
        );
      })}
    </div>
  );

  // ═══ Step 1: Placement ═══
  const stepPlacement = (
    <div className="space-y-5">
      <div>
        <h3 className="text-[15px] font-semibold text-foreground">Выберите тип размещения</h3>
        <p className="text-[13px] text-muted-foreground mt-0.5">Определяет, где будет показан ваш креатив</p>
      </div>
      <div className="grid gap-3">
        {PLACEMENTS.map((p) => {
          const Icon = p.icon;
          const selected = placement === p.value;
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => setPlacement(p.value)}
              className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
                selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/30 bg-card"
              }`}
            >
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
              }`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[14px] font-medium ${selected ? "text-primary" : "text-foreground"}`}>{p.label}</p>
                <p className="text-[12px] text-muted-foreground mt-0.5">{p.description}</p>
                <p className="text-[11px] text-muted-foreground/70 mt-1">Размеры: {p.dimensions}</p>
              </div>
              {selected && <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />}
            </button>
          );
        })}
      </div>
    </div>
  );

  // ═══ Step 2: Creative ═══
  const stepCreative = (
    <div className="space-y-5">
      <div>
        <h3 className="text-[15px] font-semibold text-foreground">Креатив</h3>
        <p className="text-[13px] text-muted-foreground mt-0.5">Загрузите изображение или видео для размещения</p>
      </div>

      {/* Upload area */}
      <div className="space-y-2">
        <Label className="text-[13px]">Файл креатива *</Label>
        {creativePreview ? (
          <div className="space-y-2">
            <div className="relative rounded-lg border border-border overflow-hidden bg-muted/30 w-full max-w-full">
              {creativeType === "video" ? (
                <video src={creativePreview} className="w-full max-h-[280px] object-contain" controls muted />
              ) : (
                <img src={creativePreview} alt="Preview" className="w-full max-h-[280px] object-contain" />
              )}
              <Badge variant="secondary" className="absolute top-2 left-2 text-[10px] max-w-[80%] truncate">
                {creativeFile?.name}
              </Badge>
            </div>
            <Button variant="outline" size="sm" className="text-[12px]" onClick={() => {
              setCreativeFile(null);
              setCreativePreview(null);
              setCreativeType(null);
            }}>
              Заменить
            </Button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border hover:border-primary/40 bg-muted/20 cursor-pointer py-8 transition-colors">
            <Upload className="h-8 w-8 text-muted-foreground/50" />
            <span className="text-[13px] text-muted-foreground">Перетащите или нажмите для загрузки</span>
            <span className="text-[11px] text-muted-foreground/60">JPG, PNG, WebP, MP4, WebM · макс. {MAX_FILE_MB} МБ</span>
            <input type="file" className="hidden" accept={`${ACCEPTED_IMAGE},${ACCEPTED_VIDEO}`} onChange={handleFileChange} />
          </label>
        )}
      </div>

      <Separator />

      {/* Destination URL */}
      <div className="space-y-1.5">
        <Label className="text-[13px]">Ссылка назначения *</Label>
        <div className="relative">
          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="https://example.com/promo" value={destinationUrl} onChange={(e) => setDestinationUrl(e.target.value)} className="pl-9 text-[14px]" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-[13px]">UTM-параметры <span className="text-muted-foreground">(опционально)</span></Label>
        <Input placeholder="utm_source=mediaos&utm_medium=banner" value={utmParams} onChange={(e) => setUtmParams(e.target.value)} className="text-[14px]" />
      </div>

      <Separator />

      {/* Title & text */}
      <div className="space-y-1.5">
        <Label className="text-[13px]">Заголовок <span className="text-muted-foreground">(для промо и рекомендаций)</span></Label>
        <Input placeholder="Весенняя распродажа — скидки до 50%" value={creativeTitle} onChange={(e) => setCreativeTitle(e.target.value)} className="text-[14px]" maxLength={80} />
        <p className="text-[11px] text-muted-foreground text-right">{creativeTitle.length}/80</p>
      </div>
      <div className="space-y-1.5">
        <Label className="text-[13px]">Описание <span className="text-muted-foreground">(опционально)</span></Label>
        <Textarea placeholder="Короткое описание для пользователя" value={creativeText} onChange={(e) => setCreativeText(e.target.value)} className="text-[14px] min-h-[60px]" maxLength={200} />
        <p className="text-[11px] text-muted-foreground text-right">{creativeText.length}/200</p>
      </div>
    </div>
  );

  // ═══ Step 3: Budget & Schedule ═══
  const stepBudget = (
    <div className="space-y-5">
      <div>
        <h3 className="text-[15px] font-semibold text-foreground">Бюджет и расписание</h3>
        <p className="text-[13px] text-muted-foreground mt-0.5">После старта общий бюджет нельзя уменьшить ниже потраченного</p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[13px]">Общий бюджет (₽) *</Label>
        <CurrencyInput
          value={totalBudget}
          onChange={setTotalBudget}
          placeholder="15 000"
          min={100}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-[13px]">Дата старта *</Label>
          <DatePickerField
            value={startDateVal}
            onChange={setStartDateVal}
            placeholder="Выберите дату"
            minDate={new Date()}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[13px] flex items-center gap-2">
            Дата окончания
            <div className="flex items-center gap-1.5 ml-auto">
              <Switch checked={noEndDate} onCheckedChange={setNoEndDate} className="scale-75" />
              <span className="text-[11px] text-muted-foreground">Без даты</span>
            </div>
          </Label>
          <DatePickerField
            value={endDateVal}
            onChange={setEndDateVal}
            placeholder="Выберите дату"
            minDate={startDateVal || new Date()}
            disabled={noEndDate}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[13px]">Дневной лимит (₽) <span className="text-muted-foreground">(опционально)</span></Label>
        <CurrencyInput
          value={dailyCap}
          onChange={setDailyCap}
          placeholder="1 000"
          min={0}
        />
        <p className="text-[11px] text-muted-foreground">Если указан — расходы в день не превысят эту сумму</p>
      </div>
    </div>
  );

  // ═══ Step 4: ORD / Marking ═══
  const stepOrd = (
    <div className="space-y-4">
      <div>
        <h3 className="text-[15px] font-semibold text-foreground">Маркировка рекламы (ОРД)</h3>
        <p className="text-[13px] text-muted-foreground mt-0.5">Обязательна для запуска кампании по закону РФ</p>
      </div>

      {/* ORD provider - fixed */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="text-[14px] font-medium text-foreground">Провайдер ОРД</span>
            </div>
            <Badge variant="outline" className="text-[11px]">MediaOS ОРД</Badge>
          </div>

          {!isVerified || !ordConnected ? (
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                <p className="text-[13px] text-foreground font-medium">Верификация не завершена</p>
              </div>
              <p className="text-[12px] text-muted-foreground">
                Для получения ERID и запуска кампании необходимо подтвердить реквизиты и подключить ОРД в настройках.
              </p>
              <Button size="sm" variant="outline" className="text-[12px]" onClick={onGoToSettings}>
                <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                Пройти верификацию / подключить ОРД
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[13px]">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-foreground">ОРД подключён, верификация пройдена</span>
              </div>

              {/* ERID request */}
              {eridStatus === "idle" && (
                <Button size="sm" onClick={requestErid} className="text-[13px]">
                  Запросить ERID для креатива
                </Button>
              )}
              {eridStatus === "pending" && (
                <div className="flex items-center gap-2 rounded-md bg-warning/10 border border-warning/20 px-3 py-2">
                  <Loader2 className="h-4 w-4 text-warning animate-spin" />
                  <span className="text-[13px] text-warning font-medium">Ожидание ERID…</span>
                </div>
              )}
              {eridStatus === "issued" && (
                <div className="flex items-center gap-2 rounded-md bg-primary/10 border border-primary/20 px-3 py-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="text-[13px] text-foreground">ERID получен:</span>
                  <span className="text-[13px] font-mono font-semibold text-primary">{eridValue}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // ═══ Step 5: Review & Launch ═══
  const selectedPlacement = PLACEMENTS.find((p) => p.value === placement);

  const stepReview = (
    <div className="space-y-4">
      <div>
        <h3 className="text-[15px] font-semibold text-foreground">Обзор кампании</h3>
        <p className="text-[13px] text-muted-foreground mt-0.5">Проверьте все параметры перед запуском</p>
      </div>

      {/* Placement */}
      <Card>
        <CardContent className="p-4 space-y-1">
          <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">Размещение</p>
          <p className="text-[14px] text-foreground">{selectedPlacement?.label}</p>
        </CardContent>
      </Card>

      {/* Creative */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">Креатив</p>
          {creativePreview && creativeFile && (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-2.5">
              <div className="rounded-md border border-border overflow-hidden bg-muted/30 w-20 h-14 shrink-0">
                {creativeType === "video" ? (
                  <video src={creativePreview} className="w-full h-full object-contain" muted />
                ) : (
                  <img src={creativePreview} alt="" className="w-full h-full object-contain" />
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-0.5">
                <p className="text-[13px] font-medium text-foreground truncate">{creativeFile.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {creativeType === "video" ? "Видео" : "Изображение"} · {(creativeFile.size / 1024).toFixed(0)} КБ
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[11px] px-2"
                  onClick={() => window.open(creativePreview, "_blank")}
                >
                  <Eye className="h-3 w-3 mr-1" />Открыть
                </Button>
              </div>
            </div>
          )}
          <div className="space-y-0.5 text-[13px]">
            {creativeTitle && <p className="font-medium text-foreground">{creativeTitle}</p>}
            {creativeText && <p className="text-muted-foreground line-clamp-2">{creativeText}</p>}
            <p className="text-primary text-[12px] truncate">{destinationUrl}{utmParams ? `?${utmParams}` : ""}</p>
          </div>
        </CardContent>
      </Card>

      {/* Budget */}
      <Card>
        <CardContent className="p-4 space-y-1">
          <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">Бюджет и расписание</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
            <span className="text-muted-foreground">Общий бюджет</span>
            <span className="text-foreground font-medium">{Number(totalBudget).toLocaleString("ru-RU")} ₽</span>
            <span className="text-muted-foreground">Старт</span>
            <span className="text-foreground font-medium">{startDateVal ? startDateVal.toLocaleDateString("ru-RU") : "—"}</span>
            <span className="text-muted-foreground">Окончание</span>
            <span className="text-foreground font-medium">{noEndDate ? "Без ограничения" : (endDateVal ? endDateVal.toLocaleDateString("ru-RU") : "—")}</span>
            {dailyCap && <>
              <span className="text-muted-foreground">Дневной лимит</span>
              <span className="text-foreground font-medium">{Number(dailyCap).toLocaleString("ru-RU")} ₽</span>
            </>}
          </div>
        </CardContent>
      </Card>

      {/* ORD / ERID */}
      <Card>
        <CardContent className="p-4 space-y-1">
          <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">Маркировка (ОРД)</p>
          {eridStatus === "issued" ? (
            <div className="flex items-center gap-2 text-[13px]">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-foreground">ERID: <span className="font-mono font-semibold text-primary">{eridValue}</span></span>
            </div>
          ) : eridStatus === "pending" ? (
            <div className="flex items-center gap-2 text-[13px]">
              <Loader2 className="h-4 w-4 text-warning animate-spin" />
              <span className="text-warning">Ожидание ERID…</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[13px]">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-destructive">ERID не получен — запуск невозможен</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Launch */}
      <div className="pt-2">
        {!canLaunch && (
          <p className="text-[12px] text-muted-foreground mb-2 flex items-center gap-1.5">
            <Lock className="h-3 w-3" />
            {eridStatus !== "issued" ? "Для запуска необходимо получить ERID" :
              !isVerified ? "Необходимо пройти верификацию" : "Необходимо подключить ОРД"}
          </p>
        )}
        <Button
          className="w-full h-11 text-[15px] gap-2"
          disabled={!canLaunch || launching}
          onClick={handleLaunch}
        >
          {launching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
          {launching ? "Запускаем…" : "Запустить кампанию"}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="w-full max-w-[860px] mx-auto px-6 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={goBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-lg font-bold text-foreground tracking-tight">Новая кампания</h2>
            <p className="text-[13px] text-muted-foreground">Ручное создание · шаг {step} из 5</p>
          </div>
        </div>

        {stepper}

        {/* Step content */}
        <div className="min-h-[300px]">
          {step === 1 && stepPlacement}
          {step === 2 && stepCreative}
          {step === 3 && stepBudget}
          {step === 4 && stepOrd}
          {step === 5 && stepReview}
        </div>

        {/* Footer nav */}
        {step < 5 && (
          <div className="flex items-center justify-between pt-6 border-t border-border mt-6">
            <Button variant="ghost" onClick={goBack} className="text-[13px] gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" />
              {step === 1 ? "Отмена" : "Назад"}
            </Button>
            <Button onClick={goNext} disabled={!canNext} className="text-[13px] gap-1.5">
              Далее
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
