import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Upload, Brain, Loader2, CheckCircle2, BookOpen, HelpCircle,
  FileText, AlertCircle, ChevronRight, ChevronLeft, Send,
  Lightbulb, RotateCcw, X, FileSearch, Sparkles,
  GraduationCap, CreditCard, Presentation, Clock,
  ArrowRight, ChevronDown,
  RefreshCw, Award, Bug, Copy, AlertTriangle
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
type GuidedPhase = "intake" | "recommendation" | "generate" | "work" | "checkin" | "finish";
type OutputFormat = "COURSE_LEARN" | "EXAM_PREP" | "QUIZ_ONLY" | "FLASHCARDS" | "PRESENTATION";
type IntakeStep = 0 | 1 | 2 | 3 | 4 | 5;
type GenStatus = "idle" | "uploading" | "ingesting" | "planning" | "generating" | "done" | "error";

interface IntakeData {
  files: File[];
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
  { value: "EXAM_PREP", label: "Подготовка к экзамену", icon: GraduationCap, desc: "Диагностика + разбор ошибок + ремедиация" },
  { value: "QUIZ_ONLY", label: "Тесты", icon: HelpCircle, desc: "Банк вопросов + варианты + тренировка" },
  { value: "FLASHCARDS", label: "Карточки", icon: CreditCard, desc: "Карточки для запоминания + quiz me" },
  { value: "PRESENTATION", label: "Презентация", icon: Presentation, desc: "Слайды + заметки + Q&A репетиция" },
];

const GOAL_OPTIONS = [
  { value: "self_learn", label: "Учусь для себя" },
  { value: "exam_prep", label: "Готовлюсь к экзамену/собеседованию" },
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
  return "COURSE_LEARN";
}

