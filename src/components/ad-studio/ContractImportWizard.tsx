import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  ArrowLeft, ArrowRight, Upload, FileText, Loader2, CheckCircle2, AlertTriangle,
  ShieldCheck, Lock, Eye, Info, Sparkles, ClipboardCopy, Calendar, Building2,
  Banknote, Hash, Globe, FileCheck, History, User,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ───
interface ExtractedField {
  key: string;
  label: string;
  value: string;
  confidence: number; // 0-1
  sourceSnippet: string;
  editable: boolean;
  category: "parties" | "contract" | "budget" | "schedule" | "deliverables" | "legal";
}

interface AuditEntry {
  timestamp: string;
  action: string;
  user: string;
}

interface ContractImportWizardProps {
  onBack: () => void;
  onComplete: (data: ContractCampaignData) => void;
}

export interface ContractCampaignData {
  contractNumber: string;
  contractDate: string;
  partyAdvertiser: string;
  partyExecutor: string;
  advertiserInn: string;
  executorInn: string;
  budget: number;
  currency: string;
  startDate: string;
  endDate: string;
  contentType: string;
  placement: string;
  ordRequirements: string;
  paymentTerms: string;
  cancellationClause: string;
  storeFullDocument: boolean;
  fileName: string;
  auditLog: AuditEntry[];
}

// ─── Mock extracted fields ───
const mockExtractedFields: ExtractedField[] = [
  { key: "partyAdvertiser", label: "Рекламодатель", value: "ООО «Технологии Будущего»", confidence: 0.95, sourceSnippet: "…между ООО «Технологии Будущего» (далее — Рекламодатель), ИНН 7701234567…", editable: true, category: "parties" },
  { key: "advertiserInn", label: "ИНН рекламодателя", value: "7701234567", confidence: 0.98, sourceSnippet: "…ИНН 7701234567, ОГРН 1177700001234…", editable: true, category: "parties" },
  { key: "advertiserOgrn", label: "ОГРН рекламодателя", value: "1177700001234", confidence: 0.97, sourceSnippet: "…ОГРН 1177700001234, юр. адрес: г. Москва…", editable: true, category: "parties" },
  { key: "partyExecutor", label: "Исполнитель (площадка)", value: "ИП Иванов Алексей Сергеевич", confidence: 0.92, sourceSnippet: "…и ИП Иванов Алексей Сергеевич (далее — Исполнитель), ОГРНИП 321770100012345…", editable: true, category: "parties" },
  { key: "executorInn", label: "ИНН исполнителя", value: "770100012345", confidence: 0.96, sourceSnippet: "…ИНН 770100012345, ОГРНИП 321770100012345…", editable: true, category: "parties" },
  { key: "contractNumber", label: "Номер договора", value: "РК-2026/042", confidence: 0.99, sourceSnippet: "Договор № РК-2026/042 от 15 февраля 2026 г.", editable: true, category: "contract" },
  { key: "contractDate", label: "Дата договора", value: "2026-02-15", confidence: 0.99, sourceSnippet: "Договор № РК-2026/042 от 15 февраля 2026 г.", editable: true, category: "contract" },
  { key: "budget", label: "Бюджет / лимит", value: "250000", confidence: 0.94, sourceSnippet: "…общая стоимость услуг составляет 250 000 (двести пятьдесят тысяч) рублей…", editable: true, category: "budget" },
  { key: "currency", label: "Валюта", value: "RUB", confidence: 0.99, sourceSnippet: "…250 000 (двести пятьдесят тысяч) рублей 00 копеек, включая НДС…", editable: true, category: "budget" },
  { key: "startDate", label: "Дата начала", value: "2026-03-01", confidence: 0.91, sourceSnippet: "…размещение осуществляется в период с 1 марта 2026 г. по 31 мая 2026 г.…", editable: true, category: "schedule" },
  { key: "endDate", label: "Дата окончания", value: "2026-05-31", confidence: 0.91, sourceSnippet: "…по 31 мая 2026 г. включительно…", editable: true, category: "schedule" },
  { key: "contentType", label: "Тип контента", value: "Баннерная реклама 728×90", confidence: 0.88, sourceSnippet: "…размещение баннерной рекламы формата 728×90 пикселей на главной странице…", editable: true, category: "deliverables" },
  { key: "placement", label: "Размещение", value: "Баннер в каталоге", confidence: 0.85, sourceSnippet: "…на главной странице каталога и в разделе рекомендаций…", editable: true, category: "deliverables" },
  { key: "ordRequirements", label: "Требования ОРД", value: "Маркировка по ФЗ-347, ежедневная отчётность", confidence: 0.82, sourceSnippet: "…обязан обеспечить маркировку рекламных материалов в соответствии с ФЗ-347…", editable: true, category: "legal" },
  { key: "paymentTerms", label: "Условия оплаты", value: "Предоплата 50%, остаток по завершении", confidence: 0.87, sourceSnippet: "…оплата: 50% предоплата в течение 5 рабочих дней, остаток — в течение 10 рабочих дней после окончания…", editable: true, category: "legal" },
  { key: "cancellationClause", label: "Условия расторжения", value: "За 14 дней с уведомлением, неустойка 10%", confidence: 0.80, sourceSnippet: "…любая сторона вправе расторгнуть договор, уведомив за 14 календарных дней, при этом неустойка составляет 10%…", editable: true, category: "legal" },
];

