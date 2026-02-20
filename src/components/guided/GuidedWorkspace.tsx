import { useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Upload, Brain, Loader2, CheckCircle2, BookOpen, HelpCircle,
  FileText, AlertCircle, ChevronRight, Map, Play, Send,
  MessageSquare, Lightbulb, Layers, RotateCcw, Bug, X, FileSearch
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/* ═══════════════ Types ═══════════════ */
interface GuidedProject {
  id: string;
  title: string;
  description: string | null;
  status: string;
  roadmap: any[];
  assistant_menu_policy: any;
  created_at: string;
}

interface Artifact {
  id: string;
  title: string;
  type: string;
  public_json: any;
  status: string;
  roadmap_step_id: string | null;
}

type GuidedView = "list" | "wizard" | "dashboard" | "player";

/* ═══════════════ File extraction utils ═══════════════ */
async function extractText(file: File): Promise<string> {
  const ext = file.name.toLowerCase().split(".").pop();
  if (ext === "txt" || ext === "md") {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsText(file);
    });
  }
  if (ext === "pdf") {
    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
      const arrayBuf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuf }).promise;
      const pages: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const tc = await page.getTextContent();
        pages.push(tc.items.map((it: any) => it.str).join(" "));
      }
      return pages.join("\n\n");
    } catch (e) {
      console.warn("PDF.js extraction failed, falling back to text:", e);
      return new Promise((resolve, reject) => {
        const r = new FileReader(); r.onload = () => resolve(r.result as string); r.onerror = reject; r.readAsText(file);
      });
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
      return new Promise((resolve, reject) => {
        const r = new FileReader(); r.onload = () => resolve(r.result as string); r.onerror = reject; r.readAsText(file);
      });
    }
  }
  // Fallback
  return new Promise((resolve, reject) => {
    const r = new FileReader(); r.onload = () => resolve(r.result as string); r.onerror = reject; r.readAsText(file);
  });
}

/* ═══════════════ COMPONENT REGISTRY RENDERERS ═══════════════ */
const BlockRenderer = ({ block, onTermClick }: { block: any; onTermClick?: (term: string) => void }) => {
  const handleTextSelect = () => {
    const selection = window.getSelection()?.toString().trim();
    if (selection && selection.length > 2 && selection.length < 100 && onTermClick) {
      onTermClick(selection);
    }
  };

  if (!block) return null;

  // Text block
  if (block.type === "text" || block.type === "explanation" || block.type === "expansion" || block.type === "example" || block.type === "feedback") {
    return (
      <div className="p-4 rounded-lg border border-border bg-card space-y-2" onMouseUp={handleTextSelect}>
        <h4 className="font-semibold text-sm text-foreground">{block.title}</h4>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{block.content}</p>
      </div>
    );
  }

  // Lesson
  if (block.content && block.title) {
    return (
      <div className="p-4 rounded-lg border border-border bg-card space-y-2" onMouseUp={handleTextSelect}>
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-sm text-foreground">{block.title}</h4>
        </div>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{block.content}</p>
      </div>
    );
  }

  return <div className="p-3 rounded-lg border border-border bg-muted/20 text-xs text-muted-foreground">Неизвестный блок</div>;
};