function formatToActionType(format: OutputFormat): string {
  switch (format) {
    case "COURSE_LEARN": return "generate_lesson_blocks";
    case "EXAM_PREP": return "generate_quiz";
    case "QUIZ_ONLY": return "generate_quiz";
    case "FLASHCARDS": return "generate_flashcards";
    case "PRESENTATION": return "generate_slides";
  }
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
      detail = `Запрос не получил ответ (возможно: CORS, сеть или слишком большой payload ~${Math.round(payloadSize / 1024)}KB).\n\nОткрой DevTools → Network/Console для деталей.\n\nURL: ${url}\nPayload size: ~${Math.round(payloadSize / 1024)}KB\n\nОригинальная ошибка: ${detail}`;
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

/* ═══════════════ AI Actions menu (localized + context-dependent) ═══════════════ */
function getAssistantActions(format: OutputFormat, artifactKind: string | null, submitted: boolean, hasSelection: boolean): { id: string; label: string; action: string }[] {
  const items: { id: string; label: string; action: string }[] = [];

  // Sources always available
  items.push({ id: "sources", label: "📄 Показать источники", action: "show_sources" });

  if (format === "COURSE_LEARN" || artifactKind === "course" || artifactKind === "lesson_blocks") {
    if (hasSelection) {
      items.unshift({ id: "explain", label: "💡 Объяснить термин", action: "explain_term" });
      items.unshift({ id: "expand", label: "📖 Расширить выделенное", action: "expand_selection" });
      items.unshift({ id: "example", label: "📝 Пример", action: "give_example" });
    } else {
      items.unshift({ id: "flashcards", label: "🃏 Сделать карточки", action: "generate_flashcards" });
      items.unshift({ id: "quiz", label: "✅ Мини-квиз", action: "generate_quiz" });
    }
  }

  if (format === "EXAM_PREP" || format === "QUIZ_ONLY" || artifactKind === "quiz") {
    if (!submitted) {
      items.unshift({ id: "hint", label: "💡 Подсказка", action: "give_hint" });
    } else {
      items.unshift({ id: "remediate", label: "📚 Доп. практика", action: "remediate_topic" });
      items.unshift({ id: "explain_err", label: "🔍 Разобрать ошибку", action: "explain_mistake" });
    }
  }

  if (format === "FLASHCARDS" || artifactKind === "flashcards") {
    items.unshift({ id: "quiz_me", label: "✅ Мини-квиз", action: "generate_quiz" });
    items.unshift({ id: "add_cards", label: "➕ Добавить карточек", action: "generate_flashcards" });
    if (hasSelection) {
      items.unshift({ id: "explain_fc", label: "💡 Объяснить термин", action: "explain_term" });
    }
  }

  if (format === "PRESENTATION" || artifactKind === "slides") {
    items.unshift({ id: "qa", label: "🎤 Q&A репетиция", action: "generate_quiz" });
    items.unshift({ id: "improve_notes", label: "📝 Улучшить заметки", action: "expand_selection" });
    items.unshift({ id: "strengthen", label: "💪 Усилить структуру", action: "generate_slides" });
  }

  return items;
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

  // State machine
  const [phase, setPhase] = useState<GuidedPhase>("intake");
  const [intakeStep, setIntakeStep] = useState<IntakeStep>(0);
  const [intake, setIntake] = useState<IntakeData>({
    files: [], goal: "", knowledgeLevel: "", depth: "", deadline: "", hoursPerWeek: "", preferences: [],
  });

  // Recommendation
  const [selectedFormat, setSelectedFormat] = useState<OutputFormat>("COURSE_LEARN");
  const [recommendedFormat, setRecommendedFormat] = useState<OutputFormat>("COURSE_LEARN");

  // Generate
  const [genStatus, setGenStatus] = useState<GenStatus>("idle");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [pipelineError, setPipelineError] = useState<EdgeError | null>(null);

  // Work
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null);
  const [sidePanel, setSidePanel] = useState<any>(null);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState<any>(null);
  const [submitScore, setSubmitScore] = useState<number | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const [completedSteps, setCompletedSteps] = useState(0);

  // Checkin
  const [checkinAnswers, setCheckinAnswers] = useState({ hardTopics: "", pace: "normal", addMore: "" });

  // Resume from MyGuides
  useEffect(() => {
    if (resumeProjectId && resumeProjectId !== projectId) {
      setProjectId(resumeProjectId);
      setPhase("work");
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

  // Auto-set active artifact when resuming
  useEffect(() => {
    if (artifacts.length > 0 && !activeArtifact && (phase === "work" || (phase === "generate" && genStatus === "done"))) {
      setActiveArtifact(artifacts[artifacts.length - 1]);
    }
  }, [artifacts, activeArtifact, phase, genStatus]);

  const roadmap = (project?.roadmap as any[]) || [];

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
        // This is an inline action result (assistant_note)
        setSidePanel({ type: "result", payload: data.public_payload, source_refs: data.source_refs });
      }
      toast.success("Готово");
    },
    onError: (e: any) => {
      if (e.functionName) {
        setSidePanel({ type: "error", error: e as EdgeError });
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
    },
    onError: (e: any) => {
      if (e.functionName) {
        setSidePanel({ type: "error", error: e as EdgeError });
      } else {
        toast.error(`Ошибка: ${e.message || e}`);
      }
    },
  });

  /* ─── Text selection tracking ─── */
  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection()?.toString().trim();
    setHasSelection(!!(sel && sel.length > 2 && sel.length < 100));
  }, []);

  /* ─── Generate pipeline ─── */
  const runPipeline = async (projId: string, sources: { source_id: string; storage_path: string; file_name: string; mime: string }[], format: OutputFormat) => {
    setPipelineError(null);

    try {
      // Ingest via storage references (no large text in payload)
      setGenStatus("ingesting");
      await callEdge("project_ingest", { project_id: projId, sources });

      // Plan
      setGenStatus("planning");
      await callEdge("project_plan", { project_id: projId });

      // Generate first artifact
      setGenStatus("generating");
      const actionType = formatToActionType(format);
      const actData = await callEdge("artifact_act", {
        project_id: projId, action_type: actionType, context: `Format: ${format}`,
      });

      // Load artifact
      queryClient.invalidateQueries({ queryKey: ["guided-project", projId] });
      queryClient.invalidateQueries({ queryKey: ["guided-artifacts", projId] });
      queryClient.invalidateQueries({ queryKey: ["my-guided-projects"] });

      if (actData?.artifact_id) {
        const { data: art } = await supabase.from("artifacts").select("*").eq("id", actData.artifact_id).single();
        if (art) setActiveArtifact(art as Artifact);
      }

      setGenStatus("done");
      setPhase("work");
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

  const handleGenerate = async () => {
    if (!user) return;
    setPhase("generate");
    setGenStatus("uploading");
    setPipelineError(null);

    try {
      // Create project
      const { data: proj, error: projErr } = await supabase.from("projects").insert({
        user_id: user.id,
        title: intake.files[0]?.name?.replace(/\.\w+$/, "") || `Проект ${new Date().toLocaleDateString("ru-RU")}`,
        goal: intake.goal,
        audience: intake.knowledgeLevel,
        description: `depth=${intake.depth}, prefs=${intake.preferences.join(",")}`,
        status: "draft",
      }).select().single();
      if (projErr) throw { functionName: "create_project", status: 0, body: projErr.message };
      setProjectId(proj.id);

      // Extract text on client, upload as .txt to Storage, collect source refs
      const sources: { source_id: string; storage_path: string; file_name: string; mime: string }[] = [];

      for (const file of intake.files) {
        try {
          const text = await extractText(file);
          if (!text.trim()) continue;

          // Upload extracted text as .txt (small payload to Storage)
          const txtBlob = new Blob([text], { type: "text/plain" });
          const baseName = file.name.replace(/\.\w+$/, "");
          const storagePath = `${user.id}/${proj.id}/extracted/${baseName}.txt`;
          const { error: uploadErr } = await supabase.storage
            .from("ai_sources")
            .upload(storagePath, txtBlob, { upsert: true, contentType: "text/plain" });

          if (uploadErr) {
            console.warn(`Upload failed ${file.name}:`, uploadErr);
            continue;
          }

          sources.push({
            source_id: proj.id,
            storage_path: storagePath,
            file_name: file.name,
            mime: file.type || "text/plain",
          });

          // Also upload original file for reference
          const rawPath = `${user.id}/${proj.id}/raw/${file.name}`;
          await supabase.storage.from("ai_sources").upload(rawPath, file, { upsert: true });
        } catch (e) {
          console.warn(`Extraction failed ${file.name}:`, e);
        }
      }

      if (!sources.length) {
        throw { functionName: "extractText", status: 0, body: "Не удалось извлечь текст ни из одного файла" } as EdgeError;
      }

      await runPipeline(proj.id, sources, selectedFormat);
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

  /* ─── Retry pipeline from last failed step ─── */
  const handleRetryPipeline = () => {
    if (!projectId) return;
    // Re-run from the step that failed
    setPipelineError(null);
    setGenStatus("idle");
    // Simple: restart from ingest with empty documents triggers re-plan
    // In practice we'd need to know which step failed. For now re-do plan+generate.
    setPhase("generate");
    (async () => {
      try {
        setGenStatus("planning");
        await callEdge("project_plan", { project_id: projectId });
        setGenStatus("generating");
        const actData = await callEdge("artifact_act", {
          project_id: projectId, action_type: formatToActionType(selectedFormat),
          context: `Format: ${selectedFormat}`,
        });
        queryClient.invalidateQueries({ queryKey: ["guided-project", projectId] });
        queryClient.invalidateQueries({ queryKey: ["guided-artifacts", projectId] });
        queryClient.invalidateQueries({ queryKey: ["my-guided-projects"] });
        if (actData?.artifact_id) {
          const { data: art } = await supabase.from("artifacts").select("*").eq("id", actData.artifact_id).single();
          if (art) setActiveArtifact(art as Artifact);
        }
        setGenStatus("done");
        setPhase("work");
        toast.success("Гайд создан!");
      } catch (e: any) {
        setGenStatus("error");
        setPipelineError(e.functionName ? e : { functionName: "unknown", status: 0, body: e.message || String(e) });
      }
    })();
  };

  /* ─── Demo project ─── */
  const handleDemo = async () => {
    if (!user) return;
    setIntake({ files: [], goal: "self_learn", knowledgeLevel: "basic", depth: "normal", deadline: "", hoursPerWeek: "", preferences: ["examples"] });
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

      // Upload demo text to storage and pass as sources
      const txtBlob = new Blob([demoText], { type: "text/plain" });
      const storagePath = `${user.id}/${proj.id}/extracted/typescript.txt`;
      await supabase.storage.from("ai_sources").upload(storagePath, txtBlob, { upsert: true, contentType: "text/plain" });

      await runPipeline(proj.id, [{ source_id: proj.id, storage_path: storagePath, file_name: "typescript.md", mime: "text/plain" }], "COURSE_LEARN");
    } catch (e: any) {
      setGenStatus("error");
      setPipelineError(e.functionName ? e : { functionName: "unknown", status: 0, body: e.message || String(e) });
    }
  };

  /* ─── Assistant action handler ─── */
  const handleAssistantAction = (action: string) => {
    if (action === "show_sources") {
      setSidePanel({ type: "sources", refs: activeArtifact?.public_json?.source_refs || [] });
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
      await callEdge("project_checkin", {
        project_id: projectId,
        answers: {
          hard_topics: checkinAnswers.hardTopics.split(",").map((s) => s.trim()).filter(Boolean),
          pace: checkinAnswers.pace, add_more: checkinAnswers.addMore,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["guided-project", projectId] });
      setPhase("work");
      setCompletedSteps((c) => c + 1);
      toast.success("Roadmap обновлён");
    } catch (e: any) {
      if (e.functionName) {
        toast.error(`Ошибка ${e.functionName}: ${e.body}`);
      } else {
        toast.error(e.message || "Ошибка");
      }
    }
  };

  /* ─── Next step from roadmap ─── */
  const handleNextStep = () => {
    const nextStep = roadmap.find((s: any) => s.status === "available");
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

  /* ═══════════════ RENDER ═══════════════ */

  /* ─── INTAKE ─── */
  if (phase === "intake") {
    const canProceed = (() => {
      if (intakeStep === 0) return intake.files.length > 0;
      if (intakeStep === 1) return !!intake.goal;
      if (intakeStep === 2) return !!intake.knowledgeLevel;
      if (intakeStep === 3) return !!intake.depth;
      return true;
    })();

    const stepTitles = ["Загрузка файлов", "Цель", "Уровень знаний", "Глубина", "Ограничения", "Предпочтения"];

    return (
      <div className="space-y-6 max-w-xl mx-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Новый проект</h2>
          <Button variant="ghost" size="sm" onClick={handleDemo}><Bug className="h-4 w-4 mr-1" /> Demo</Button>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{stepTitles[intakeStep]}</span>
            <span>{intakeStep + 1}/6</span>
          </div>
          <Progress value={((intakeStep + 1) / 6) * 100} className="h-1.5" />
        </div>

        {/* Step 0: Upload */}
        {intakeStep === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Загрузите материалы для обучения (PDF, DOCX, TXT, MD). Без файлов продолжить нельзя.</p>
            <div onClick={() => fileInputRef.current?.click()}
              className="rounded-xl border-2 border-dashed border-border bg-card p-8 text-center cursor-pointer hover:border-primary/40 transition-all">
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
          </div>
        )}

        {/* Step 1: Goal */}
        {intakeStep === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Зачем вам этот материал?</p>
            {GOAL_OPTIONS.map((opt) => (
              <button key={opt.value} onClick={() => setIntake((p) => ({ ...p, goal: opt.value }))}
                className={cn("w-full text-left p-4 rounded-lg border transition-all text-sm",
                  intake.goal === opt.value ? "border-primary bg-primary/10 text-foreground" : "border-border hover:border-primary/30 text-muted-foreground")}>
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Knowledge level */}
        {intakeStep === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Ваш текущий уровень знаний по теме?</p>
            {KNOWLEDGE_LEVELS.map((opt) => (
              <button key={opt.value} onClick={() => setIntake((p) => ({ ...p, knowledgeLevel: opt.value }))}
                className={cn("w-full text-left p-4 rounded-lg border transition-all",
                  intake.knowledgeLevel === opt.value ? "border-primary bg-primary/10" : "border-border hover:border-primary/30")}>
                <span className="text-sm font-medium text-foreground">{opt.label}</span>
                <p className="text-xs text-muted-foreground">{opt.desc}</p>
              </button>
            ))}
          </div>
        )}

        {/* Step 3: Depth */}
        {intakeStep === 3 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Насколько глубоко изучать?</p>
            <div className="flex gap-2">
              {DEPTH_OPTIONS.map((opt) => (
                <button key={opt.value} onClick={() => setIntake((p) => ({ ...p, depth: opt.value }))}
                  className={cn("flex-1 p-4 rounded-lg border text-center transition-all text-sm",
                    intake.depth === opt.value ? "border-primary bg-primary/10 text-foreground" : "border-border hover:border-primary/30 text-muted-foreground")}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Constraints */}
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

        {/* Step 5: Preferences */}
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

        {/* Navigation */}
        <div className="flex justify-between pt-2">
          <Button variant="ghost" size="sm" onClick={() => intakeStep > 0 ? setIntakeStep((s) => (s - 1) as IntakeStep) : null} disabled={intakeStep === 0}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Назад
          </Button>
          {intakeStep < 5 ? (
            <Button size="sm" disabled={!canProceed} onClick={() => setIntakeStep((s) => (s + 1) as IntakeStep)}>
              Далее <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button size="sm" onClick={() => {
              const rec = recommendFormat(intake);
              setRecommendedFormat(rec);
              setSelectedFormat(rec);
              setPhase("recommendation");
            }}>
              Готово <ArrowRight className="h-4 w-4 ml-1" />
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
          <CardContent className="pt-5 space-y-3">
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
              На основе вашей цели «{GOAL_OPTIONS.find((g) => g.value === intake.goal)?.label}» и уровня «{KNOWLEDGE_LEVELS.find((k) => k.value === intake.knowledgeLevel)?.label}» мы рекомендуем этот формат.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Или выберите другой формат:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {OUTPUT_FORMATS.map((f) => {
              const Icon = f.icon;
              return (
                <button key={f.value} onClick={() => setSelectedFormat(f.value)}
                  className={cn("flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
                    selectedFormat === f.value ? "border-primary bg-primary/10" : "border-border hover:border-primary/30")}>
                  <Icon className={cn("h-5 w-5 shrink-0", selectedFormat === f.value ? "text-primary" : "text-muted-foreground")} />
                  <div>
                    <p className="text-sm font-medium text-foreground">{f.label}</p>
                    <p className="text-xs text-muted-foreground">{f.desc}</p>
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

  /* ─── GENERATE + WORK (unified) ─── */
  if (phase === "generate" || phase === "work") {
    const isGenerating = phase === "generate" && genStatus !== "done" && genStatus !== "error";
    const isError = genStatus === "error";
    const genSteps = [
      { key: "uploading", label: "Загрузка", icon: Upload },
      { key: "ingesting", label: "Извлечение", icon: FileText },
      { key: "planning", label: "Учебный план", icon: Brain },
      { key: "generating", label: "Генерация", icon: Sparkles },
    ];
    const currentGenIdx = genSteps.findIndex((s) => s.key === genStatus);
    const genProgressVal = genStatus === "done" ? 100 : genStatus === "error" ? 0 : ((currentGenIdx + 1) / genSteps.length) * 90;

    // Error screen with detailed info
    if (isError && pipelineError && phase === "generate") {
      return (
        <div className="space-y-6 max-w-xl mx-auto py-8">
          <EdgeErrorCard error={pipelineError} onRetry={handleRetryPipeline} />
          <Button variant="ghost" size="sm" onClick={() => { setPhase("recommendation"); setGenStatus("idle"); setPipelineError(null); }}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Назад к настройкам
          </Button>
        </div>
      );
    }

    const pub = activeArtifact?.public_json as any;
    const artifactKind = pub?.kind || activeArtifact?.type || null;
    const menuItems = getAssistantActions(selectedFormat, artifactKind, quizSubmitted, hasSelection);

    const renderPlayer = () => {
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

      // Assistant note (from inline actions)
      if (artifactKind === "assistant_note") {
        return <AssistantNoteCard payload={pub} />;
      }

      // Method pack (legacy — render blocks)
      if (artifactKind === "method_pack" && pub.blocks) {
        return (
          <div className="space-y-3">
            {pub.blocks.map((block: any) => (
              <BlockRenderer key={block.id} block={block} onTermClick={handleTermClick} />
            ))}
          </div>
        );
      }

      // Unknown payload — NO raw JSON, show error card
      return <UnknownPayloadCard kind={artifactKind || "unknown"} payload={pub} />;
    };

    /* ─── Side panel renderer ─── */
    const renderSidePanel = () => {
      if (!sidePanel) return null;

      return (
        <div className="space-y-3 p-4 rounded-lg border border-border bg-card animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              {sidePanel.type === "loading" ? "Загрузка..." :
               sidePanel.type === "sources" ? "Источники" :
               sidePanel.type === "error" ? "Ошибка" : "Результат"}
            </h3>
            <button onClick={() => setSidePanel(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
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
            // assistant_note
            if (p.kind === "assistant_note") {
              return <AssistantNoteCard payload={p} sourceRefs={sidePanel.source_refs} />;
            }
            // method_pack blocks (legacy conversion)
            if (p.kind === "method_pack" && p.blocks) {
              return (
                <div className="space-y-2">
                  {p.blocks.map((b: any) => <BlockRenderer key={b.id} block={b} />)}
                </div>
              );
            }
            // Quiz inline
            if (p.kind === "quiz" && p.questions) {
              return <p className="text-sm text-muted-foreground">Квиз создан — переключено на основной контент</p>;
            }
            // Flashcards inline
            if (p.kind === "flashcards" && p.cards) {
              return <p className="text-sm text-muted-foreground">Карточки созданы — переключено на основной контент</p>;
            }
            // Fallback: no raw JSON, use error card
            return <UnknownPayloadCard kind={p.kind || "unknown"} payload={p} />;
          })()}

          {sidePanel.source_refs?.length > 0 && sidePanel.payload?.kind !== "assistant_note" && (
            <div className="pt-2 border-t border-border">
              <p className="text-[10px] text-muted-foreground flex items-center gap-1"><FileSearch className="h-3 w-3" /> {sidePanel.source_refs.length} источников</p>
            </div>
          )}
        </div>
      );
    };

    return (
      <div className="space-y-4" onMouseUp={handleMouseUp}>
        {/* Generation progress banner */}
        {isGenerating && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 animate-fade-in">
            <div className="flex items-center gap-3 mb-3">
              <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />
              <span className="text-sm font-medium text-foreground">Создаём ваш гайд…</span>
            </div>
            <Progress value={genProgressVal} className="h-1.5 mb-3" />
            <div className="flex items-center gap-4">
              {genSteps.map((s, i) => {
                const Icon = s.icon;
                const isDone = currentGenIdx > i;
                const isCurrent = currentGenIdx === i;
                return (
                  <div key={s.key} className={cn("flex items-center gap-1.5 text-xs transition-colors",
                    isDone ? "text-accent" : isCurrent ? "text-foreground" : "text-muted-foreground/40")}>
                    {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : isCurrent ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
                    {s.label}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Badge variant="outline" className="shrink-0">{OUTPUT_FORMATS.find((f) => f.value === selectedFormat)?.label}</Badge>
            <h2 className="text-base font-bold text-foreground truncate">{activeArtifact?.title || "Рабочее пространство"}</h2>
          </div>
          <div className="flex items-center gap-2">
            {/* AI Actions dropdown — localized */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={actMutation.isPending || isGenerating}>
                  {actMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lightbulb className="h-4 w-4" />}
                  <span className="ml-1.5 hidden sm:inline">Действия AI</span>
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {menuItems.map((item) => (
                  <DropdownMenuItem key={item.id} onClick={() => handleAssistantAction(item.action)}>
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Next step / checkin */}
            <Button size="sm" variant="default" onClick={() => setPhase("checkin")} disabled={actMutation.isPending || isGenerating}>
              Следующий шаг <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>

        {/* Roadmap mini-bar */}
        {roadmap.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {roadmap.map((step: any) => (
              <div key={step.id} title={step.title}
                className={cn("h-2 flex-1 rounded-full min-w-[20px] transition-all",
                  step.status === "completed" ? "bg-accent" :
                  step.status === "available" ? "bg-primary" :
                  step.status === "in_progress" ? "bg-primary/50" : "bg-muted")} />
            ))}
          </div>
        )}

        {/* Content area */}
        <div className={cn("grid gap-4", sidePanel ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1")}>
          <div className={cn(sidePanel ? "lg:col-span-2" : "")}>
            {isGenerating ? (
              <div className="text-center py-16 space-y-4 animate-fade-in">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                  <Sparkles className="h-8 w-8 text-primary animate-pulse" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Готовим ваш гайд</p>
                  <p className="text-xs text-muted-foreground mt-1">Контент появится здесь автоматически</p>
                </div>
              </div>
            ) : actMutation.isPending ? (
              <div className="text-center py-16"><Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" /><p className="text-sm text-muted-foreground mt-3">Генерация...</p></div>
            ) : submitMutation.isPending ? (
              <div className="text-center py-16"><Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" /><p className="text-sm text-muted-foreground mt-3">Проверка...</p></div>
            ) : (
              <div className={cn(!isGenerating && activeArtifact && "animate-fade-in")}>
                {renderPlayer()}
              </div>
            )}
          </div>

          {/* Side panel */}
          {sidePanel && renderSidePanel()}
        </div>

        {/* Submitted quiz: retry + checkin */}
        {quizSubmitted && (
          <div className="flex gap-2 justify-center pt-2">
            <Button variant="outline" size="sm" onClick={() => { setQuizSubmitted(false); setSubmitFeedback(null); setSubmitScore(null); }}>
              <RotateCcw className="h-4 w-4 mr-1" /> Попробовать снова
            </Button>
            <Button size="sm" onClick={() => setPhase("checkin")}>
              Далее <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    );
  }

  /* ─── CHECK-IN ─── */
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
          <Button variant="ghost" size="sm" onClick={() => setPhase("work")}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Назад
          </Button>
          <Button onClick={() => { handleCheckin(); handleNextStep(); }}>
            Обновить и продолжить <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
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
          <Button variant="outline" onClick={() => setPhase("work")}>
            К результатам
          </Button>
          <Button onClick={() => {
            setPhase("intake");
            setIntakeStep(0);
            setIntake({ files: [], goal: "", knowledgeLevel: "", depth: "", deadline: "", hoursPerWeek: "", preferences: [] });
            setProjectId(null);
            setActiveArtifact(null);
            setSidePanel(null);
            setQuizSubmitted(false);
            setSubmitFeedback(null);
            setSubmitScore(null);
            setCompletedSteps(0);
            setPipelineError(null);
          }}>
            <RefreshCw className="h-4 w-4 mr-2" /> Новый проект
          </Button>
        </div>
      </div>
    );
  }

  return null;
};
