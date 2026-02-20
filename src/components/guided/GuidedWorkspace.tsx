import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Upload, Brain, Loader2, CheckCircle2, BookOpen, HelpCircle,
  FileText, AlertCircle, ChevronRight, ChevronLeft, Send,
  Lightbulb, RotateCcw, X, FileSearch, Sparkles,
  GraduationCap, CreditCard, Presentation, Clock,
  ArrowRight, ChevronDown, Plus, Trash2, MapPin,
  RefreshCw, Award, Bug, Copy, AlertTriangle, PanelRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";

/* ═══════════════ TYPES ═══════════════ */
type GuidedPhase = "intake" | "recommendation" | "generate" | "player" | "checkin" | "finish";
type OutputFormat = "COURSE_LEARN" | "EXAM_PREP" | "QUIZ_ONLY" | "INTERVIEW" | "FLASHCARDS" | "PRESENTATION";
type IntakeStep = 0 | 1 | 2 | 3 | 4 | 5;
type GenStageKey = "uploading" | "ingesting" | "planning" | "generating";
type GenStageStatus = "pending" | "running" | "done" | "error";
type GenStatus = "idle" | "uploading" | "ingesting" | "planning" | "generating" | "done" | "error";

interface GenStage {
  key: GenStageKey;
  label: string;
  icon: React.ElementType;
  status: GenStageStatus;
  error?: EdgeError;
}

interface IntakeData {
  files: File[];
  pastedText: string;
  goal: string;
  knowledgeLevel: string;
  depth: string;
  deadline: string;
  hoursPerWeek: string;
  preferences: string[];
}

interface Artifact {
  id: string;
  title: string;
  type: string;
  public_json: any;
  status: string;
  roadmap_step_id: string | null;
}

interface EdgeError {
  functionName: string;
  status: number;
  body: string;
}

const OUTPUT_FORMATS: { value: OutputFormat; label: string; icon: React.ElementType; desc: string }[] = [
  { value: "COURSE_LEARN", label: "Курс", icon: BookOpen, desc: "Уроки + практика + проверки" },
  { value: "QUIZ_ONLY", label: "Тесты", icon: HelpCircle, desc: "Банк вопросов + варианты + тренировка" },
  { value: "EXAM_PREP", label: "Экзамен", icon: GraduationCap, desc: "Диагностика + разбор ошибок + ремедиация" },
  { value: "INTERVIEW", label: "Собеседование", icon: Brain, desc: "Подготовка к интервью + типовые вопросы" },
  { value: "FLASHCARDS", label: "Карточки", icon: CreditCard, desc: "Карточки для запоминания + quiz me" },
  { value: "PRESENTATION", label: "Презентация", icon: Presentation, desc: "Слайды + заметки + Q&A репетиция" },
];

const GOAL_OPTIONS = [
  { value: "self_learn", label: "Учусь для себя" },
  { value: "exam_prep", label: "Готовлюсь к экзамену" },
  { value: "interview", label: "Готовлюсь к собеседованию" },
  { value: "quiz_only", label: "Хочу только квиз/диагностику" },
  { value: "flashcards", label: "Хочу карточки" },
  { value: "presentation", label: "Готовлю выступление/презентацию" },
];

const KNOWLEDGE_LEVELS = [
  { value: "zero", label: "Ноль", desc: "Не знаю ничего" },
  { value: "basic", label: "База", desc: "Слышал, но не уверен" },
  { value: "confident", label: "Уверенно", desc: "Хорошо знаю основы" },
];

const DEPTH_OPTIONS = [
  { value: "shallow", label: "Поверхностно" },
  { value: "normal", label: "Нормально" },
  { value: "deep", label: "Глубоко" },
];

const PREF_OPTIONS = [
  { value: "practice", label: "Больше практики" },
  { value: "tests", label: "Больше тестов" },
  { value: "examples", label: "Больше примеров" },
];

/* ═══════════════ Helpers ═══════════════ */
async function extractText(file: File): Promise<string> {
  const ext = file.name.toLowerCase().split(".").pop();
  if (ext === "txt" || ext === "md") return file.text();
  if (ext === "pdf") {
    try {
      const pdfjsLib = await import("pdfjs-dist");
      const workerModule = await import("pdfjs-dist/build/pdf.worker.mjs?url");
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerModule.default;
      const arrayBuf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuf) }).promise;
      const pages: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const tc = await page.getTextContent();
        pages.push(tc.items.map((it: any) => it.str).join(" "));
      }
      return pages.join("\n\n");
    } catch (e) {
      console.warn("PDF.js extraction failed:", e);
      return file.text();
    }
  }
  if (ext === "docx") {
    try {
      const mammoth = await import("mammoth");
      const arrayBuf = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer: arrayBuf });
      return result.value;
    } catch (e) {
      console.warn("mammoth extraction failed:", e);
      return file.text();
    }
  }
  return file.text();
}

function recommendFormat(intake: IntakeData): OutputFormat {
  if (intake.goal === "presentation") return "PRESENTATION";
  if (intake.goal === "flashcards") return "FLASHCARDS";
  if (intake.goal === "quiz_only") return "QUIZ_ONLY";
  if (intake.goal === "exam_prep") return "EXAM_PREP";
  if (intake.goal === "interview") return "INTERVIEW";
  return "COURSE_LEARN";
}

function recommendReason(intake: IntakeData, format: OutputFormat): string {
  const goalLabel = GOAL_OPTIONS.find((g) => g.value === intake.goal)?.label || intake.goal;
  const levelLabel = KNOWLEDGE_LEVELS.find((k) => k.value === intake.knowledgeLevel)?.label || intake.knowledgeLevel;
  return `На основе цели «${goalLabel}» и уровня «${levelLabel}» — этот формат подойдёт лучше всего.`;
}

function formatToActionType(format: OutputFormat): string {
  switch (format) {
    case "COURSE_LEARN": return "generate_lesson_blocks";
    case "EXAM_PREP": return "generate_quiz";
    case "QUIZ_ONLY": return "generate_quiz";
    case "INTERVIEW": return "generate_quiz";
    case "FLASHCARDS": return "generate_flashcards";
    case "PRESENTATION": return "generate_slides";
  }
}

const INITIAL_GEN_STAGES: GenStage[] = [
  { key: "uploading", label: "Загрузка источников", icon: Upload, status: "pending" },
  { key: "ingesting", label: "Извлечение и индексация", icon: FileText, status: "pending" },
  { key: "planning", label: "Учебный план (roadmap)", icon: Brain, status: "pending" },
  { key: "generating", label: "Генерация первого результата", icon: Sparkles, status: "pending" },
];

const STAGE_TIMEOUT_MS = 30_000;
const LLM_STAGE_TIMEOUT_MS = 120_000; // LLM stages need more time
const MIN_QUALITY_CHARS = 200; // Minimum total chars for quality check
const MIN_QUALITY_CHUNKS = 1;

/** Wrap a promise with a timeout */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject({ functionName: label, status: 0, body: `Таймаут: стадия «${label}» не завершилась за ${ms / 1000} сек.` } as EdgeError);
    }, ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

/** Check extracted content quality — returns error message or null */
function checkContentQuality(docs: { text: string; file_name: string }[]): string | null {
  if (!docs.length) return "Не удалось извлечь текст ни из одного источника.";
  const totalChars = docs.reduce((sum, d) => sum + d.text.trim().length, 0);
  if (totalChars < MIN_QUALITY_CHARS) {
    return `Слишком мало текста (${totalChars} символов). Минимум — ${MIN_QUALITY_CHARS}. Загрузите файл с большим количеством текстового контента.`;
  }
  // Check if content is mostly garbage (non-letter ratio)
  const allText = docs.map(d => d.text).join("");
  const letterCount = (allText.match(/[\p{L}\p{N}]/gu) || []).length;
  const ratio = letterCount / allText.length;
  if (ratio < 0.3) {
    return `Контент содержит слишком мало читаемого текста (${Math.round(ratio * 100)}% букв/цифр). Возможно, файл повреждён или содержит только изображения.`;
  }
  return null;
}