const QuizPlayer = ({ questions, onSubmit }: { questions: any[]; onSubmit: (answers: { block_id: string; value: string | string[] }[]) => void }) => {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});

  const handleSelect = (qId: string, optId: string, isMulti: boolean) => {
    setAnswers((prev) => {
      if (isMulti) {
        const current = (prev[qId] as string[]) || [];
        return { ...prev, [qId]: current.includes(optId) ? current.filter((x) => x !== optId) : [...current, optId] };
      }
      return { ...prev, [qId]: optId };
    });
  };

  const handleSubmit = () => {
    const result = questions.map((q) => ({ block_id: q.id, value: answers[q.id] || "" }));
    onSubmit(result);
  };

  return (
    <div className="space-y-4">
      {questions.map((q, qi) => (
        <div key={q.id} className="p-4 rounded-lg border border-border bg-card space-y-3">
          <p className="text-sm font-medium text-foreground">{qi + 1}. {q.text}</p>
          <div className="space-y-2">
            {(q.options || []).map((opt: any) => {
              const isMulti = q.type === "multiple_choice";
              const isSelected = isMulti ? ((answers[q.id] as string[]) || []).includes(opt.id) : answers[q.id] === opt.id;
              return (
                <button key={opt.id} onClick={() => handleSelect(q.id, opt.id, isMulti)}
                  className={cn("w-full text-left p-3 rounded-lg border transition-all text-sm",
                    isSelected ? "border-primary bg-primary/10 text-foreground" : "border-border hover:border-primary/30 text-muted-foreground")}>
                  {opt.text}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <Button onClick={handleSubmit} className="w-full"><Send className="h-4 w-4 mr-2" /> Отправить ответы</Button>
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
      <div onClick={() => setFlipped(!flipped)} className="cursor-pointer p-8 rounded-xl border-2 border-border bg-card text-center min-h-[200px] flex items-center justify-center transition-all hover:border-primary/30">
        <div>
          <p className="text-lg font-medium text-foreground">{flipped ? card.back : card.front}</p>
          {!flipped && card.hint && <p className="text-xs text-muted-foreground mt-2">Подсказка: {card.hint}</p>}
          <p className="text-xs text-muted-foreground mt-4">{flipped ? "Нажмите, чтобы увидеть вопрос" : "Нажмите, чтобы увидеть ответ"}</p>
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

const FeedbackPanel = ({ feedback, score }: { feedback: any; score: number | null }) => {
  if (!feedback) return null;
  const passed = feedback.passed;
  return (
    <div className={cn("p-4 rounded-lg border space-y-3", passed ? "border-accent/30 bg-accent/5" : "border-destructive/30 bg-destructive/5")}>
      <div className="flex items-center gap-2">
        {passed ? <CheckCircle2 className="h-5 w-5 text-accent" /> : <AlertCircle className="h-5 w-5 text-destructive" />}
        <span className="font-semibold text-sm text-foreground">{passed ? "Тест пройден!" : "Попробуйте ещё раз"}</span>
        {score !== null && <Badge variant={passed ? "default" : "secondary"}>{score}%</Badge>}
      </div>
      {feedback.questions && (
        <div className="space-y-1">
          {Object.entries(feedback.questions as Record<string, { correct: boolean; earned: number; max: number }>).map(([qId, qf]) => (
            <div key={qId} className="flex items-center gap-2 text-xs">
              {qf.correct ? <CheckCircle2 className="h-3 w-3 text-accent" /> : <X className="h-3 w-3 text-destructive" />}
              <span className="text-muted-foreground">{qId}: {qf.earned}/{qf.max}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ═══════════════ MAIN ═══════════════ */
export const GuidedWorkspace = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [view, setView] = useState<GuidedView>("list");
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null);
  const [sidePanel, setSidePanel] = useState<any>(null);
  const [submitFeedback, setSubmitFeedback] = useState<any>(null);
  const [submitScore, setSubmitScore] = useState<number | null>(null);

  // Wizard state
  const [wizardTitle, setWizardTitle] = useState("");
  const [wizardFiles, setWizardFiles] = useState<File[]>([]);
  const [wizardLoading, setWizardLoading] = useState(false);
  const [wizardStep, setWizardStep] = useState<"upload" | "processing">("upload");

  /* ─── Queries ─── */
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["guided-projects", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from("projects").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data as GuidedProject[];
    },
    enabled: !!user,
  });

  const activeProject = projects.find((p) => p.id === activeProjectId) || null;

  const { data: artifacts = [] } = useQuery({
    queryKey: ["guided-artifacts", activeProjectId],
    queryFn: async () => {
      if (!activeProjectId) return [];
      const { data, error } = await supabase.from("artifacts").select("*").eq("project_id", activeProjectId).order("sort_order", { ascending: true });
      if (error) throw error;
      return data as Artifact[];
    },
    enabled: !!activeProjectId,
  });

  /* ─── Mutations ─── */
  const actMutation = useMutation({
    mutationFn: async (params: { action_type: string; target?: any; context?: string }) => {
      const { data, error } = await supabase.functions.invoke("artifact_act", {
        body: { project_id: activeProjectId, ...params },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["guided-artifacts"] });
      if (data.artifact_id) {
        // Load the new artifact
        supabase.from("artifacts").select("*").eq("id", data.artifact_id).single().then(({ data: art }) => {
          if (art) setActiveArtifact(art as Artifact);
        });
      }
      toast.success("Контент сгенерирован");
    },
    onError: (e) => { toast.error(`Ошибка: ${e.message}`); },
  });

  const submitMutation = useMutation({
    mutationFn: async (params: { artifact_id: string; answers: any[] }) => {
      const { data, error } = await supabase.functions.invoke("artifact_submit", { body: params });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setSubmitFeedback(data.feedback);
      setSubmitScore(data.score);
      toast.success("Ответы проверены!");
    },
    onError: (e) => { toast.error(`Ошибка: ${e.message}`); },
  });

  /* ─── Wizard ─── */
  const handleWizardCreate = async () => {
    if (!user || !wizardFiles.length) return;
    setWizardLoading(true);
    setWizardStep("processing");

    try {
      // 1. Create project
      const { data: project, error: projErr } = await supabase.from("projects").insert({
        user_id: user.id,
        title: wizardTitle || `Проект ${new Date().toLocaleDateString("ru-RU")}`,
        status: "draft",
      }).select().single();
      if (projErr) throw projErr;

      // 2. Extract text from files
      const documents: { text: string; file_name: string }[] = [];
      for (const file of wizardFiles) {
        try {
          const text = await extractText(file);
          documents.push({ text, file_name: file.name });

          // Upload to storage
          const storagePath = `${user.id}/${project.id}/raw/${file.name}`;
          await supabase.storage.from("ai_sources").upload(storagePath, file, { upsert: true });
        } catch (e) {
          console.warn(`Failed to extract ${file.name}:`, e);
        }
      }

      if (!documents.length || !documents.some((d) => d.text.trim())) {
        toast.error("Не удалось извлечь текст из файлов");
        setWizardLoading(false);
        setWizardStep("upload");
        return;
      }

      // 3. Ingest
      toast.info("Индексация текста...");
      const { error: ingestErr } = await supabase.functions.invoke("project_ingest", {
        body: { project_id: project.id, documents },
      });
      if (ingestErr) throw ingestErr;

      // 4. Plan
      toast.info("Создание учебного плана...");
      const { error: planErr } = await supabase.functions.invoke("project_plan", {
        body: { project_id: project.id },
      });
      if (planErr) throw planErr;

      queryClient.invalidateQueries({ queryKey: ["guided-projects"] });
      setActiveProjectId(project.id);
      setView("dashboard");
      setWizardTitle("");
      setWizardFiles([]);
      toast.success("Проект создан!");
    } catch (e) {
      console.error("Wizard error:", e);
      toast.error("Ошибка создания проекта");
    } finally {
      setWizardLoading(false);
      setWizardStep("upload");
    }
  };

  /* ─── Demo project ─── */
  const createDemoProject = async () => {
    if (!user) return;
    setWizardLoading(true);
    try {
      // Create project
      const { data: project, error } = await supabase.from("projects").insert({
        user_id: user.id,
        title: "Demo: Основы TypeScript",
        description: "Демонстрационный проект",
        status: "draft",
      }).select().single();
      if (error) throw error;

      // Ingest demo content
      const demoText = `
TypeScript — это язык программирования, разработанный Microsoft. Он является надмножеством JavaScript и добавляет статическую типизацию.

Основные типы в TypeScript:
- string — строки
- number — числа
- boolean — логические значения
- any — любой тип
- void — отсутствие значения
- null и undefined
- never — тип, который никогда не возникает

Интерфейсы позволяют описывать структуру объектов:
interface User {
  name: string;
  age: number;
  email?: string;
}

Дженерики обеспечивают переиспользование кода с разными типами:
function identity<T>(arg: T): T {
  return arg;
}

Enum (перечисления) — способ определения именованных констант:
enum Direction {
  Up, Down, Left, Right
}

Типы Union и Intersection:
type StringOrNumber = string | number;
type NamedAndAged = Named & Aged;

Декораторы — специальные функции для аннотирования классов и их членов.
Модули позволяют организовать код в отдельные файлы.
Namespaces — способ группировки связанного кода.
      `.trim();

      await supabase.functions.invoke("project_ingest", {
        body: { project_id: project.id, documents: [{ text: demoText, file_name: "typescript-basics.md" }] },
      });

      toast.info("Создание плана...");
      await supabase.functions.invoke("project_plan", { body: { project_id: project.id } });

      queryClient.invalidateQueries({ queryKey: ["guided-projects"] });
      setActiveProjectId(project.id);
      setView("dashboard");
      toast.success("Demo проект создан!");
    } catch (e) {
      console.error(e);
      toast.error("Ошибка создания demo");
    } finally {
      setWizardLoading(false);
    }
  };

  /* ─── Assistant menu ─── */
  const getMenuItems = () => {
    const policy = activeProject?.assistant_menu_policy as any;
    if (!policy?.items?.length) {
      return [
        { id: "explain", label: "Объясни термин", action: "explain_term", enabled: true },
        { id: "example", label: "Покажи пример", action: "give_example", enabled: true },
        { id: "quiz", label: "Проверь знания", action: "generate_quiz", enabled: true },
        { id: "flashcards", label: "Карточки", action: "generate_flashcards", enabled: true },
      ];
    }
    // Apply integrity rules
    let items = [...policy.items].filter((i: any) => i.visible !== false);
    const rules = policy.integrity_rules || [];
    for (const rule of rules) {
      if (rule.action === "hide" && submitFeedback === null && rule.condition?.includes("attempt.status != completed")) {
        // Before submission: hide explain_mistake type items
      }
    }
    return items.filter((i: any) => i.enabled !== false);
  };

  const handleAssistantAction = (action: string) => {
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
          setSidePanel({ type: "explain", term, payload: data.public_payload });
        },
      }
    );
  };

  /* ─── Roadmap ─── */
  const roadmap = (activeProject?.roadmap || []) as any[];
  const nextAvailableStep = roadmap.find((s: any) => s.status === "available");

  const handleRunStep = (step: any) => {
    const actionMap: Record<string, string> = {
      course: "generate_lesson_blocks",
      quiz: "generate_quiz",
      flashcards: "generate_flashcards",
      slides: "generate_slides",
      method_pack: "generate_method_pack",
    };
    const action = actionMap[step.artifact_type] || "generate_lesson_blocks";
    actMutation.mutate({
      action_type: action,
      target: { topic_id: step.id },
      context: step.title,
    });
    setView("player");
  };

  /* ─── Artifact renderer ─── */
  const renderArtifactContent = () => {
    if (!activeArtifact) return null;
    const pub = activeArtifact.public_json as any;
    if (!pub) return <p className="text-sm text-muted-foreground">Пустой артефакт</p>;

    const kind = pub.kind;

    if (kind === "quiz" && pub.questions) {
      return submitFeedback ? (
        <div className="space-y-4">
          <FeedbackPanel feedback={submitFeedback} score={submitScore} />
          <Button variant="outline" onClick={() => { setSubmitFeedback(null); setSubmitScore(null); }}>
            <RotateCcw className="h-4 w-4 mr-2" /> Попробовать снова
          </Button>
        </div>
      ) : (
        <QuizPlayer questions={pub.questions} onSubmit={(answers) => submitMutation.mutate({ artifact_id: activeArtifact.id, answers })} />
      );
    }

    if (kind === "flashcards" && pub.cards) return <FlashcardsPlayer cards={pub.cards} />;

    if (kind === "course" && pub.modules) {
      return (
        <div className="space-y-4">
          {pub.modules.map((mod: any) => (
            <div key={mod.id} className="space-y-2">
              <h3 className="font-semibold text-sm text-foreground">{mod.title}</h3>
              {(mod.lessons || []).map((lesson: any) => (
                <BlockRenderer key={lesson.id} block={lesson} onTermClick={handleTermClick} />
              ))}
            </div>
          ))}
        </div>
      );
    }

    if (kind === "slides" && pub.slides) {
      return (
        <div className="space-y-3">
          {pub.slides.map((slide: any) => (
            <div key={slide.id} className="p-4 rounded-lg border border-border bg-card">
              <Badge variant="outline" className="text-[10px] mb-2">{slide.type}</Badge>
              <h4 className="font-semibold text-sm text-foreground">{slide.title}</h4>
              {slide.content && <p className="text-sm text-muted-foreground mt-1">{slide.content}</p>}
              {slide.bullets && <ul className="mt-2 space-y-1">{slide.bullets.map((b: string, i: number) => <li key={i} className="text-sm text-muted-foreground flex gap-2"><span className="text-primary">•</span>{b}</li>)}</ul>}
            </div>
          ))}
        </div>
      );
    }

    if (kind === "method_pack" && pub.blocks) {
      return (
        <div className="space-y-3">
          {pub.blocks.map((block: any) => <BlockRenderer key={block.id} block={block} onTermClick={handleTermClick} />)}
        </div>
      );
    }

    return <pre className="text-xs bg-muted/30 p-4 rounded-lg overflow-auto max-h-96">{JSON.stringify(pub, null, 2)}</pre>;
  };

  /* ═══════════════ VIEWS ═══════════════ */

  // LIST VIEW
  if (view === "list") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Мои проекты</h2>
            <p className="text-sm text-muted-foreground">Guided AI — адаптивное обучение</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={createDemoProject} disabled={wizardLoading}>
              <Bug className="h-4 w-4 mr-2" /> Demo проект
            </Button>
            <Button size="sm" onClick={() => setView("wizard")}>
              <Upload className="h-4 w-4 mr-2" /> Новый проект
            </Button>
          </div>
        </div>

        {projectsLoading ? (
          <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Brain className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-sm">Нет проектов. Загрузите файлы для создания первого.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {projects.map((p) => (
              <div key={p.id} onClick={() => { setActiveProjectId(p.id); setView("dashboard"); }}
                className="rounded-xl border border-border bg-card p-4 cursor-pointer hover:border-primary/30 transition-all group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Map className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium text-sm text-foreground">{p.title}</h3>
                      <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString("ru-RU")} · {p.status}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // WIZARD VIEW
  if (view === "wizard") {
    return (
      <div className="space-y-6 max-w-xl mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setView("list")}>← Назад</Button>
          <h2 className="text-lg font-bold text-foreground">Новый проект</h2>
        </div>

        {wizardStep === "processing" ? (
          <div className="text-center py-16 space-y-4">
            <Loader2 className="h-10 w-10 text-primary animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">Извлечение текста, индексация, создание плана...</p>
            <p className="text-xs text-muted-foreground">Это может занять 30–60 секунд</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Название проекта</label>
              <Input value={wizardTitle} onChange={(e) => setWizardTitle(e.target.value)} placeholder="Например: Основы машинного обучения" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Загрузите файлы с учебным материалом *</label>
              <div onClick={() => fileInputRef.current?.click()}
                className="rounded-xl border-2 border-dashed border-border bg-card p-8 text-center cursor-pointer hover:border-primary/40 transition-all">
                {wizardFiles.length > 0 ? (
                  <div className="space-y-2">
                    {wizardFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 justify-center">
                        <FileText className="h-4 w-4 text-primary" />
                        <span className="text-sm text-foreground">{f.name}</span>
                        <button onClick={(e) => { e.stopPropagation(); setWizardFiles((prev) => prev.filter((_, j) => j !== i)); }}
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
                onChange={(e) => { if (e.target.files?.length) setWizardFiles((prev) => [...prev, ...Array.from(e.target.files!)]); e.target.value = ""; }} />
            </div>

            <Button onClick={handleWizardCreate} disabled={wizardFiles.length === 0 || wizardLoading} className="w-full">
              <Brain className="h-4 w-4 mr-2" /> Создать проект
            </Button>
          </div>
        )}
      </div>
    );
  }

  // DASHBOARD VIEW
  if (view === "dashboard") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => { setView("list"); setActiveProjectId(null); }}>← Проекты</Button>
            <h2 className="text-lg font-bold text-foreground">{activeProject?.title}</h2>
            <Badge variant="secondary">{activeProject?.status}</Badge>
          </div>
          {/* Assistant dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={actMutation.isPending}>
                {actMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Lightbulb className="h-4 w-4 mr-2" />}
                Помощник
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {getMenuItems().map((item: any) => (
                <DropdownMenuItem key={item.id} onClick={() => handleAssistantAction(item.action)}>
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Roadmap */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Map className="h-4 w-4 text-primary" /> Roadmap</CardTitle>
          </CardHeader>
          <CardContent>
            {roadmap.length === 0 ? (
              <p className="text-sm text-muted-foreground">Roadmap пуст. Запустите планирование.</p>
            ) : (
              <div className="space-y-2">
                {roadmap.map((step: any, i: number) => (
                  <div key={step.id} className={cn("flex items-center gap-3 p-3 rounded-lg border transition-all",
                    step.status === "completed" ? "border-accent/30 bg-accent/5" :
                    step.status === "available" ? "border-primary/30 bg-primary/5 cursor-pointer hover:border-primary" :
                    "border-border bg-muted/10 opacity-60")}>
                    <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                      step.status === "completed" ? "bg-accent text-accent-foreground" :
                      step.status === "available" ? "bg-primary text-primary-foreground" :
                      "bg-muted text-muted-foreground")}>
                      {step.status === "completed" ? "✓" : i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{step.title}</p>
                      {step.description && <p className="text-xs text-muted-foreground truncate">{step.description}</p>}
                    </div>
                    {step.artifact_type && <Badge variant="outline" className="text-[10px] shrink-0">{step.artifact_type}</Badge>}
                    {step.status === "available" && (
                      <Button size="sm" variant="default" onClick={() => handleRunStep(step)} disabled={actMutation.isPending}>
                        <Play className="h-3 w-3 mr-1" /> Начать
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Artifacts */}
        {artifacts.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Layers className="h-4 w-4 text-primary" /> Артефакты</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {artifacts.map((art) => (
                  <div key={art.id} onClick={() => { setActiveArtifact(art); setView("player"); setSubmitFeedback(null); setSubmitScore(null); }}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/30 cursor-pointer transition-all">
                    <BookOpen className="h-4 w-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{art.title}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{art.type}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // PLAYER VIEW
  if (view === "player") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => { setView("dashboard"); setSidePanel(null); }}>← Dashboard</Button>
            <h2 className="text-base font-bold text-foreground truncate">{activeArtifact?.title || "Артефакт"}</h2>
          </div>
          {/* Assistant */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={actMutation.isPending}>
                {actMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lightbulb className="h-4 w-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {getMenuItems().map((item: any) => (
                <DropdownMenuItem key={item.id} onClick={() => handleAssistantAction(item.action)}>
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className={cn("grid gap-4", sidePanel ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1")}>
          {/* Main content */}
          <div className={cn(sidePanel ? "lg:col-span-2" : "")}>
            {actMutation.isPending ? (
              <div className="text-center py-16"><Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" /><p className="text-sm text-muted-foreground mt-3">Генерация...</p></div>
            ) : submitMutation.isPending ? (
              <div className="text-center py-16"><Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" /><p className="text-sm text-muted-foreground mt-3">Проверка ответов...</p></div>
            ) : (
              renderArtifactContent()
            )}
          </div>

          {/* Side panel */}
          {sidePanel && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  {sidePanel.type === "loading" ? "Загрузка..." : `Объяснение: ${sidePanel.term}`}
                </h3>
                <button onClick={() => setSidePanel(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
              </div>
              {sidePanel.type === "loading" ? (
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
              ) : sidePanel.payload ? (
                <div className="space-y-2">
                  {sidePanel.payload.blocks?.map((b: any) => <BlockRenderer key={b.id} block={b} />) ||
                    <pre className="text-xs bg-muted/30 p-3 rounded-lg overflow-auto">{JSON.stringify(sidePanel.payload, null, 2)}</pre>}
                </div>
              ) : null}
              {/* Source refs */}
              {sidePanel.source_refs?.length > 0 && (
                <div className="pt-2 border-t border-border">
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1"><FileSearch className="h-3 w-3" /> Источники: {sidePanel.source_refs.length} фрагментов</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};
