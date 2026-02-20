import { useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Upload, Brain, Loader2, CheckCircle2, BookOpen, HelpCircle, PenTool,
  FileText, AlertCircle, Presentation, ChevronRight, ChevronLeft,
  StickyNote, Columns, Quote, LayoutList, Download, Maximize2,
  Edit3, Save, Trash2, Plus, Settings2, ChevronDown, ImageIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CourseModule {
  id: string;
  title: string;
  lessons: { id: string; title: string; content: string; type: "text" | "quiz" | "exercise" }[];
}

interface Slide {
  id: string;
  type: "title" | "content" | "bullets" | "two-column" | "quote" | "summary";
  title: string;
  content?: string;
  bullets?: string[];
  leftColumn?: string;
  rightColumn?: string;
  notes?: string;
}

interface AICourseRow {
  id: string;
  user_id: string;
  title: string;
  status: string;
  progress: number;
  modules: any;
  slides: any;
  type: string;
  created_at: string;
}

interface GenerationSettings {
  style: string;
  audience: string;
  language: string;
  slideCount: string;
  additionalNotes: string;
  generateImages: boolean;
  imageStyle: string;
}

const defaultSettings: GenerationSettings = {
  style: "business",
  audience: "general",
  language: "ru",
  slideCount: "auto",
  additionalNotes: "",
  generateImages: false,
  imageStyle: "realistic",
};

const STYLE_OPTIONS = [
  { value: "business", label: "Деловой" },
  { value: "academic", label: "Академический" },
  { value: "creative", label: "Креативный" },
  { value: "minimal", label: "Минимализм" },
  { value: "storytelling", label: "Сторителлинг" },
];

const AUDIENCE_OPTIONS = [
  { value: "general", label: "Широкая аудитория" },
  { value: "students", label: "Студенты" },
  { value: "professionals", label: "Профессионалы" },
  { value: "executives", label: "Руководители" },
  { value: "children", label: "Дети / подростки" },
];

const LANGUAGE_OPTIONS = [
  { value: "ru", label: "Русский" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "de", label: "Deutsch" },
];

const IMAGE_STYLE_OPTIONS = [
  { value: "realistic", label: "Реалистичный" },
  { value: "illustration", label: "Иллюстрация" },
  { value: "flat", label: "Flat-дизайн" },
  { value: "watercolor", label: "Акварель" },
  { value: "3d", label: "3D-рендер" },
  { value: "sketch", label: "Скетч" },
  { value: "infographic", label: "Инфографика" },
];

const statusLabels: Record<string, string> = {
  uploading: "Загрузка файлов",
  processing: "Анализ материалов",
  generating: "Генерация",
  completed: "Готово",
  failed: "Ошибка",
};

const lessonIcons = { text: BookOpen, quiz: HelpCircle, exercise: PenTool };

const slideTypeLabels: Record<string, string> = {
  title: "Титульный",
  content: "Контент",
  bullets: "Список",
  "two-column": "Две колонки",
  quote: "Цитата",
  summary: "Итоги",
};

type OutputType = "course" | "quiz" | "presentation" | "document";

const OUTPUT_TYPE_OPTIONS: { value: OutputType; label: string; description: string; icon: React.ElementType }[] = [
  { value: "course", label: "Курс", description: "Модули с уроками и заданиями", icon: BookOpen },
  { value: "quiz", label: "Квиз", description: "Тесты и вопросы по материалу", icon: HelpCircle },
  { value: "presentation", label: "Презентация", description: "Слайды для выступления", icon: Presentation },
  { value: "document", label: "Документ", description: "Структурированный конспект", icon: FileText },
];

const SettingsPanel = ({ settings, onChange, compact = false }: { settings: GenerationSettings; onChange: (s: GenerationSettings) => void; compact?: boolean }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-border bg-muted/10">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-muted/20 transition-colors rounded-lg">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Настройки генерации</span>
        </div>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className={cn("px-4 pb-4 space-y-3", compact ? "grid grid-cols-2 gap-3 space-y-0" : "")}>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Стиль</Label>
            <Select value={settings.style} onValueChange={(v) => onChange({ ...settings, style: v })}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{STYLE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Аудитория</Label>
            <Select value={settings.audience} onValueChange={(v) => onChange({ ...settings, audience: v })}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{AUDIENCE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Язык контента</Label>
            <Select value={settings.language} onValueChange={(v) => onChange({ ...settings, language: v })}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{LANGUAGE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Кол-во слайдов / модулей</Label>
            <Select value={settings.slideCount} onValueChange={(v) => onChange({ ...settings, slideCount: v })}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Авто</SelectItem>
                <SelectItem value="5-8">5–8</SelectItem>
                <SelectItem value="8-12">8–12</SelectItem>
                <SelectItem value="12-20">12–20</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className={cn("space-y-1.5", compact && "col-span-2")}>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5" /> Генерация изображений
              </Label>
              <button type="button" role="switch" aria-checked={settings.generateImages}
                onClick={() => onChange({ ...settings, generateImages: !settings.generateImages })}
                className={cn("relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors", settings.generateImages ? "bg-primary" : "bg-muted")}>
                <span className={cn("pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform", settings.generateImages ? "translate-x-4" : "translate-x-0")} />
              </button>
            </div>
            {settings.generateImages && (
              <Select value={settings.imageStyle} onValueChange={(v) => onChange({ ...settings, imageStyle: v })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{IMAGE_STYLE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </div>
          <div className={cn("space-y-1.5", compact && "col-span-2")}>
            <Label className="text-xs text-muted-foreground">Дополнительные указания</Label>
            <Textarea value={settings.additionalNotes} onChange={(e) => onChange({ ...settings, additionalNotes: e.target.value })}
              placeholder="Например: акцент на практических примерах..." className="min-h-[60px] text-sm resize-none" />
          </div>
        </div>
      )}
    </div>
  );
};

const SlidePreview = ({ slide, index, large = false }: { slide: Slide; index: number; large?: boolean }) => {
  const baseClass = large
    ? "w-full aspect-[16/9] rounded-xl overflow-hidden relative"
    : "w-full aspect-[16/9] rounded-lg overflow-hidden relative cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all";

  const renderContent = () => {
    switch (slide.type) {
      case "title":
        return (<div className="absolute inset-0 bg-gradient-to-br from-primary/90 to-primary/60 flex flex-col items-center justify-center p-6 text-center">
          <h2 className={cn("font-bold text-primary-foreground", large ? "text-2xl md:text-3xl" : "text-[10px] md:text-xs")}>{slide.title}</h2>
          {slide.content && <p className={cn("text-primary-foreground/80 mt-2", large ? "text-base" : "text-[7px] md:text-[9px]")}>{slide.content}</p>}
        </div>);
      case "bullets":
        return (<div className="absolute inset-0 bg-card flex flex-col p-4">
          <h3 className={cn("font-bold text-foreground mb-2", large ? "text-xl" : "text-[9px] md:text-[11px]")}>{slide.title}</h3>
          <div className="flex-1 space-y-1">
            {(slide.bullets || []).slice(0, large ? 10 : 5).map((b, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <span className={cn("text-primary shrink-0", large ? "text-sm mt-0.5" : "text-[6px] mt-0.5")}>●</span>
                <span className={cn("text-muted-foreground", large ? "text-sm" : "text-[7px] md:text-[8px] leading-tight")}>{b}</span>
              </div>
            ))}
          </div>
        </div>);
      case "two-column":
        return (<div className="absolute inset-0 bg-card flex flex-col p-4">
          <h3 className={cn("font-bold text-foreground mb-2", large ? "text-xl" : "text-[9px] md:text-[11px]")}>{slide.title}</h3>
          <div className="flex-1 grid grid-cols-2 gap-2">
            <div className={cn("bg-muted/40 rounded p-2", large ? "text-sm" : "text-[6px] md:text-[8px]")}><span className="text-muted-foreground leading-tight">{slide.leftColumn}</span></div>
            <div className={cn("bg-muted/40 rounded p-2", large ? "text-sm" : "text-[6px] md:text-[8px]")}><span className="text-muted-foreground leading-tight">{slide.rightColumn}</span></div>
          </div>
        </div>);
      case "quote":
        return (<div className="absolute inset-0 bg-card flex flex-col items-center justify-center p-6 text-center">
          <Quote className={cn("text-primary/40 mb-2", large ? "h-10 w-10" : "h-3 w-3")} />
          <h3 className={cn("font-bold text-foreground mb-1", large ? "text-xl" : "text-[9px] md:text-[11px]")}>{slide.title}</h3>
          {slide.content && <p className={cn("text-muted-foreground italic", large ? "text-base" : "text-[7px] md:text-[8px]")}>{slide.content}</p>}
        </div>);
      case "summary":
        return (<div className="absolute inset-0 bg-gradient-to-br from-accent/20 to-card flex flex-col p-4">
          <h3 className={cn("font-bold text-foreground mb-2", large ? "text-xl" : "text-[9px] md:text-[11px]")}>{slide.title}</h3>
          {slide.content && <p className={cn("text-muted-foreground", large ? "text-sm" : "text-[7px] md:text-[8px] leading-tight")}>{slide.content}</p>}
          {slide.bullets && (<div className="flex-1 space-y-1 mt-1">
            {slide.bullets.slice(0, large ? 10 : 4).map((b, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <span className={cn("text-primary shrink-0", large ? "text-sm" : "text-[6px]")}>✓</span>
                <span className={cn("text-muted-foreground", large ? "text-sm" : "text-[7px] md:text-[8px] leading-tight")}>{b}</span>
              </div>
            ))}
          </div>)}
        </div>);
      default:
        return (<div className="absolute inset-0 bg-card flex flex-col p-4">
          <h3 className={cn("font-bold text-foreground mb-2", large ? "text-xl" : "text-[9px] md:text-[11px]")}>{slide.title}</h3>
          {slide.content && <p className={cn("text-muted-foreground", large ? "text-sm" : "text-[7px] md:text-[8px] leading-tight")}>{slide.content}</p>}
        </div>);
    }
  };

  return (
    <div className={baseClass}>
      <div className="absolute inset-0 border border-border rounded-lg md:rounded-xl">
        {renderContent()}
        {!large && <div className="absolute top-1 left-1 bg-primary/80 text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center text-[8px] font-bold">{index + 1}</div>}
      </div>
    </div>
  );
};

const exportToPptx = async (title: string, slides: Slide[]) => {
  const pptxgen = (await import("pptxgenjs")).default;
  const pres = new pptxgen();
  pres.title = title;
  pres.layout = "LAYOUT_WIDE";
  for (const slide of slides) {
    const s = pres.addSlide();
    switch (slide.type) {
      case "title":
        s.background = { color: "2563EB" };
        s.addText(slide.title, { x: 0.5, y: 2.0, w: 12.33, h: 1.5, fontSize: 36, bold: true, color: "FFFFFF", align: "center" });
        if (slide.content) s.addText(slide.content, { x: 1.5, y: 3.8, w: 10.33, h: 1.0, fontSize: 18, color: "FFFFFF", align: "center", italic: true });
        break;
      case "bullets":
        s.addText(slide.title, { x: 0.5, y: 0.3, w: 12.33, h: 0.8, fontSize: 28, bold: true, color: "1E293B" });
        if (slide.bullets?.length) s.addText(slide.bullets.map((b) => ({ text: b, options: { bullet: true, fontSize: 18, color: "475569", breakLine: true } })), { x: 0.8, y: 1.3, w: 11.5, h: 5.0 });
        break;
      case "two-column":
        s.addText(slide.title, { x: 0.5, y: 0.3, w: 12.33, h: 0.8, fontSize: 28, bold: true, color: "1E293B" });
        if (slide.leftColumn) s.addText(slide.leftColumn, { x: 0.5, y: 1.5, w: 5.8, h: 4.5, fontSize: 16, color: "475569", valign: "top" });
        if (slide.rightColumn) s.addText(slide.rightColumn, { x: 7.0, y: 1.5, w: 5.8, h: 4.5, fontSize: 16, color: "475569", valign: "top" });
        break;
      case "quote":
        s.addText(`"${slide.content || slide.title}"`, { x: 1.5, y: 2.0, w: 10.33, h: 2.5, fontSize: 24, italic: true, color: "1E293B", align: "center" });
        s.addText(slide.title, { x: 1.5, y: 4.5, w: 10.33, h: 0.6, fontSize: 16, color: "64748B", align: "center" });
        break;
      case "summary":
        s.background = { color: "F1F5F9" };
        s.addText(slide.title, { x: 0.5, y: 0.3, w: 12.33, h: 0.8, fontSize: 28, bold: true, color: "1E293B" });
        if (slide.content) s.addText(slide.content, { x: 0.8, y: 1.3, w: 11.5, h: 5.0, fontSize: 16, color: "475569" });
        if (slide.bullets?.length) s.addText(slide.bullets.map((b) => ({ text: b, options: { bullet: { code: "2713" }, fontSize: 16, color: "475569", breakLine: true } })), { x: 0.8, y: slide.content ? 3.5 : 1.3, w: 11.5, h: 3.0 });
        break;
      default:
        s.addText(slide.title, { x: 0.5, y: 0.3, w: 12.33, h: 0.8, fontSize: 28, bold: true, color: "1E293B" });
        if (slide.content) s.addText(slide.content, { x: 0.8, y: 1.3, w: 11.5, h: 5.0, fontSize: 16, color: "475569" });
        break;
    }
    if (slide.notes) s.addNotes(slide.notes);
  }
  await pres.writeFile({ fileName: `${title}.pptx` });
  toast.success("PPTX файл скачан!");
};

/* ========== MAIN LEGACY COMPONENT ========== */
interface LegacyWorkspaceProps {
  readOnly?: boolean;
}

export const LegacyWorkspace = ({ readOnly = false }: LegacyWorkspaceProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedLesson, setExpandedLesson] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [viewingSlideIdx, setViewingSlideIdx] = useState(0);
  const [slideViewMode, setSlideViewMode] = useState<"grid" | "single">("grid");
  const [editingSlide, setEditingSlide] = useState<Slide | null>(null);
  const [isSavingSlides, setIsSavingSlides] = useState(false);
  const [settings, setSettings] = useState<GenerationSettings>({ ...defaultSettings });
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const [selectedOutputTypes, setSelectedOutputTypes] = useState<OutputType[]>(["course"]);
  const [inputMode, setInputMode] = useState<"file" | "description">("file");

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ["ai-courses", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from("ai_courses").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as AICourseRow[];
    },
    enabled: !!user,
    refetchInterval: (query) => {
      const data = query.state.data as AICourseRow[] | undefined;
      return data?.some((c) => ["uploading", "processing", "generating"].includes(c.status)) ? 3000 : false;
    },
  });

  const selectedCourse = courses.find((c) => c.id === selectedCourseId) || null;
  const modules: CourseModule[] = selectedCourse?.modules || [];
  const slides: Slide[] = selectedCourse?.slides || [];

  const toggleOutputType = (type: OutputType) => setSelectedOutputTypes((prev) => prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]);

  const readFileAsText = (file: File): Promise<string> => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result as string); r.onerror = reject; r.readAsText(file); });

  const buildSettingsPrompt = (s: GenerationSettings) => {
    const parts: string[] = [];
    parts.push(`Стиль: ${STYLE_OPTIONS.find((o) => o.value === s.style)?.label || s.style}`);
    parts.push(`Целевая аудитория: ${AUDIENCE_OPTIONS.find((o) => o.value === s.audience)?.label || s.audience}`);
    parts.push(`Язык: ${LANGUAGE_OPTIONS.find((o) => o.value === s.language)?.label || s.language}`);
    if (s.slideCount !== "auto") parts.push(`Количество: ${s.slideCount}`);
    if (s.additionalNotes.trim()) parts.push(`Указания: ${s.additionalNotes.trim()}`);
    return parts.join("\n");
  };

  const startGeneration = useCallback(async (content: string, fileName: string, outputTypes: OutputType[], genSettings: GenerationSettings) => {
    if (!user) { toast.error("Войдите в аккаунт"); return; }
    if (outputTypes.length === 0) { toast.error("Выберите тип"); return; }
    setIsGenerating(true);
    try {
      const settingsPrompt = buildSettingsPrompt(genSettings);
      for (const outputType of outputTypes) {
        const type = outputType === "presentation" ? "presentation" : "course";
        const titlePrefix = outputType === "course" ? "Курс" : outputType === "quiz" ? "Квиз" : outputType === "presentation" ? "Презентация" : "Документ";
        const { data: course, error: insertError } = await supabase.from("ai_courses").insert({ user_id: user.id, title: `${titlePrefix} из ${fileName}`, status: "uploading", progress: 10, type }).select().single();
        if (insertError) throw insertError;
        queryClient.invalidateQueries({ queryKey: ["ai-courses"] });
        setSelectedCourseId(course.id);
        let adjustedSettings = settingsPrompt;
        if (outputType === "quiz") adjustedSettings += "\n\nВАЖНО: Генерируй ТОЛЬКО тестовые вопросы (quiz).";
        else if (outputType === "document") adjustedSettings += "\n\nВАЖНО: Генерируй структурированный документ-конспект.";
        const fnName = type === "presentation" ? "generate-presentation" : "generate-course";
        const { error: fnError } = await supabase.functions.invoke(fnName, { body: { courseId: course.id, fileContent: content, fileName, settings: adjustedSettings } });
        if (fnError) { console.error("Edge function error:", fnError); toast.error(`Ошибка: ${titlePrefix}`); }
        else toast.success(`${titlePrefix} сгенерирован!`);
      }
      queryClient.invalidateQueries({ queryKey: ["ai-courses"] });
      setPendingFiles(null);
      setDescription("");
    } catch (e) { console.error(e); toast.error("Произошла ошибка"); }
    finally { setIsGenerating(false); }
  }, [user, queryClient]);

  const handleFilesUpload = useCallback(async (files: FileList | File[]) => {
    const valid = Array.from(files).filter((f) => [".pdf", ".txt", ".md", ".docx"].some((ext) => f.name.toLowerCase().endsWith(ext)));
    if (!valid.length) { toast.error("Поддерживаемые форматы: PDF, TXT, MD, DOCX"); return; }
    setPendingFiles(valid);
    setInputMode("file");
  }, []);

  const handleStartFromFiles = useCallback(async () => {
    if (!pendingFiles?.length) return;
    let combined = "";
    for (const file of pendingFiles) { try { combined += `\n\n--- ${file.name} ---\n\n${await readFileAsText(file)}`; } catch { toast.error(`Не удалось: ${file.name}`); } }
    if (!combined.trim()) { toast.error("Не удалось извлечь текст"); return; }
    await startGeneration(combined, pendingFiles[0].name, selectedOutputTypes, settings);
  }, [pendingFiles, selectedOutputTypes, settings, startGeneration]);

  const handleStartFromDescription = useCallback(async () => {
    if (!description.trim()) { toast.error("Введите описание"); return; }
    await startGeneration(description, description.slice(0, 50) + "...", selectedOutputTypes, settings);
  }, [description, selectedOutputTypes, settings, startGeneration]);

  const saveSlideEdit = useCallback(async (updatedSlide: Slide) => {
    if (!selectedCourse) return;
    setIsSavingSlides(true);
    try {
      const newSlides = slides.map((s) => (s.id === updatedSlide.id ? updatedSlide : s));
      await supabase.from("ai_courses").update({ slides: newSlides as any }).eq("id", selectedCourse.id);
      queryClient.invalidateQueries({ queryKey: ["ai-courses"] });
      setEditingSlide(null);
      toast.success("Слайд сохранён");
    } catch { toast.error("Ошибка"); }
    finally { setIsSavingSlides(false); }
  }, [selectedCourse, slides, queryClient]);

  const deleteSlide = useCallback(async (slideId: string) => {
    if (!selectedCourse) return;
    const newSlides = slides.filter((s) => s.id !== slideId);
    await supabase.from("ai_courses").update({ slides: newSlides as any }).eq("id", selectedCourse.id);
    queryClient.invalidateQueries({ queryKey: ["ai-courses"] });
    if (viewingSlideIdx >= newSlides.length) setViewingSlideIdx(Math.max(0, newSlides.length - 1));
    toast.success("Слайд удалён");
  }, [selectedCourse, slides, queryClient, viewingSlideIdx]);

  const addSlideAfter = useCallback(async (afterIdx: number) => {
    if (!selectedCourse) return;
    const newSlide: Slide = { id: crypto.randomUUID(), type: "content", title: "Новый слайд", content: "" };
    const newSlides = [...slides]; newSlides.splice(afterIdx + 1, 0, newSlide);
    await supabase.from("ai_courses").update({ slides: newSlides as any }).eq("id", selectedCourse.id);
    queryClient.invalidateQueries({ queryKey: ["ai-courses"] });
    setViewingSlideIdx(afterIdx + 1); setSlideViewMode("single"); setEditingSlide(newSlide);
    toast.success("Слайд добавлен");
  }, [selectedCourse, slides, queryClient]);

  const deleteCourse = useCallback(async (id: string) => {
    await supabase.from("ai_courses").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["ai-courses"] });
    if (selectedCourseId === id) setSelectedCourseId(null);
    toast.success("Удалено");
  }, [queryClient, selectedCourseId]);

  const getItemTypeLabel = (item: AICourseRow) => {
    if (item.type === "presentation") return "Презентация";
    if (item.title.startsWith("Квиз")) return "Квиз";
    if (item.title.startsWith("Документ")) return "Документ";
    return "Курс";
  };

  const getItemTypeIcon = (item: AICourseRow) => {
    const l = getItemTypeLabel(item);
    return l === "Презентация" ? Presentation : l === "Квиз" ? HelpCircle : l === "Документ" ? FileText : BookOpen;
  };

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files.length) handleFilesUpload(e.dataTransfer.files); };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files?.length) handleFilesUpload(e.target.files); e.target.value = ""; };

  return (
    <div className="space-y-6">
      {/* Input area — hidden in readOnly mode */}
      {!readOnly && (
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button variant={inputMode === "file" ? "default" : "outline"} size="sm" onClick={() => { setInputMode("file"); setDescription(""); }}>
            <Upload className="h-4 w-4 mr-2" /> Из файла
          </Button>
          <Button variant={inputMode === "description" ? "default" : "outline"} size="sm" onClick={() => { setInputMode("description"); setPendingFiles(null); }}>
            <PenTool className="h-4 w-4 mr-2" /> По описанию
          </Button>
        </div>

        {inputMode === "file" ? (
          <div onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop}
            onClick={() => !isGenerating && !pendingFiles && fileInputRef.current?.click()}
            className={cn("rounded-xl border-2 border-dashed bg-card p-8 text-center space-y-3 transition-all",
              !pendingFiles && "cursor-pointer", isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/30",
              isGenerating && "pointer-events-none opacity-60")}>
            {pendingFiles ? (
              <div className="space-y-4 max-w-2xl mx-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-2 justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium text-foreground">{pendingFiles.map((f) => f.name).join(", ")}</span>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setPendingFiles(null)}>✕</Button>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Что сгенерировать?</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {OUTPUT_TYPE_OPTIONS.map((opt, i) => { const Icon = opt.icon; const isSel = selectedOutputTypes.includes(opt.value); return (
                      <button key={opt.value} onClick={() => toggleOutputType(opt.value)}
                        style={{ animationDelay: `${i * 75}ms`, animationFillMode: 'both' }}
                        className={cn("flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all text-center animate-fade-in",
                          isSel ? "border-primary bg-primary/5 text-foreground" : "border-border bg-card hover:border-primary/30 text-muted-foreground")}>
                        <Icon className={cn("h-5 w-5 transition-transform", isSel ? "text-primary scale-110" : "text-muted-foreground")} />
                        <span className="text-xs font-medium">{opt.label}</span>
                        <span className="text-[10px] text-muted-foreground leading-tight">{opt.description}</span>
                      </button>
                    ); })}
                  </div>
                </div>
                <SettingsPanel settings={settings} onChange={setSettings} compact />
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" size="sm" onClick={() => setPendingFiles(null)}>Отмена</Button>
                  <Button size="sm" onClick={handleStartFromFiles} disabled={isGenerating || selectedOutputTypes.length === 0}>
                    {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Brain className="h-4 w-4 mr-2" />}
                    Создать {selectedOutputTypes.length > 1 ? `(${selectedOutputTypes.length})` : ""}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                  {isGenerating ? <Loader2 className="h-6 w-6 text-primary animate-spin" /> : <Upload className="h-6 w-6 text-primary" />}
                </div>
                <h3 className="font-semibold text-foreground">{isGenerating ? "Генерация..." : "Перетащите файлы или нажмите"}</h3>
                <p className="text-xs text-muted-foreground">PDF, TXT, MD, DOCX</p>
                {!isGenerating && <Button size="sm"><Upload className="h-4 w-4 mr-2" /> Выбрать файл</Button>}
              </>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Опишите тему..." className="min-h-[100px] text-sm resize-none" />
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Что сгенерировать?</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {OUTPUT_TYPE_OPTIONS.map((opt, i) => { const Icon = opt.icon; const isSel = selectedOutputTypes.includes(opt.value); return (
                  <button key={opt.value} onClick={() => toggleOutputType(opt.value)}
                    style={{ animationDelay: `${i * 75}ms`, animationFillMode: 'both' }}
                    className={cn("flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all text-center animate-fade-in",
                      isSel ? "border-primary bg-primary/5 text-foreground" : "border-border bg-card hover:border-primary/30 text-muted-foreground")}>
                    <Icon className={cn("h-5 w-5 transition-transform", isSel ? "text-primary scale-110" : "text-muted-foreground")} />
                    <span className="text-xs font-medium">{opt.label}</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">{opt.description}</span>
                  </button>
                ); })}
              </div>
            </div>
            <SettingsPanel settings={settings} onChange={setSettings} />
            <Button size="sm" className="w-full" onClick={handleStartFromDescription} disabled={isGenerating || !description.trim() || selectedOutputTypes.length === 0}>
              {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Brain className="h-4 w-4 mr-2" />}
              Создать {selectedOutputTypes.length > 1 ? `(${selectedOutputTypes.length})` : ""}
            </Button>
          </div>
        )}
        <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md,.docx" multiple className="hidden" onChange={handleFileSelect} />
      </div>
      )}

      {/* Items list + preview */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Загрузка...</div>
      ) : courses.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground"><Brain className="h-10 w-10 mx-auto mb-3 opacity-40" /><p>Загрузите файлы или опишите тему</p></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* List */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Мои материалы ({courses.length})</h2>
            {courses.map((course) => {
              const TypeIcon = getItemTypeIcon(course);
              return (
                <div key={course.id} onClick={() => { setSelectedCourseId(course.id); setViewingSlideIdx(0); setSlideViewMode("grid"); }}
                  className={cn("rounded-xl border bg-card p-4 cursor-pointer transition-all group",
                    selectedCourseId === course.id ? "border-primary ring-1 ring-primary/20" : "border-border hover:border-primary/30")}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <TypeIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <h3 className="font-medium text-sm text-card-foreground truncate">{course.title}</h3>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); deleteCourse(course.id); }}
                        className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="h-3.5 w-3.5" /></button>
                      {course.status === "completed" ? <CheckCircle2 className="h-4 w-4 text-primary" /> : course.status === "failed" ? <AlertCircle className="h-4 w-4 text-destructive" /> : <Loader2 className="h-4 w-4 text-primary animate-spin" />}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-[10px]">{getItemTypeLabel(course)}</Badge>
                    <p className="text-[11px] text-muted-foreground">{statusLabels[course.status] || course.status}</p>
                  </div>
                  <Progress value={course.progress || 0} className="h-1" />
                </div>
              );
            })}
          </div>

          {/* Preview */}
          <div className="lg:col-span-2">
            {!selectedCourse ? (
              <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-3 opacity-40" /> Выберите элемент
              </div>
            ) : (
              <Card className="animate-fade-in">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{selectedCourse.title}</CardTitle>
                    <Badge variant={selectedCourse.status === "completed" ? "default" : selectedCourse.status === "failed" ? "destructive" : "secondary"}>
                      {statusLabels[selectedCourse.status] || selectedCourse.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {["uploading", "processing", "generating"].includes(selectedCourse.status) && (
                    <div className="py-10 text-center space-y-3"><Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" /><p className="text-sm text-muted-foreground">{statusLabels[selectedCourse.status]}... {selectedCourse.progress}%</p><Progress value={selectedCourse.progress || 0} className="max-w-xs mx-auto" /></div>
                  )}
                  {selectedCourse.status === "failed" && <div className="py-10 text-center"><AlertCircle className="h-8 w-8 text-destructive mx-auto" /><p className="text-sm text-muted-foreground mt-3">Не удалось сгенерировать</p></div>}
                  {selectedCourse.status === "completed" && selectedCourse.type === "course" && modules.length > 0 && (
                    <div className="space-y-5">
                      {modules.map((mod, mi) => (
                        <div key={mod.id} className="space-y-2">
                          <h3 className="font-semibold text-sm text-card-foreground">Модуль {mi + 1}: {mod.title}</h3>
                          <div className="space-y-1 pl-4">
                            {mod.lessons.map((lesson) => {
                              const Icon = lessonIcons[lesson.type] || BookOpen;
                              const isExp = expandedLesson === lesson.id;
                              return (<div key={lesson.id}>
                                <button onClick={() => setExpandedLesson(isExp ? null : lesson.id)} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors w-full text-left">
                                  <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  <span className="text-sm text-card-foreground flex-1">{lesson.title}</span>
                                  <Badge variant="outline" className="text-[9px] shrink-0">{lesson.type === "text" ? "Урок" : lesson.type === "quiz" ? "Тест" : "Задание"}</Badge>
                                </button>
                                {isExp && lesson.content && <div className="ml-8 mr-2 mb-2 p-3 rounded-lg bg-muted/30 text-sm text-muted-foreground whitespace-pre-wrap">{lesson.content}</div>}
                              </div>);
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedCourse.status === "completed" && selectedCourse.type === "presentation" && slides.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{slides.length} слайдов</span>
                        <Button size="sm" variant="outline" onClick={() => exportToPptx(selectedCourse.title, slides)}><Download className="h-4 w-4 mr-2" /> PPTX</Button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {slides.map((slide, i) => <div key={slide.id} onClick={() => { setViewingSlideIdx(i); setSlideViewMode("single"); }}><SlidePreview slide={slide} index={i} /></div>)}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