/** Call edge function with detailed error reporting */
async function callEdge(fnName: string, body: any): Promise<any> {
  const payloadSize = JSON.stringify(body).length;
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fnName}`;

  const { data, error } = await supabase.functions.invoke(fnName, { body });

  if (error) {
    const status = (error as any)?.status ?? 0;
    let detail = typeof error === "string"
      ? error
      : (error as any)?.message || (error as any)?.details || (error as any)?.context || JSON.stringify(error).slice(0, 2000);

    // HTTP 0 — no response at all (CORS / network / payload too large)
    if (status === 0 || !status) {
      detail = `Запрос не получил ответ (возможно: CORS, сеть или слишком большой payload ~${Math.round(payloadSize / 1024)}KB).\n\nURL: ${url}\nPayload size: ~${Math.round(payloadSize / 1024)}KB\n\nОригинальная ошибка: ${detail}`;
    }

    throw { functionName: fnName, status, body: detail, payloadSize, url } as EdgeError & { payloadSize: number; url: string };
  }

  if (data?.error) {
    throw { functionName: fnName, status: data.status || 400, body: data.error } as EdgeError;
  }
  return data;
}

/* ═══════════════ Error Card ═══════════════ */
const EdgeErrorCard = ({ error, onRetry }: { error: EdgeError; onRetry?: () => void }) => {
  const [open, setOpen] = useState(false);
  const extra = error as EdgeError & { payloadSize?: number; url?: string };
  const report = [
    `Function: ${error.functionName}`,
    `Status: ${error.status}`,
    extra.url ? `URL: ${extra.url}` : null,
    extra.payloadSize ? `Payload: ~${Math.round(extra.payloadSize / 1024)}KB` : null,
    `Body: ${error.body}`,
  ].filter(Boolean).join("\n");

  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="pt-5 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <p className="text-sm font-medium text-foreground">Ошибка: {error.functionName}</p>
        </div>
        <p className="text-xs text-muted-foreground">HTTP {error.status}</p>
        {error.status === 0 && (
          <p className="text-xs text-yellow-600 bg-yellow-500/10 p-2 rounded">
            💡 Запрос не получил ответ. Откройте DevTools → Network/Console для диагностики.
          </p>
        )}
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="text-xs">
              {open ? "Скрыть" : "Debug"} <ChevronDown className={cn("h-3 w-3 ml-1 transition-transform", open && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="text-[11px] text-muted-foreground bg-muted/30 p-3 rounded-lg mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all">
              {error.body.slice(0, 2000)}
            </pre>
          </CollapsibleContent>
        </Collapsible>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(report); toast.success("Скопировано"); }}>
            <Copy className="h-3 w-3 mr-1" /> Копировать отчёт
          </Button>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RotateCcw className="h-3 w-3 mr-1" /> Повторить
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

/* ═══════════════ Unrecognized payload card ═══════════════ */
const UnknownPayloadCard = ({ kind, payload }: { kind: string; payload: any }) => {
  const [open, setOpen] = useState(false);
  return (
    <Card className="border-yellow-500/30 bg-yellow-500/5">
      <CardContent className="pt-5 space-y-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0" />
          <p className="text-sm font-medium text-foreground">
            Невозможно отобразить результат: получен «{kind}»
          </p>
        </div>
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="text-xs">
              {open ? "Скрыть" : "Debug"} <ChevronDown className={cn("h-3 w-3 ml-1 transition-transform", open && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="text-[11px] text-muted-foreground bg-muted/30 p-3 rounded-lg mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all">
              {JSON.stringify(payload, null, 2).slice(0, 2000)}
            </pre>
          </CollapsibleContent>
        </Collapsible>
        <Button variant="outline" size="sm" onClick={() => {
          navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
          toast.success("Скопировано");
        }}>
          <Copy className="h-3 w-3 mr-1" /> Копировать отчёт
        </Button>
      </CardContent>
    </Card>
  );
};

/* ═══════════════ RENDERERS ═══════════════ */
const BlockRenderer = ({ block, onTermClick }: { block: any; onTermClick?: (term: string) => void }) => {
  const handleTextSelect = () => {
    const selection = window.getSelection()?.toString().trim();
    if (selection && selection.length > 2 && selection.length < 100 && onTermClick) {
      onTermClick(selection);
    }
  };
  if (!block) return null;
  return (
    <div className="p-4 rounded-lg border border-border bg-card space-y-2" onMouseUp={handleTextSelect}>
      {block.title && (
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-sm text-foreground">{block.title}</h4>
        </div>
      )}
      {block.content && <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{block.content}</p>}
    </div>
  );
};

/** Renders assistant_note payloads */
const AssistantNoteCard = ({ payload, sourceRefs }: { payload: any; sourceRefs?: string[] }) => (
  <div className="space-y-3">
    {payload.title && (
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-primary" />
        <h4 className="font-semibold text-sm text-foreground">{payload.title}</h4>
      </div>
    )}
    {payload.content && (
      <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{payload.content}</p>
    )}
    {(sourceRefs || payload.source_refs)?.length > 0 && (
      <div className="pt-2 border-t border-border space-y-1">
        <p className="text-[10px] font-medium text-muted-foreground">Источники:</p>
        {(sourceRefs || payload.source_refs).map((r: string, i: number) => (
          <p key={i} className="text-[11px] text-muted-foreground flex items-center gap-1">
            <FileSearch className="h-3 w-3" />{r}
          </p>
        ))}
      </div>
    )}
  </div>
);

const QuizPlayer = ({ questions, onSubmit, submitted, feedback, score }: {
  questions: any[];
  onSubmit: (answers: { block_id: string; value: string | string[] }[]) => void;
  submitted: boolean;
  feedback: any;
  score: number | null;
}) => {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const handleSelect = (qId: string, optId: string, isMulti: boolean) => {
    if (submitted) return;
    setAnswers((prev) => {
      if (isMulti) {
        const current = (prev[qId] as string[]) || [];
        return { ...prev, [qId]: current.includes(optId) ? current.filter((x) => x !== optId) : [...current, optId] };
      }
      return { ...prev, [qId]: optId };
    });
  };
  return (
    <div className="space-y-4">
      {submitted && feedback && (
        <div className={cn("p-4 rounded-lg border space-y-2",
          feedback.passed ? "border-accent/30 bg-accent/5" : "border-destructive/30 bg-destructive/5")}>
          <div className="flex items-center gap-2">
            {feedback.passed ? <CheckCircle2 className="h-5 w-5 text-accent" /> : <AlertCircle className="h-5 w-5 text-destructive" />}
            <span className="font-semibold text-sm text-foreground">{feedback.passed ? "Пройдено!" : "Попробуйте ещё"}</span>
            {score !== null && <Badge variant={feedback.passed ? "default" : "secondary"}>{score}%</Badge>}
          </div>
        </div>
      )}
      {questions.map((q, qi) => {
        const qFeedback = submitted && feedback?.questions?.[q.id];
        return (
          <div key={q.id} className={cn("p-4 rounded-lg border bg-card space-y-3",
            qFeedback?.correct === true ? "border-accent/30" : qFeedback?.correct === false ? "border-destructive/30" : "border-border")}>
            <p className="text-sm font-medium text-foreground">{qi + 1}. {q.text}</p>
            <div className="space-y-2">
              {(q.options || []).map((opt: any) => {
                const isMulti = q.type === "multiple_choice";
                const isSelected = isMulti ? ((answers[q.id] as string[]) || []).includes(opt.id) : answers[q.id] === opt.id;
                return (
                  <button key={opt.id} onClick={() => handleSelect(q.id, opt.id, isMulti)}
                    className={cn("w-full text-left p-3 rounded-lg border transition-all text-sm",
                      isSelected ? "border-primary bg-primary/10 text-foreground" : "border-border hover:border-primary/30 text-muted-foreground",
                      submitted && "pointer-events-none")}>
                    {opt.text}
                  </button>
                );
              })}
            </div>
            {submitted && qFeedback?.correct === false && q.explanation && (
              <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">{q.explanation}</p>
            )}
          </div>
        );
      })}
      {!submitted && (
        <Button onClick={() => onSubmit(questions.map((q) => ({ block_id: q.id, value: answers[q.id] || "" })))} className="w-full">
          <Send className="h-4 w-4 mr-2" /> Отправить ответы
        </Button>
      )}
    </div>
  );
};

const FlashcardsPlayer = ({ cards }: { cards: any[] }) => {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = cards[idx];
  if (!card) return null;
  return (
    <div className="space-y-4">
      <div onClick={() => setFlipped(!flipped)}
        className="cursor-pointer p-8 rounded-xl border-2 border-border bg-card text-center min-h-[200px] flex items-center justify-center transition-all hover:border-primary/30">
        <div>
          <p className="text-lg font-medium text-foreground">{flipped ? card.back : card.front}</p>
          {!flipped && card.hint && <p className="text-xs text-muted-foreground mt-2">Подсказка: {card.hint}</p>}
          <p className="text-xs text-muted-foreground mt-4">{flipped ? "← Вопрос" : "→ Ответ"}</p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" disabled={idx === 0} onClick={() => { setIdx(idx - 1); setFlipped(false); }}>← Назад</Button>
        <span className="text-sm text-muted-foreground">{idx + 1} / {cards.length}</span>
        <Button variant="outline" size="sm" disabled={idx === cards.length - 1} onClick={() => { setIdx(idx + 1); setFlipped(false); }}>Далее →</Button>
      </div>
    </div>
  );
};

const SlidesPlayer = ({ slides }: { slides: any[] }) => {
  const [idx, setIdx] = useState(0);
  const slide = slides[idx];
  if (!slide) return null;
  return (
    <div className="space-y-4">
      <div className="p-6 rounded-xl border-2 border-border bg-card min-h-[280px]">
        <Badge variant="outline" className="text-[10px] mb-3">{slide.type}</Badge>
        <h3 className="text-xl font-bold text-foreground mb-3">{slide.title}</h3>
        {slide.content && <p className="text-sm text-muted-foreground mb-3">{slide.content}</p>}
        {slide.bullets && (
          <ul className="space-y-1.5">
            {slide.bullets.map((b: string, i: number) => (
              <li key={i} className="text-sm text-muted-foreground flex gap-2"><span className="text-primary">•</span>{b}</li>
            ))}
          </ul>
        )}
      </div>
      {slide.notes && (
        <div className="p-3 rounded-lg bg-muted/30 border border-border">
          <p className="text-xs font-medium text-muted-foreground mb-1">Заметки спикера:</p>
          <p className="text-xs text-muted-foreground">{slide.notes}</p>
        </div>
      )}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>← Назад</Button>
        <span className="text-sm text-muted-foreground">{idx + 1} / {slides.length}</span>
        <Button variant="outline" size="sm" disabled={idx === slides.length - 1} onClick={() => setIdx(idx + 1)}>Далее →</Button>
      </div>
    </div>
  );
};

/* ═══════════════ Selection classifier ═══════════════ */
type SelectionType = "none" | "term" | "fragment";
function classifySelection(text: string | null | undefined): SelectionType {
  if (!text || text.length < 2) return "none";
  const words = text.trim().split(/\s+/).length;
  return words <= 3 ? "term" : "fragment";
}

/* ═══════════════ AI Actions menu — context-dependent, honest quiz ═══════════════ */
function getAssistantActions(
  format: OutputFormat,
  artifactKind: string | null,
  quizState: "answering" | "submitted",
  selectionType: SelectionType,
  isCorrect: boolean | null,
): { id: string; label: string; action: string }[] {
  const items: { id: string; label: string; action: string }[] = [];

  // ── Quiz context ──
  if (artifactKind === "quiz") {
    if (quizState === "answering") {
      // HONEST: no answers, no explanations
      if (selectionType === "term") {
        items.push({ id: "explain_term", label: "💡 Объяснить термин", action: "explain_term" });
      }
      items.push({ id: "hint", label: "🔎 Подсказка", action: "give_hint" });
      items.push({ id: "similar_q", label: "🔄 Похожий вопрос", action: "generate_quiz" });
      items.push({ id: "sources", label: "📄 Источники", action: "show_sources" });
    } else {
      // SUBMITTED: full review
      items.push({ id: "why_correct", label: "✅ Почему правильно", action: "explain_correct" });
      if (isCorrect === false) {
        items.push({ id: "explain_err", label: "🔍 Разобрать ошибку", action: "explain_mistake" });
      }
      items.push({ id: "extra_practice", label: "📚 Доп. практика", action: "remediate_topic" });
      items.push({ id: "remediate_lesson", label: "📖 Ремедиация в урок", action: "generate_lesson_blocks" });
      items.push({ id: "sources", label: "📄 Источники", action: "show_sources" });
    }
    return items;
  }

  // ── Course context ──
  if (artifactKind === "course" || artifactKind === "lesson_blocks") {
    if (selectionType === "term") {
      items.push({ id: "explain_term", label: "💡 Объяснить термин", action: "explain_term" });
      items.push({ id: "example", label: "📝 Пример", action: "give_example" });
    } else if (selectionType === "fragment") {
      items.push({ id: "expand", label: "📖 Расширить фрагмент", action: "expand_selection" });
      items.push({ id: "example", label: "📝 Пример", action: "give_example" });
    }
    items.push({ id: "quiz", label: "✅ Мини-квиз", action: "generate_quiz" });
    items.push({ id: "flashcards", label: "🃏 Сделать карточки", action: "generate_flashcards" });
    items.push({ id: "sources", label: "📄 Источники", action: "show_sources" });
    return items;
  }

  // ── Flashcards context ──
  if (artifactKind === "flashcards") {
    if (selectionType === "term") {
      items.push({ id: "explain_fc", label: "💡 Объяснить термин", action: "explain_term" });
    }
    items.push({ id: "quiz_me", label: "✅ Мини-квиз", action: "generate_quiz" });
    items.push({ id: "add_cards", label: "➕ Добавить карточек", action: "generate_flashcards" });
    items.push({ id: "sources", label: "📄 Источники", action: "show_sources" });
    return items;
  }

  // ── Slides context ──
  if (artifactKind === "slides") {
    items.push({ id: "qa", label: "🎤 Q&A репетиция", action: "generate_quiz" });
    items.push({ id: "improve_notes", label: "📝 Улучшить заметки", action: "expand_selection" });
    items.push({ id: "sources", label: "📄 Источники", action: "show_sources" });
    return items;
  }

  // Fallback
  items.push({ id: "sources", label: "📄 Источники", action: "show_sources" });
  return items;
}

/* ═══════════════ Preset→ArtifactKind mapping ═══════════════ */
function presetToArtifactKind(format: OutputFormat): string {
  switch (format) {
    case "COURSE_LEARN": return "course";
    case "QUIZ_ONLY": return "quiz";
    case "EXAM_PREP": return "quiz";
    case "INTERVIEW": return "quiz";
    case "FLASHCARDS": return "flashcards";
    case "PRESENTATION": return "slides";
  }
}

function presetLabel(format: OutputFormat): string {
  return OUTPUT_FORMATS.find(f => f.value === format)?.label || format;
}

/* ═══════════════ MAIN COMPONENT ═══════════════ */
interface GuidedWorkspaceProps {
  resumeProjectId?: string | null;
  onResumeComplete?: () => void;
}

export const GuidedWorkspace = ({ resumeProjectId, onResumeComplete }: GuidedWorkspaceProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sourceInputRef = useRef<HTMLInputElement>(null);

  // State machine
  const [phase, setPhase] = useState<GuidedPhase>("intake");
  const [intakeStep, setIntakeStep] = useState<IntakeStep>(0);
  const [intake, setIntake] = useState<IntakeData>({
    files: [], pastedText: "", goal: "", knowledgeLevel: "", depth: "", deadline: "", hoursPerWeek: "", preferences: [],
  });

  // Recommendation
  const [selectedFormat, setSelectedFormat] = useState<OutputFormat>("COURSE_LEARN");
  const [recommendedFormat, setRecommendedFormat] = useState<OutputFormat>("COURSE_LEARN");

  // Generate
  const [genStatus, setGenStatus] = useState<GenStatus>("idle");
  const [genStages, setGenStages] = useState<GenStage[]>(INITIAL_GEN_STAGES.map(s => ({ ...s })));
  const [projectId, setProjectId] = useState<string | null>(null);
  const [pipelineError, setPipelineError] = useState<EdgeError | null>(null);

  // Player
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null);
  const [sidePanel, setSidePanel] = useState<any>(null);
  const [showSidePanel, setShowSidePanel] = useState(true);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState<any>(null);
  const [submitScore, setSubmitScore] = useState<number | null>(null);
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState(0);
  const [showCheckinInPlayer, setShowCheckinInPlayer] = useState(false);
  const [showSourceManager, setShowSourceManager] = useState(false);
  const [isReplanning, setIsReplanning] = useState(false);

  // Checkin
  const [checkinAnswers, setCheckinAnswers] = useState({ hardTopics: "", pace: "normal", addMore: "" });

  // Resume from MyGuides
  useEffect(() => {
    if (resumeProjectId && resumeProjectId !== projectId) {
      setProjectId(resumeProjectId);
      setPhase("player");
      setGenStatus("done");
      onResumeComplete?.();
    }
  }, [resumeProjectId]);

  // Roadmap & artifacts from DB
  const { data: project } = useQuery({
    queryKey: ["guided-project", projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase.from("projects").select("*").eq("id", projectId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  const { data: artifacts = [] } = useQuery({
    queryKey: ["guided-artifacts", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase.from("artifacts").select("*").eq("project_id", projectId).order("sort_order", { ascending: true });
      if (error) throw error;
      return data as Artifact[];
    },
    enabled: !!projectId,
  });

  const { data: projectSources = [] } = useQuery({
    queryKey: ["project-sources", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data } = await supabase.from("project_sources").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!projectId,
  });

  // Auto-set active artifact when resuming
  useEffect(() => {
    if (artifacts.length > 0 && !activeArtifact && (phase === "player" || (phase === "generate" && genStatus === "done"))) {
      setActiveArtifact(artifacts[artifacts.length - 1]);
    }
  }, [artifacts, activeArtifact, phase, genStatus]);

  const roadmap = (project?.roadmap as any[]) || [];
  const nextStep = roadmap.find((s: any) => s.status === "available");

  /* ─── Mutations ─── */
  const actMutation = useMutation({
    mutationFn: async (params: { action_type: string; target?: any; context?: string }) => {
      return callEdge("artifact_act", { project_id: projectId, ...params });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["guided-artifacts"] });
      if (data.artifact_id) {
        supabase.from("artifacts").select("*").eq("id", data.artifact_id).single().then(({ data: art }) => {
          if (art) {
            setActiveArtifact(art as Artifact);
            setQuizSubmitted(false);
            setSubmitFeedback(null);
            setSubmitScore(null);
          }
        });
      }
      if (data.public_payload && !data.artifact_id) {
        setSidePanel({ type: "result", payload: data.public_payload, source_refs: data.source_refs });
        setShowSidePanel(true);
      }
      toast.success("Готово");
    },
    onError: (e: any) => {
      if (e.functionName) {
        setSidePanel({ type: "error", error: e as EdgeError });
        setShowSidePanel(true);
      } else {
        toast.error(`Ошибка: ${e.message || e}`);
      }
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (params: { artifact_id: string; answers: any[] }) => {
      return callEdge("artifact_submit", params);
    },
    onSuccess: (data) => {
      setQuizSubmitted(true);
      setSubmitFeedback(data.feedback);
      setSubmitScore(data.score);
      toast.success("Проверено!");
      // Trigger check-in after quiz submit
      setShowCheckinInPlayer(true);
    },
    onError: (e: any) => {
      if (e.functionName) {
        setSidePanel({ type: "error", error: e as EdgeError });
        setShowSidePanel(true);
      } else {
        toast.error(`Ошибка: ${e.message || e}`);
      }
    },
  });

  /* ─── Text selection tracking ─── */
  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection()?.toString().trim() || null;
    setSelectedText(sel && sel.length > 1 && sel.length < 200 ? sel : null);
  }, []);

  /* ─── Generate pipeline helpers ─── */
  const updateStage = (key: GenStageKey, status: GenStageStatus, error?: EdgeError) => {
    setGenStages(prev => prev.map(s => s.key === key ? { ...s, status, error } : s));
  };

  // Store extracted docs so retry can reuse them
  const extractedDocsRef = useRef<{ text: string; file_name: string }[]>([]);

  const runStageUpload = async (projId: string): Promise<void> => {
    // Upload stage is already done when we call runPipeline (docs extracted in handleGenerate)
    // This is a no-op placeholder for retry — real upload happens in handleGenerate
  };

  const runStageIngest = async (projId: string, docs: { text: string; file_name: string }[]): Promise<void> => {
    const maxChars = 1200;
    const overlap = 150;

    // Delete old chunks before re-ingesting
    await supabase.from("project_chunks").delete().eq("project_id", projId);

    for (const doc of docs) {
      if (!doc.text.trim()) continue;

      // Create a project_source record for each doc (source_id FK requires this)
      const { data: sourceRec, error: srcErr } = await supabase.from("project_sources").insert({
        project_id: projId,
        user_id: user!.id,
        file_name: doc.file_name,
        file_type: doc.file_name.split(".").pop() || "txt",
        storage_path: `${user!.id}/${projId}/raw/${doc.file_name}`,
        status: "processed",
        file_size: doc.text.length,
      }).select("id").single();

      if (srcErr) {
        throw { functionName: "source_insert", status: 0, body: srcErr.message } as EdgeError;
      }

      const sourceId = sourceRec.id;
      const chunks: { project_id: string; user_id: string; content: string; metadata: any; source_id: string }[] = [];

      let start = 0;
      let chunkIndex = 0;
      while (start < doc.text.length) {
        const end = Math.min(start + maxChars, doc.text.length);
        chunks.push({
          project_id: projId, user_id: user!.id,
          content: doc.text.slice(start, end),
          metadata: { file_name: doc.file_name, chunk_index: chunkIndex, start_char: start, end_char: end },
          source_id: sourceId,
        });
        start = end - overlap;
        if (start >= doc.text.length) break;
        chunkIndex++;
      }

      // Insert chunks in batches
      for (let i = 0; i < chunks.length; i += 50) {
        const batch = chunks.slice(i, i + 50);
        const { error: insertErr } = await supabase.from("project_chunks").insert(batch);
        if (insertErr) {
          throw { functionName: "chunk_insert", status: 0, body: insertErr.message } as EdgeError;
        }
      }
    }

    // Verify at least some chunks were created
    const { count } = await supabase.from("project_chunks").select("id", { count: "exact", head: true }).eq("project_id", projId);
    if (!count || count === 0) {
      throw { functionName: "chunking", status: 0, body: "Не удалось создать чанки из текста — проверьте содержимое файлов" } as EdgeError;
    }

    await supabase.from("projects").update({ status: "ingested" }).eq("id", projId);
  };

  const runStagePlan = async (projId: string): Promise<void> => {
    await withTimeout(callEdge("project_plan", { project_id: projId }), LLM_STAGE_TIMEOUT_MS, "project_plan");
  };

  const runStageGenerate = async (projId: string, format: OutputFormat): Promise<string | null> => {
    const actionType = formatToActionType(format);
    const actData = await withTimeout(
      callEdge("artifact_act", { project_id: projId, action_type: actionType, context: `Format: ${format}` }),
      LLM_STAGE_TIMEOUT_MS, "artifact_act"
    );
    return actData?.artifact_id || null;
  };

  /** Run pipeline from a specific stage (inclusive) */
  const runPipelineFrom = async (projId: string, fromStage: GenStageKey, docs: { text: string; file_name: string }[], format: OutputFormat) => {
    setPipelineError(null);
    const stageOrder: GenStageKey[] = ["uploading", "ingesting", "planning", "generating"];
    const startIdx = stageOrder.indexOf(fromStage);

    // Reset stages from startIdx onward to pending
    setGenStages(prev => prev.map((s, i) => {
      const si = stageOrder.indexOf(s.key);
      if (si >= startIdx) return { ...s, status: "pending" as GenStageStatus, error: undefined };
      return s;
    }));

    try {
      for (let i = startIdx; i < stageOrder.length; i++) {
        const key = stageOrder[i];
        updateStage(key, "running");
        setGenStatus(key);

        try {
          if (key === "uploading") {
            await runStageUpload(projId);
          } else if (key === "ingesting") {
            await withTimeout(runStageIngest(projId, docs), STAGE_TIMEOUT_MS, "ingest");
          } else if (key === "planning") {
            await runStagePlan(projId);
          } else if (key === "generating") {
            const artId = await runStageGenerate(projId, format);
            if (artId) {
              const { data: art } = await supabase.from("artifacts").select("*").eq("id", artId).single();
              if (art) setActiveArtifact(art as Artifact);
            }
          }
          updateStage(key, "done");
        } catch (stageErr: any) {
          const edgeErr: EdgeError = stageErr.functionName
            ? stageErr
            : { functionName: key, status: 0, body: stageErr.message || String(stageErr) };
          updateStage(key, "error", edgeErr);
          throw edgeErr;
        }
      }

      queryClient.invalidateQueries({ queryKey: ["guided-project", projId] });
      queryClient.invalidateQueries({ queryKey: ["guided-artifacts", projId] });
      queryClient.invalidateQueries({ queryKey: ["my-guided-projects"] });

      setGenStatus("done");
      setPhase("player");
      toast.success("Гайд создан!");
    } catch (e: any) {
      console.error("Pipeline error:", e);
      setGenStatus("error");
      if (e.functionName) {
        setPipelineError(e as EdgeError);
      } else {
        setPipelineError({ functionName: "unknown", status: 0, body: e.message || String(e) });
      }
    }
  };

  // Legacy compat wrapper
  const runPipeline = async (projId: string, extractedDocs: { text: string; file_name: string }[], format: OutputFormat) => {
    extractedDocsRef.current = extractedDocs;
    updateStage("uploading", "done"); // upload already done
    await runPipelineFrom(projId, "ingesting", extractedDocs, format);
  };

  const handleGenerate = async () => {
    if (!user) return;
    setPhase("generate");
    setGenStatus("uploading");
    setPipelineError(null);
    setGenStages(INITIAL_GEN_STAGES.map(s => ({ ...s })));
    updateStage("uploading", "running");

    try {
      const projectTitle = intake.files[0]?.name?.replace(/\.\w+$/, "") ||
        (intake.pastedText.trim().slice(0, 40) || `Проект ${new Date().toLocaleDateString("ru-RU")}`);
      const { data: proj, error: projErr } = await supabase.from("projects").insert({
        user_id: user.id,
        title: projectTitle,
        goal: intake.goal,
        audience: intake.knowledgeLevel,
        description: `depth=${intake.depth}, prefs=${intake.preferences.join(",")}`,
        status: "draft",
      }).select().single();
      if (projErr) {
        const err = { functionName: "create_project", status: 0, body: projErr.message } as EdgeError;
        updateStage("uploading", "error", err);
        throw err;
      }
      setProjectId(proj.id);

      const extractedDocs: { text: string; file_name: string }[] = [];
      for (const file of intake.files) {
        try {
          const text = await withTimeout(extractText(file), STAGE_TIMEOUT_MS, `extractText(${file.name})`);
          if (!text.trim()) continue;
          extractedDocs.push({ text, file_name: file.name });
          const rawPath = `${user.id}/${proj.id}/raw/${file.name}`;
          await supabase.storage.from("ai_sources").upload(rawPath, file, { upsert: true });
        } catch (e: any) {
          console.warn(`Extraction failed ${file.name}:`, e);
          if (e.functionName) throw e; // timeout — propagate
        }
      }

      if (intake.pastedText.trim()) {
        extractedDocs.push({ text: intake.pastedText.trim(), file_name: "pasted_text.txt" });
      }

      // Quality check on extracted content
      const qualityError = checkContentQuality(extractedDocs);
      if (qualityError) {
        const err = { functionName: "quality_check", status: 0, body: qualityError } as EdgeError;
        updateStage("uploading", "error", err);
        throw err;
      }

      extractedDocsRef.current = extractedDocs;
      updateStage("uploading", "done");
      await runPipelineFrom(proj.id, "ingesting", extractedDocs, selectedFormat);
    } catch (e: any) {
      console.error("Generate error:", e);
      setGenStatus("error");
      if (e.functionName) {
        setPipelineError(e as EdgeError);
      } else {
        setPipelineError({ functionName: "unknown", status: 0, body: e.message || String(e) });
      }
    }
  };

  /* ─── Retry pipeline from the specific failed stage ─── */
  const handleRetryStage = (stageKey?: GenStageKey) => {
    if (!projectId) return;
    // Find the first failed stage if none specified
    const failedStage = stageKey || genStages.find(s => s.status === "error")?.key;
    if (!failedStage) return;

    setPipelineError(null);
    setPhase("generate");
    runPipelineFrom(projectId, failedStage, extractedDocsRef.current, selectedFormat);
  };

  // Back-compat alias
  const handleRetryPipeline = () => handleRetryStage();

  /* ─── Demo project ─── */
  const handleDemo = async () => {
    if (!user) return;
    setIntake({ files: [], pastedText: "", goal: "self_learn", knowledgeLevel: "basic", depth: "normal", deadline: "", hoursPerWeek: "", preferences: ["examples"] });
    setSelectedFormat("COURSE_LEARN");
    setPhase("generate");
    setGenStatus("uploading");
    setPipelineError(null);

    try {
      const { data: proj, error } = await supabase.from("projects").insert({
        user_id: user.id, title: "Demo: TypeScript", status: "draft",
      }).select().single();
      if (error) throw { functionName: "create_project", status: 0, body: error.message };
      setProjectId(proj.id);

      const demoText = `TypeScript — язык программирования от Microsoft, надмножество JavaScript с статической типизацией.\n\nОсновные типы: string, number, boolean, any, void, null, undefined, never.\n\nИнтерфейсы описывают структуру объектов:\ninterface User { name: string; age: number; email?: string; }\n\nДженерики обеспечивают переиспользование:\nfunction identity<T>(arg: T): T { return arg; }\n\nEnum — именованные константы:\nenum Direction { Up, Down, Left, Right }\n\nUnion и Intersection типы:\ntype StringOrNumber = string | number;\ntype NamedAndAged = Named & Aged;`;

      await runPipeline(proj.id, [{ text: demoText, file_name: "typescript.md" }], "COURSE_LEARN");
    } catch (e: any) {
      setGenStatus("error");
      setPipelineError(e.functionName ? e : { functionName: "unknown", status: 0, body: e.message || String(e) });
    }
  };

  /* ─── Assistant action handler ─── */
  const handleAssistantAction = (action: string) => {
    if (action === "show_sources") {
      setSidePanel({ type: "sources", refs: activeArtifact?.public_json?.source_refs || [] });
      setShowSidePanel(true);
      return;
    }
    const selection = window.getSelection()?.toString().trim();
    actMutation.mutate({
      action_type: action,
      target: selection ? { term: selection, selected_text: selection } : undefined,
      context: activeArtifact?.title,
    });
  };

  const handleTermClick = (term: string) => {
    setSidePanel({ type: "loading", term });
    setShowSidePanel(true);
    actMutation.mutate(
      { action_type: "explain_term", target: { term }, context: activeArtifact?.title },
      {
        onSuccess: (data) => {
          setSidePanel({ type: "result", payload: data.public_payload, source_refs: data.source_refs });
        },
      }
    );
  };

  /* ─── Check-in ─── */
  const handleCheckin = async () => {
    if (!projectId) return;
    try {
      const result = await callEdge("project_checkin", {
        project_id: projectId,
        answers: {
          hard_topics: checkinAnswers.hardTopics.split(",").map((s) => s.trim()).filter(Boolean),
          pace: checkinAnswers.pace, add_more: checkinAnswers.addMore,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["guided-project", projectId] });
      setCompletedSteps((c) => c + 1);
      setShowCheckinInPlayer(false);
      setCheckinAnswers({ hardTopics: "", pace: "normal", addMore: "" });
      toast.success("Roadmap обновлён");
      // If roadmap was updated, highlight suggested next step
      if (result?.roadmap_updated) {
        toast.info("Следующий шаг обновлён на основе ваших ответов");
      }
    } catch (e: any) {
      toast.error(e.functionName ? `Ошибка ${e.functionName}: ${e.body}` : (e.message || "Ошибка"));
    }
  };

  /* ─── Next step from roadmap ─── */
  const handleNextStep = () => {
    if (nextStep) {
      const actionMap: Record<string, string> = {
        course: "generate_lesson_blocks", quiz: "generate_quiz",
        flashcards: "generate_flashcards", slides: "generate_slides",
        method_pack: "generate_method_pack",
      };
      actMutation.mutate({
        action_type: actionMap[nextStep.artifact_type] || formatToActionType(selectedFormat),
        target: { topic_id: nextStep.id },
        context: nextStep.title,
      });
    } else {
      setPhase("finish");
    }
  };

  /* ─── Add sources to existing project ─── */
  const handleAddSources = async (files: File[]) => {
    if (!projectId || !user) return;
    try {
      for (const file of files) {
        const text = await extractText(file);
        if (!text.trim()) continue;

        // Create a project_source record first
        const { data: sourceRec, error: srcErr } = await supabase.from("project_sources").insert({
          project_id: projectId, user_id: user.id,
          file_name: file.name,
          file_type: file.name.split(".").pop() || "txt",
          storage_path: `${user.id}/${projectId}/raw/${file.name}`,
          status: "processed",
          file_size: text.length,
        }).select("id").single();

        if (srcErr) { toast.error(`Ошибка: ${srcErr.message}`); continue; }

        const maxChars = 1200;
        const overlap = 150;
        let start = 0;
        let chunkIndex = 0;
        while (start < text.length) {
          const end = Math.min(start + maxChars, text.length);
          await supabase.from("project_chunks").insert({
            project_id: projectId, user_id: user.id,
            content: text.slice(start, end),
            metadata: { file_name: file.name, chunk_index: chunkIndex },
            source_id: sourceRec.id,
          });
          start = end - overlap;
          if (start >= text.length) break;
          chunkIndex++;
        }
      }
      queryClient.invalidateQueries({ queryKey: ["project-sources", projectId] });
      toast.success(`${files.length} источник(ов) добавлено`);
    } catch (e: any) {
      toast.error("Ошибка добавления источников");
    }
  };

  /* ─── Remove source ─── */
  const handleRemoveSource = async (sourceId: string) => {
    await supabase.from("project_chunks").delete().eq("source_id", sourceId);
    await supabase.from("project_sources").delete().eq("id", sourceId);
    queryClient.invalidateQueries({ queryKey: ["project-sources", projectId] });
    toast.success("Источник удалён");
  };

  /* ─── Replan (partial re-generation) ─── */
  const handleReplan = async () => {
    if (!projectId) return;
    setIsReplanning(true);
    try {
      await callEdge("project_plan", { project_id: projectId });
      queryClient.invalidateQueries({ queryKey: ["guided-project", projectId] });
      toast.success("План обновлён — выберите следующий шаг");
    } catch (e: any) {
      toast.error("Ошибка реплана");
    } finally {
      setIsReplanning(false);
      setShowSourceManager(false);
    }
  };

  /* ═══════════════ RENDER ═══════════════ */

  /* ─── INTAKE ─── */
  if (phase === "intake") {
    const hasSources = intake.files.length > 0 || intake.pastedText.trim().length > 0;
    const canProceed = (() => {
      if (intakeStep === 0) return hasSources;
      if (intakeStep === 1) return !!intake.goal;
      if (intakeStep === 2) return !!intake.knowledgeLevel;
      if (intakeStep === 3) return !!intake.depth;
      return true;
    })();

    const stepTitles = ["Источники", "Цель", "Уровень знаний", "Глубина", "Ограничения", "Предпочтения"];

    return (
      <div className="space-y-6 max-w-xl mx-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Новый проект</h2>
          <Button variant="ghost" size="sm" onClick={handleDemo}><Bug className="h-4 w-4 mr-1" /> Demo</Button>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{stepTitles[intakeStep]}</span>
            <span>{intakeStep + 1}/6</span>
          </div>
          <Progress value={((intakeStep + 1) / 6) * 100} className="h-1.5" />
        </div>

        {intakeStep === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Загрузите файлы и/или вставьте текст. Нужен хотя бы один источник.</p>
            <div onClick={() => fileInputRef.current?.click()}
              className="rounded-xl border-2 border-dashed border-border bg-card p-6 text-center cursor-pointer hover:border-primary/40 transition-all">
              {intake.files.length > 0 ? (
                <div className="space-y-2">
                  {intake.files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 justify-center">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="text-sm text-foreground">{f.name}</span>
                      <button onClick={(e) => { e.stopPropagation(); setIntake((p) => ({ ...p, files: p.files.filter((_, j) => j !== i) })); }}
                        className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">Нажмите, чтобы добавить ещё</p>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">PDF, TXT, MD, DOCX</p>
                </>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md,.docx" multiple className="hidden"
              onChange={(e) => { if (e.target.files?.length) setIntake((p) => ({ ...p, files: [...p.files, ...Array.from(e.target.files!)] })); e.target.value = ""; }} />

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Или вставьте текст</label>
              <textarea
                value={intake.pastedText}
                onChange={(e) => setIntake((p) => ({ ...p, pastedText: e.target.value }))}
                placeholder="Вставьте текст из лекции, статьи, конспекта…"
                className="w-full min-h-[100px] rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-y focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {!hasSources && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Добавьте хотя бы один источник, чтобы продолжить
              </p>
            )}
          </div>
        )}

        {intakeStep === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Зачем вам этот материал?</p>
            {GOAL_OPTIONS.map((opt) => (
              <button key={opt.value} onClick={() => {
                setIntake((p) => ({ ...p, goal: opt.value }));
                setTimeout(() => setIntakeStep(2), 300);
              }}
                className={cn("w-full text-left p-4 rounded-lg border transition-all text-sm",
                  intake.goal === opt.value ? "border-primary bg-primary/10 text-foreground" : "border-border hover:border-primary/30 text-muted-foreground")}>
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {intakeStep === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Ваш текущий уровень знаний по теме?</p>
            {KNOWLEDGE_LEVELS.map((opt) => (
              <button key={opt.value} onClick={() => {
                setIntake((p) => ({ ...p, knowledgeLevel: opt.value }));
                setTimeout(() => setIntakeStep(3), 300);
              }}
                className={cn("w-full text-left p-4 rounded-lg border transition-all",
                  intake.knowledgeLevel === opt.value ? "border-primary bg-primary/10" : "border-border hover:border-primary/30")}>
                <span className="text-sm font-medium text-foreground">{opt.label}</span>
                <p className="text-xs text-muted-foreground">{opt.desc}</p>
              </button>
            ))}
          </div>
        )}

        {intakeStep === 3 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Насколько глубоко изучать?</p>
            <div className="flex gap-2">
              {DEPTH_OPTIONS.map((opt) => (
                <button key={opt.value} onClick={() => {
                  setIntake((p) => ({ ...p, depth: opt.value }));
                  setTimeout(() => setIntakeStep(4), 300);
                }}
                  className={cn("flex-1 p-4 rounded-lg border text-center transition-all text-sm",
                    intake.depth === opt.value ? "border-primary bg-primary/10 text-foreground" : "border-border hover:border-primary/30 text-muted-foreground")}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {intakeStep === 4 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Ограничения (необязательно)</p>
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Дедлайн</label>
              <Input type="date" value={intake.deadline} onChange={(e) => setIntake((p) => ({ ...p, deadline: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Часов в неделю</label>
              <Input type="number" min="1" max="40" placeholder="Например: 5"
                value={intake.hoursPerWeek} onChange={(e) => setIntake((p) => ({ ...p, hoursPerWeek: e.target.value }))} />
            </div>
          </div>
        )}

        {intakeStep === 5 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Предпочтения (можно выбрать несколько)</p>
            <div className="flex flex-wrap gap-2">
              {PREF_OPTIONS.map((opt) => {
                const active = intake.preferences.includes(opt.value);
                return (
                  <button key={opt.value}
                    onClick={() => setIntake((p) => ({
                      ...p, preferences: active ? p.preferences.filter((v) => v !== opt.value) : [...p.preferences, opt.value],
                    }))}
                    className={cn("px-4 py-2 rounded-full border text-sm transition-all",
                      active ? "border-primary bg-primary/10 text-foreground" : "border-border hover:border-primary/30 text-muted-foreground")}>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-between pt-2">
          <Button variant="ghost" size="sm" onClick={() => intakeStep > 0 ? setIntakeStep((s) => (s - 1) as IntakeStep) : null} disabled={intakeStep === 0}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Назад
          </Button>
          {/* Show Далее for all steps where it makes sense */}
          {intakeStep === 0 && (
            <Button size="sm" disabled={!canProceed} onClick={() => setIntakeStep(1)}>
              Далее <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {intakeStep === 1 && (
            <Button size="sm" disabled={!intake.goal} onClick={() => setIntakeStep(2)}>
              Далее <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {intakeStep === 2 && (
            <Button size="sm" disabled={!intake.knowledgeLevel} onClick={() => setIntakeStep(3)}>
              Далее <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {intakeStep === 3 && (
            <Button size="sm" disabled={!intake.depth} onClick={() => setIntakeStep(4)}>
              Далее <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {intakeStep === 4 && (
            <Button size="sm" variant="ghost" onClick={() => setIntakeStep(5)}>
              Пропустить <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {intakeStep === 5 && (
            <Button size="sm" onClick={() => {
              const rec = recommendFormat(intake);
              setRecommendedFormat(rec);
              setSelectedFormat(rec);
              setPhase("recommendation");
            }}>
              К рекомендациям <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  /* ─── RECOMMENDATION ─── */
  if (phase === "recommendation") {
    const recInfo = OUTPUT_FORMATS.find((f) => f.value === recommendedFormat)!;
    return (
      <div className="space-y-6 max-w-xl mx-auto">
        <h2 className="text-lg font-bold text-foreground">Рекомендация</h2>
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-5 space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <recInfo.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{recInfo.label}</p>
                <p className="text-xs text-muted-foreground">{recInfo.desc}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {recommendReason(intake, recommendedFormat)}
            </p>
          </CardContent>
        </Card>

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Или выберите другой формат:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {OUTPUT_FORMATS.map((f) => {
              const Icon = f.icon;
              const isRec = f.value === recommendedFormat;
              return (
                <button key={f.value} onClick={() => setSelectedFormat(f.value)}
                  className={cn("flex flex-col items-center gap-2 p-3 rounded-lg border transition-all text-center relative",
                    selectedFormat === f.value ? "border-primary bg-primary/10" : "border-border hover:border-primary/30")}>
                  {isRec && <Badge variant="default" className="absolute -top-2 -right-2 text-[9px] px-1.5 py-0">Рек.</Badge>}
                  <Icon className={cn("h-5 w-5", selectedFormat === f.value ? "text-primary" : "text-muted-foreground")} />
                  <div>
                    <p className="text-sm font-medium text-foreground">{f.label}</p>
                    <p className="text-[11px] text-muted-foreground leading-tight">{f.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-between">
          <Button variant="ghost" size="sm" onClick={() => { setPhase("intake"); setIntakeStep(5); }}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Назад
          </Button>
          <Button onClick={handleGenerate}>
            <Sparkles className="h-4 w-4 mr-2" /> Создать
          </Button>
        </div>
      </div>
    );
  }

  /* ─── GENERATE (progress / error screens) ─── */
  if (phase === "generate" && genStatus !== "done") {
    const isError = genStatus === "error";

    if (isError) {
      return (
        <div className="space-y-6 max-w-xl mx-auto py-8">
          <h2 className="text-lg font-bold text-foreground">Генерация</h2>
          <div className="space-y-2">
            {genStages.map((stage) => {
              const Icon = stage.icon;
              return (
                <div key={stage.key} className="space-y-0">
                  <div className={cn("flex items-center gap-3 p-3 rounded-lg border",
                    stage.status === "error" ? "border-destructive/30 bg-destructive/5" :
                    stage.status === "done" ? "border-accent/30 bg-accent/5" : "border-border")}>
                    {stage.status === "done" ? <CheckCircle2 className="h-4 w-4 text-accent shrink-0" /> :
                     stage.status === "error" ? <AlertTriangle className="h-4 w-4 text-destructive shrink-0" /> :
                     stage.status === "running" ? <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" /> :
                     <Icon className="h-4 w-4 text-muted-foreground/40 shrink-0" />}
                    <span className={cn("text-sm flex-1", stage.status === "error" ? "text-destructive" :
                      stage.status === "done" ? "text-foreground" : "text-muted-foreground")}>{stage.label}</span>
                    {stage.status === "error" && (
                      <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => handleRetryStage(stage.key)}>
                        <RotateCcw className="h-3 w-3 mr-1" /> Повторить
                      </Button>
                    )}
                  </div>
                  {/* Debug details for error stage */}
                  {stage.status === "error" && stage.error && (
                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-xs ml-7 mt-1">
                          Подробнее <ChevronDown className="h-3 w-3 ml-1" />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="ml-7 mt-1 p-3 rounded-lg bg-muted/30 text-[11px] text-muted-foreground space-y-1">
                          <p><strong>Стадия:</strong> {stage.key}</p>
                          <p><strong>Функция:</strong> {stage.error.functionName}</p>
                          <p><strong>Статус:</strong> HTTP {stage.error.status}</p>
                          <p className="whitespace-pre-wrap break-all"><strong>Сообщение:</strong> {stage.error.body?.slice(0, 500)}</p>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>
              );
            })}
          </div>
          {pipelineError && <EdgeErrorCard error={pipelineError} onRetry={handleRetryPipeline} />}
          <Button variant="ghost" size="sm" onClick={() => { setPhase("recommendation"); setGenStatus("idle"); setPipelineError(null); }}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Назад к настройкам
          </Button>
        </div>
      );
    }

    // Progress screen
    const doneCount = genStages.filter(s => s.status === "done").length;
    const genProgressVal = (doneCount / genStages.length) * 100;

    return (
      <div className="space-y-6 max-w-xl mx-auto py-8">
        <h2 className="text-lg font-bold text-foreground">Создаём ваш гайд…</h2>
        <Progress value={genProgressVal} className="h-2" />
        <div className="space-y-2">
          {genStages.map((stage) => {
            const Icon = stage.icon;
            return (
              <div key={stage.key} className={cn("flex items-center gap-3 p-3 rounded-lg border",
                stage.status === "done" ? "border-accent/30 bg-accent/5" :
                stage.status === "running" ? "border-primary/30 bg-primary/5" : "border-border")}>
                {stage.status === "done" ? <CheckCircle2 className="h-4 w-4 text-accent shrink-0" /> :
                 stage.status === "running" ? <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" /> :
                 <Icon className="h-4 w-4 text-muted-foreground/40 shrink-0" />}
                <span className={cn("text-sm", stage.status === "done" ? "text-foreground" :
                  stage.status === "running" ? "text-foreground font-medium" : "text-muted-foreground/50")}>{stage.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ═══════════════ PLAYER (70/30 layout) ═══════════════ */
  if (phase === "player" || (phase === "generate" && genStatus === "done")) {
    const pub = activeArtifact?.public_json as any;
    const artifactKind = pub?.kind || activeArtifact?.type || null;
    const selType = classifySelection(selectedText);
    const quizState: "answering" | "submitted" = quizSubmitted ? "submitted" : "answering";
    const isCorrect = submitFeedback?.passed ?? null;
    const menuItems = getAssistantActions(selectedFormat, artifactKind, quizState, selType, isCorrect);
    const expectedKind = presetToArtifactKind(selectedFormat);

    /* ─── Content renderer ─── */
    const renderContent = () => {
      if (!activeArtifact || !pub) {
        return (
          <div className="text-center py-16">
            <Brain className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Нет контента. Нажмите «Следующий шаг».</p>
          </div>
        );
      }

      // Quiz
      if (artifactKind === "quiz" && pub.questions) {
        return (
          <QuizPlayer
            questions={pub.questions}
            onSubmit={(answers) => submitMutation.mutate({ artifact_id: activeArtifact.id, answers })}
            submitted={quizSubmitted}
            feedback={submitFeedback}
            score={submitScore}
          />
        );
      }

      // Flashcards
      if (artifactKind === "flashcards" && pub.cards) {
        return <FlashcardsPlayer cards={pub.cards} />;
      }

      // Slides
      if (artifactKind === "slides" && pub.slides) {
        return <SlidesPlayer slides={pub.slides} />;
      }

      // Course / lesson blocks
      if ((artifactKind === "course" || artifactKind === "lesson_blocks") && (pub.modules || pub.blocks)) {
        const blocks = pub.modules
          ? pub.modules.flatMap((m: any) => [{ id: m.id, title: m.title, type: "text", content: "" }, ...(m.lessons || [])])
          : pub.blocks || [];
        return (
          <div className="space-y-3" onMouseUp={handleMouseUp}>
            {blocks.filter((b: any) => b.title || b.content).map((block: any) => (
              <BlockRenderer key={block.id} block={block} onTermClick={handleTermClick} />
            ))}
          </div>
        );
      }

      // Assistant note (inline action result rendered in main — shouldn't happen normally)
      if (artifactKind === "assistant_note") {
        return <AssistantNoteCard payload={pub} />;
      }

      // Method pack (legacy)
      if (artifactKind === "method_pack" && pub.blocks) {
        return (
          <div className="space-y-3">
            {pub.blocks.map((block: any) => (
              <BlockRenderer key={block.id} block={block} onTermClick={handleTermClick} />
            ))}
          </div>
        );
      }

      // ── ErrorCard: unknown / unsupported payload ──
      return (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              <p className="text-sm font-medium text-foreground">
                Ожидался «{expectedKind}», получен «{artifactKind || "unknown"}»
              </p>
            </div>
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="text-xs">
                  Детали <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <pre className="text-[11px] text-muted-foreground bg-muted/30 p-3 rounded-lg mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all">
                  {JSON.stringify(pub, null, 2).slice(0, 2000)}
                </pre>
              </CollapsibleContent>
            </Collapsible>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                navigator.clipboard.writeText(JSON.stringify({ expected: expectedKind, received: artifactKind, payload: pub }, null, 2));
                toast.success("Скопировано");
              }}>
                <Copy className="h-3 w-3 mr-1" /> Копировать отчёт
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
                actMutation.mutate({
                  action_type: formatToActionType(selectedFormat),
                  context: `Retry: expected ${expectedKind}`,
                });
              }}>
                <RotateCcw className="h-3 w-3 mr-1" /> Повторить
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    };

    /* ─── Side panel renderer ─── */
    const renderSidePanel = () => (
      <div className="space-y-4">
        {/* Side panel header */}
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Панель AI</h3>
          <button onClick={() => setShowSidePanel(false)} className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* AI Actions — deterministic buttons */}
        <div className="space-y-1.5">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleAssistantAction(item.action)}
              disabled={actMutation.isPending}
              className="w-full text-left px-3 py-2 rounded-lg border border-border bg-card hover:border-primary/30 hover:bg-primary/5 text-sm text-foreground transition-all disabled:opacity-50"
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Selection indicator */}
        {selectedText && (
          <div className="p-2 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
              Выделено ({selType === "term" ? "термин" : "фрагмент"})
            </p>
            <p className="text-xs text-foreground truncate">{selectedText}</p>
          </div>
        )}

        {/* Side panel content (results from AI actions) */}
        {sidePanel && (
          <div className="space-y-3 p-3 rounded-lg border border-border bg-card/50">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-foreground">
                {sidePanel.type === "loading" ? "Загрузка..." :
                 sidePanel.type === "sources" ? "Источники" :
                 sidePanel.type === "error" ? "Ошибка" : "Результат"}
              </h4>
              <button onClick={() => setSidePanel(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
            </div>

            {sidePanel.type === "loading" && <Loader2 className="h-5 w-5 text-primary animate-spin" />}

            {sidePanel.type === "error" && sidePanel.error && (
              <EdgeErrorCard error={sidePanel.error} onRetry={() => setSidePanel(null)} />
            )}

            {sidePanel.type === "sources" && (
              <div className="space-y-1">
                {(sidePanel.refs || []).length > 0 ? sidePanel.refs.map((r: string, i: number) => (
                  <p key={i} className="text-xs text-muted-foreground flex items-center gap-1"><FileSearch className="h-3 w-3" />{r}</p>
                )) : <p className="text-xs text-muted-foreground">Нет привязанных источников</p>}
              </div>
            )}

            {sidePanel.type === "result" && sidePanel.payload && (() => {
              const p = sidePanel.payload;
              if (p.kind === "assistant_note") {
                return <AssistantNoteCard payload={p} sourceRefs={sidePanel.source_refs} />;
              }
              if (p.kind === "method_pack" && p.blocks) {
                return (
                  <div className="space-y-2">
                    {p.blocks.map((b: any) => <BlockRenderer key={b.id} block={b} />)}
                  </div>
                );
              }
              if (p.kind === "quiz" && p.questions) {
                return <p className="text-sm text-muted-foreground">Квиз создан — переключено на основной контент</p>;
              }
              if (p.kind === "flashcards" && p.cards) {
                return <p className="text-sm text-muted-foreground">Карточки созданы — переключено</p>;
              }
              return <UnknownPayloadCard kind={p.kind || "unknown"} payload={p} />;
            })()}
          </div>
        )}

        {/* Sources quick access */}
        <div className="pt-2 border-t border-border space-y-2">
          <button
            onClick={() => setShowSourceManager(!showSourceManager)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            <FileText className="h-3 w-3" />
            <span>Источники ({projectSources.length})</span>
            <ChevronDown className={cn("h-3 w-3 ml-auto transition-transform", showSourceManager && "rotate-180")} />
          </button>

          {showSourceManager && (
            <div className="space-y-2 animate-fade-in">
              {projectSources.map((src: any) => (
                <div key={src.id} className="flex items-center justify-between text-xs p-2 rounded bg-muted/30">
                  <span className="text-foreground truncate flex-1">{src.file_name}</span>
                  <button onClick={() => handleRemoveSource(src.id)} className="text-muted-foreground hover:text-destructive ml-2">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" className="text-xs flex-1 h-7" onClick={() => sourceInputRef.current?.click()}>
                  <Plus className="h-3 w-3 mr-1" /> Добавить
                </Button>
                <Button variant="outline" size="sm" className="text-xs flex-1 h-7" onClick={handleReplan} disabled={isReplanning}>
                  {isReplanning ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                  Replan
                </Button>
              </div>
              <input ref={sourceInputRef} type="file" accept=".pdf,.txt,.md,.docx" multiple className="hidden"
                onChange={(e) => { if (e.target.files?.length) handleAddSources(Array.from(e.target.files)); e.target.value = ""; }} />
            </div>
          )}
        </div>
      </div>
    );

    return (
      <div className="space-y-3" onMouseUp={handleMouseUp}>
        {/* ── Header bar: preset badge + title + next step ── */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Badge variant="outline" className="shrink-0 text-xs">{presetLabel(selectedFormat)}</Badge>
            <h2 className="text-base font-bold text-foreground truncate">{project?.title || activeArtifact?.title || "Плеер"}</h2>
          </div>
          <div className="flex items-center gap-2">
            {!showSidePanel && (
              <Button variant="ghost" size="sm" onClick={() => setShowSidePanel(true)}>
                <PanelRight className="h-4 w-4" />
              </Button>
            )}
            <Button size="sm" variant="default" onClick={handleNextStep} disabled={actMutation.isPending || !nextStep}>
              {actMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <MapPin className="h-4 w-4 mr-1" />}
              {nextStep ? "Следующий шаг" : "Завершить"}
            </Button>
          </div>
        </div>

        {/* ── Roadmap mini-bar ── */}
        {roadmap.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {roadmap.map((step: any, i: number) => {
                const isCurrent = step.status === "in_progress" || step.status === "available";
                return (
                  <div key={step.id} title={step.title}
                    className={cn("h-2 flex-1 rounded-full min-w-[20px] transition-all cursor-pointer",
                      step.status === "completed" ? "bg-accent" :
                      step.status === "available" ? "bg-primary" :
                      step.status === "in_progress" ? "bg-primary/60 animate-pulse" : "bg-muted",
                      isCurrent && "ring-1 ring-primary ring-offset-1 ring-offset-background"
                    )} />
                );
              })}
            </div>
            {nextStep && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3 text-primary" />
                Далее: <span className="text-foreground font-medium">{nextStep.title}</span>
                {nextStep.artifact_type && (
                  <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-1">{nextStep.artifact_type}</Badge>
                )}
              </p>
            )}
          </div>
        )}

        {/* ── 70/30 layout ── */}
        <div className={cn("grid gap-4", showSidePanel ? "lg:grid-cols-[1fr_340px]" : "grid-cols-1")}>
          {/* ── Content (70%) ── */}
          <div className="min-w-0">
            {actMutation.isPending ? (
              <div className="text-center py-16"><Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" /><p className="text-sm text-muted-foreground mt-3">Генерация...</p></div>
            ) : submitMutation.isPending ? (
              <div className="text-center py-16"><Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" /><p className="text-sm text-muted-foreground mt-3">Проверка...</p></div>
            ) : (
              <div className="animate-fade-in">
                {renderContent()}
              </div>
            )}

            {/* Post-submit actions */}
            {quizSubmitted && (
              <div className="flex gap-2 justify-center pt-4">
                <Button variant="outline" size="sm" onClick={() => { setQuizSubmitted(false); setSubmitFeedback(null); setSubmitScore(null); }}>
                  <RotateCcw className="h-4 w-4 mr-1" /> Попробовать снова
                </Button>
                <Button size="sm" onClick={() => { handleCheckin(); handleNextStep(); }}>
                  Далее <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}

            {/* ── Inline Check-in (triggered after submit) ── */}
            {showCheckinInPlayer && (
              <Card className="mt-4 border-primary/20 bg-primary/5">
                <CardContent className="pt-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-foreground">Сверка</h3>
                    <button onClick={() => setShowCheckinInPlayer(false)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">Ответьте, чтобы адаптировать следующие шаги.</p>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-foreground">Что сложно? (темы через запятую)</label>
                      <Input value={checkinAnswers.hardTopics} onChange={(e) => setCheckinAnswers((p) => ({ ...p, hardTopics: e.target.value }))}
                        placeholder="Например: дженерики" className="h-8 text-xs" />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-foreground">Темп?</label>
                      <div className="flex gap-1.5">
                        {["slower", "normal", "faster"].map((v) => (
                          <button key={v} onClick={() => setCheckinAnswers((p) => ({ ...p, pace: v }))}
                            className={cn("flex-1 p-2 rounded-lg border text-xs transition-all",
                              checkinAnswers.pace === v ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground")}>
                            {v === "slower" ? "Медленнее" : v === "normal" ? "Норм" : "Быстрее"}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-foreground">Чего добавить?</label>
                      <div className="flex flex-wrap gap-1.5">
                        {["Практика", "Примеры", "Тесты"].map((opt) => (
                          <button key={opt} onClick={() => setCheckinAnswers((p) => ({ ...p, addMore: p.addMore === opt ? "" : opt }))}
                            className={cn("px-3 py-1.5 rounded-full border text-xs transition-all",
                              checkinAnswers.addMore === opt ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground")}>
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <Button size="sm" className="w-full" onClick={handleCheckin}>
                    Обновить план <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── Side panel (30%) ── */}
          {showSidePanel && (
            <div className="border border-border rounded-lg p-4 bg-card/50 h-fit sticky top-4">
              {renderSidePanel()}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ─── FINISH ─── */
  if (phase === "finish") {
    return (
      <div className="space-y-6 max-w-xl mx-auto text-center py-8">
        <Award className="h-16 w-16 text-primary mx-auto" />
        <h2 className="text-xl font-bold text-foreground">Готово!</h2>
        <p className="text-sm text-muted-foreground">Вы прошли все шаги. Можете вернуться к результатам или начать заново.</p>

        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => setPhase("player")}>
            К результатам
          </Button>
          <Button onClick={() => {
            setPhase("intake");
            setIntakeStep(0);
            setIntake({ files: [], pastedText: "", goal: "", knowledgeLevel: "", depth: "", deadline: "", hoursPerWeek: "", preferences: [] });
            setProjectId(null);
            setActiveArtifact(null);
            setSidePanel(null);
            setQuizSubmitted(false);
            setSubmitFeedback(null);
            setSubmitScore(null);
            setCompletedSteps(0);
            setPipelineError(null);
            setShowCheckinInPlayer(false);
          }}>
            <RefreshCw className="h-4 w-4 mr-2" /> Новый проект
          </Button>
        </div>
      </div>
    );
  }

  /* ─── CHECK-IN (standalone fallback) ─── */
  if (phase === "checkin") {
    return (
      <div className="space-y-6 max-w-xl mx-auto">
        <h2 className="text-lg font-bold text-foreground">Сверка</h2>
        <p className="text-sm text-muted-foreground">Ответьте на вопросы, чтобы адаптировать следующие шаги.</p>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Где было трудно? (темы через запятую)</label>
            <Input value={checkinAnswers.hardTopics} onChange={(e) => setCheckinAnswers((p) => ({ ...p, hardTopics: e.target.value }))}
              placeholder="Например: дженерики, интерфейсы" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Темп?</label>
            <div className="flex gap-2">
              {["slower", "normal", "faster"].map((v) => (
                <button key={v} onClick={() => setCheckinAnswers((p) => ({ ...p, pace: v }))}
                  className={cn("flex-1 p-3 rounded-lg border text-sm transition-all",
                    checkinAnswers.pace === v ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground")}>
                  {v === "slower" ? "Медленнее" : v === "normal" ? "Норм" : "Быстрее"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Чего добавить?</label>
            <div className="flex flex-wrap gap-2">
              {["Практика", "Примеры", "Тесты"].map((opt) => (
                <button key={opt} onClick={() => setCheckinAnswers((p) => ({ ...p, addMore: p.addMore === opt ? "" : opt }))}
                  className={cn("px-4 py-2 rounded-full border text-sm transition-all",
                    checkinAnswers.addMore === opt ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground")}>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-between">
          <Button variant="ghost" size="sm" onClick={() => setPhase("player")}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Назад
          </Button>
          <Button onClick={() => { handleCheckin(); handleNextStep(); }}>
            Обновить и продолжить <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    );
  }

  return null;
};