const categoryLabels: Record<string, { label: string; icon: any }> = {
  parties: { label: "Стороны договора", icon: Building2 },
  contract: { label: "Реквизиты договора", icon: Hash },
  budget: { label: "Бюджет и оплата", icon: Banknote },
  schedule: { label: "Сроки размещения", icon: Calendar },
  deliverables: { label: "Предмет договора", icon: Globe },
  legal: { label: "Правовые условия", icon: FileCheck },
};

function confidenceColor(c: number): string {
  if (c >= 0.9) return "text-success";
  if (c >= 0.7) return "text-warning";
  return "text-destructive";
}

function confidenceLabel(c: number): string {
  if (c >= 0.9) return "Высокая";
  if (c >= 0.7) return "Средняя";
  return "Низкая";
}

// ─── Step indicator ───
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
            i < current ? "bg-success/20 text-success" :
            i === current ? "bg-primary text-primary-foreground" :
            "bg-muted text-muted-foreground"
          }`}>
            {i < current ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
          </div>
          {i < total - 1 && (
            <div className={`h-px w-8 ${i < current ? "bg-success/40" : "bg-border"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

const stepTitles = ["Загрузка документа", "AI-извлечение", "Проверка данных", "Создание кампании"];

// ═══════════════════════════════════════════════════════
// ─── Step 1: Upload ───
// ═══════════════════════════════════════════════════════
function UploadStep({ onNext, storeDoc, setStoreDoc, redactSensitive, setRedactSensitive, file, setFile }: {
  onNext: () => void;
  storeDoc: boolean; setStoreDoc: (v: boolean) => void;
  redactSensitive: boolean; setRedactSensitive: (v: boolean) => void;
  file: File | null; setFile: (f: File | null) => void;
}) {
  const [agreed, setAgreed] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && (f.type === "application/pdf" || f.name.endsWith(".docx"))) {
      setFile(f);
    } else {
      toast.error("Поддерживаются только PDF и DOCX файлы");
    }
  }, [setFile]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  return (
    <div className="space-y-5">
      {/* Compliance notice */}
      <Card className="border-warning/30">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-semibold text-card-foreground">Важно: персональные данные</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Загружаемый документ может содержать персональные данные и конфиденциальные условия.
                Убедитесь, что вы имеете право на загрузку и обработку данных из этого документа.
                Данные обрабатываются в соответствии с ФЗ-152 «О персональных данных».
              </p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)}
                  className="rounded border-border" />
                <span className="text-xs text-card-foreground font-medium">
                  Подтверждаю право на загрузку и обработку данных
                </span>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className={`rounded-xl border-2 border-dashed transition-colors p-8 flex flex-col items-center gap-4 ${
          file ? "border-success/40 bg-success/5" : "border-border hover:border-primary/40 bg-card"
        }`}
      >
        {file ? (
          <>
            <FileText className="h-10 w-10 text-success" />
            <div className="text-center">
              <p className="text-sm font-semibold text-card-foreground">{file.name}</p>
              <p className="text-xs text-muted-foreground mt-1">{(file.size / 1024).toFixed(0)} KB</p>
            </div>
            <Button size="sm" variant="outline" className="text-sm" onClick={() => setFile(null)}>
              Заменить файл
            </Button>
          </>
        ) : (
          <>
            <Upload className="h-10 w-10 text-muted-foreground/40" />
            <div className="text-center">
              <p className="text-sm text-card-foreground font-medium">Перетащите PDF или DOCX</p>
              <p className="text-xs text-muted-foreground mt-1">или нажмите для выбора файла</p>
            </div>
            <label>
              <input type="file" accept=".pdf,.docx" className="hidden" onChange={handleFileInput} />
              <Button size="sm" variant="outline" className="text-sm cursor-pointer" asChild>
                <span>Выбрать файл</span>
              </Button>
            </label>
          </>
        )}
      </div>

      {/* Toggles */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-card-foreground">Хранить полный документ</p>
              <p className="text-xs text-muted-foreground">Оригинал будет сохранён для аудита и версионирования</p>
            </div>
            <Switch checked={storeDoc} onCheckedChange={setStoreDoc} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-card-foreground">Редактировать чувствительные данные перед AI</p>
              <p className="text-xs text-muted-foreground">Банковские реквизиты и ПДн будут замаскированы перед отправкой в AI</p>
            </div>
            <Switch checked={redactSensitive} onCheckedChange={setRedactSensitive} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button className="h-10 text-sm gap-2" disabled={!file || !agreed} onClick={onNext}>
          Продолжить
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ─── Step 2: AI Extraction ───
// ═══════════════════════════════════════════════════════
function ExtractionStep({ onNext, fileName }: { onNext: () => void; fileName: string }) {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<"parsing" | "extracting" | "validating" | "done">("parsing");

  useState(() => {
    const stages: Array<{ s: typeof stage; p: number; delay: number }> = [
      { s: "parsing", p: 30, delay: 800 },
      { s: "extracting", p: 65, delay: 1500 },
      { s: "validating", p: 90, delay: 2200 },
      { s: "done", p: 100, delay: 3000 },
    ];
    stages.forEach(({ s, p, delay }) => {
      setTimeout(() => { setStage(s); setProgress(p); }, delay);
    });
  });

  const stageLabels = {
    parsing: "Разбор документа…",
    extracting: "Извлечение ключевых полей…",
    validating: "Валидация данных…",
    done: "Извлечение завершено",
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center gap-3">
            {stage === "done" ? (
              <CheckCircle2 className="h-8 w-8 text-success" />
            ) : (
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            )}
            <div>
              <p className="text-base font-bold text-card-foreground">{stageLabels[stage]}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{fileName}</p>
            </div>
          </div>

          <Progress value={progress} className="h-2" />

          <div className="space-y-2">
            {(["parsing", "extracting", "validating", "done"] as const).map((s) => {
              const icons = {
                parsing: FileText,
                extracting: Sparkles,
                validating: ShieldCheck,
                done: CheckCircle2,
              };
              const labels = {
                parsing: "Разбор структуры документа",
                extracting: "AI-извлечение ключевых полей",
                validating: "Валидация ИНН, ОГРН, дат",
                done: "Готово к проверке",
              };
              const Icon = icons[s];
              const isActive = s === stage;
              const isDone = ["parsing", "extracting", "validating", "done"].indexOf(s) < ["parsing", "extracting", "validating", "done"].indexOf(stage) || (stage === "done");
              return (
                <div key={s} className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive && stage !== "done" ? "bg-primary/10" : isDone ? "bg-success/5" : "opacity-40"
                }`}>
                  {isDone ? (
                    <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                  ) : isActive ? (
                    <Loader2 className="h-4 w-4 text-primary animate-spin flex-shrink-0" />
                  ) : (
                    <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <span className={`text-sm ${isDone ? "text-card-foreground" : "text-muted-foreground"}`}>{labels[s]}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {stage === "done" && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" />
            <span className="font-medium">Извлечено {mockExtractedFields.length} полей</span>
          </div>
          <Button className="h-10 text-sm gap-2" onClick={onNext}>
            Проверить данные
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ─── Step 3: Review & Confirm ───
// ═══════════════════════════════════════════════════════
function ReviewStep({ onNext, fields, setFields }: {
  onNext: () => void;
  fields: ExtractedField[];
  setFields: (f: ExtractedField[]) => void;
}) {
  const [expandedSnippet, setExpandedSnippet] = useState<string | null>(null);

  const categories = ["parties", "contract", "budget", "schedule", "deliverables", "legal"];

  const updateField = (key: string, value: string) => {
    setFields(fields.map((f) => f.key === key ? { ...f, value } : f));
  };

  return (
    <div className="space-y-5">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-card-foreground">Проверьте извлечённые данные</p>
              <p className="text-xs text-muted-foreground">
                AI извлёк данные из договора. Нажмите на иконку цитаты, чтобы увидеть исходный фрагмент.
                Отредактируйте значения при необходимости.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {categories.map((cat) => {
        const catFields = fields.filter((f) => f.category === cat);
        if (catFields.length === 0) return null;
        const { label, icon: CatIcon } = categoryLabels[cat];
        return (
          <Card key={cat}>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <CatIcon className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold text-card-foreground">{label}</p>
              </div>
              <div className="space-y-3">
                {catFields.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-muted-foreground">{field.label}</label>
                      <div className="flex items-center gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="text-xs underline text-muted-foreground hover:text-card-foreground transition-colors flex items-center gap-1"
                              onClick={() => setExpandedSnippet(expandedSnippet === field.key ? null : field.key)}
                            >
                              <Eye className="h-3 w-3" />
                              Источник
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[320px]">
                            <p className="text-xs">Показать фрагмент из договора</p>
                          </TooltipContent>
                        </Tooltip>
                        <Badge variant="outline" className={`text-[10px] ${confidenceColor(field.confidence)}`}>
                          {Math.round(field.confidence * 100)}% · {confidenceLabel(field.confidence)}
                        </Badge>
                      </div>
                    </div>
                    <Input
                      value={field.value}
                      onChange={(e) => updateField(field.key, e.target.value)}
                      className="h-9"
                    />
                    {expandedSnippet === field.key && (
                      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground leading-relaxed">
                        <span className="text-[10px] uppercase tracking-wider text-primary font-medium">Фрагмент из договора:</span>
                        <p className="mt-1 italic">«{field.sourceSnippet}»</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          После подтверждения бюджет будет зафиксирован по договору (только увеличение через доп. соглашение).
        </p>
        <Button className="h-10 text-sm gap-2" onClick={onNext}>
          <CheckCircle2 className="h-4 w-4" />
          Подтвердить и создать
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ─── Step 4: Campaign Created ───
// ═══════════════════════════════════════════════════════
function CreatedStep({ fields, fileName, onComplete }: {
  fields: ExtractedField[];
  fileName: string;
  onComplete: () => void;
}) {
  const getVal = (key: string) => fields.find((f) => f.key === key)?.value || "";

  return (
    <div className="space-y-5">
      <Card className="border-success/30 bg-success/5">
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-success" />
            <div>
              <p className="text-base font-bold text-card-foreground">Кампания создана из договора</p>
              <p className="text-xs text-muted-foreground mt-0.5">Договор {getVal("contractNumber")} от {getVal("contractDate")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <p className="text-sm font-semibold text-card-foreground">Параметры кампании</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Рекламодатель</span>
              <p className="text-card-foreground font-medium">{getVal("partyAdvertiser")}</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Бюджет</span>
              <div className="flex items-center gap-2">
                <p className="text-card-foreground font-medium">{Number(getVal("budget")).toLocaleString("ru-RU")} ₽</p>
                <Badge variant="outline" className="text-[10px] border-primary/30 text-primary bg-primary/10">
                  <Lock className="h-2.5 w-2.5 mr-1" />
                  Договор
                </Badge>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Период</span>
              <p className="text-card-foreground font-medium">{getVal("startDate")} — {getVal("endDate")}</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Размещение</span>
              <p className="text-card-foreground font-medium">{getVal("placement")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Badges */}
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="outline" className="text-xs border-primary/30 text-primary bg-primary/10 py-1.5 px-3">
          <Lock className="h-3 w-3 mr-1.5" />
          Договор зафиксирован
        </Badge>
        <Badge variant="outline" className="text-xs border-warning/30 text-warning bg-warning/10 py-1.5 px-3">
          <Info className="h-3 w-3 mr-1.5" />
          Креатив зафиксируется после ERID
        </Badge>
        <Badge variant="outline" className="text-xs border-muted-foreground/20 text-muted-foreground py-1.5 px-3">
          <FileText className="h-3 w-3 mr-1.5" />
          {fileName}
        </Badge>
      </div>

      {/* Audit log */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold text-card-foreground">Аудит-лог</p>
          </div>
          <div className="space-y-2">
            {[
              { time: new Date().toLocaleString("ru-RU"), action: "Договор загружен и обработан", user: "Текущий пользователь" },
              { time: new Date().toLocaleString("ru-RU"), action: "Данные извлечены AI и подтверждены", user: "Текущий пользователь" },
              { time: new Date().toLocaleString("ru-RU"), action: "Кампания создана из договора", user: "Текущий пользователь" },
            ].map((entry, i) => (
              <div key={i} className="flex items-center gap-3 text-xs py-1.5 border-b border-border/50 last:border-0">
                <CheckCircle2 className="h-3.5 w-3.5 text-success flex-shrink-0" />
                <span className="flex-1 text-card-foreground">{entry.action}</span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <User className="h-3 w-3" />
                  {entry.user}
                </span>
                <span className="text-muted-foreground">{entry.time}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Next steps */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-5 space-y-3">
          <p className="text-sm font-semibold text-card-foreground">Следующие шаги</p>
          <ul className="space-y-2 text-xs text-muted-foreground">
            <li className="flex items-center gap-2"><span className="text-primary font-bold">1.</span> Загрузите креатив на вкладке «Креатив»</li>
            <li className="flex items-center gap-2"><span className="text-primary font-bold">2.</span> Отправьте на модерацию и получите ERID</li>
            <li className="flex items-center gap-2"><span className="text-primary font-bold">3.</span> Запустите кампанию</li>
          </ul>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button className="h-10 text-sm gap-2" onClick={onComplete}>
          Перейти к управлению кампанией
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ─── Main Wizard ───
// ═══════════════════════════════════════════════════════
export function ContractImportWizard({ onBack, onComplete }: ContractImportWizardProps) {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [storeDoc, setStoreDoc] = useState(true);
  const [redactSensitive, setRedactSensitive] = useState(true);
  const [fields, setFields] = useState<ExtractedField[]>(mockExtractedFields);

  const handleComplete = () => {
    const getVal = (key: string) => fields.find((f) => f.key === key)?.value || "";
    const data: ContractCampaignData = {
      contractNumber: getVal("contractNumber"),
      contractDate: getVal("contractDate"),
      partyAdvertiser: getVal("partyAdvertiser"),
      partyExecutor: getVal("partyExecutor"),
      advertiserInn: getVal("advertiserInn"),
      executorInn: getVal("executorInn"),
      budget: Number(getVal("budget")) || 0,
      currency: getVal("currency"),
      startDate: getVal("startDate"),
      endDate: getVal("endDate"),
      contentType: getVal("contentType"),
      placement: getVal("placement"),
      ordRequirements: getVal("ordRequirements"),
      paymentTerms: getVal("paymentTerms"),
      cancellationClause: getVal("cancellationClause"),
      storeFullDocument: storeDoc,
      fileName: file?.name || "",
      auditLog: [
        { timestamp: new Date().toISOString(), action: "contract_imported", user: "current_user" },
        { timestamp: new Date().toISOString(), action: "data_confirmed", user: "current_user" },
        { timestamp: new Date().toISOString(), action: "campaign_created", user: "current_user" },
      ],
    };
    onComplete(data);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="w-full max-w-[720px] mx-auto px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button size="sm" variant="ghost" onClick={onBack} className="h-9 w-9 p-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h2 className="text-base font-bold text-foreground">Создание из договора</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{stepTitles[step]}</p>
            </div>
          </div>
          <StepIndicator current={step} total={4} />
        </div>

        {step === 0 && (
          <UploadStep
            onNext={() => setStep(1)}
            storeDoc={storeDoc} setStoreDoc={setStoreDoc}
            redactSensitive={redactSensitive} setRedactSensitive={setRedactSensitive}
            file={file} setFile={setFile}
          />
        )}
        {step === 1 && (
          <ExtractionStep onNext={() => setStep(2)} fileName={file?.name || "document.pdf"} />
        )}
        {step === 2 && (
          <ReviewStep onNext={() => setStep(3)} fields={fields} setFields={setFields} />
        )}
        {step === 3 && (
          <CreatedStep fields={fields} fileName={file?.name || "document.pdf"} onComplete={handleComplete} />
        )}
      </div>
    </div>
  );
}
