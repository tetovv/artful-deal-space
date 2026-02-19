import { useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Upload, Brain, Loader2, CheckCircle2, BookOpen, HelpCircle, PenTool, FileText, AlertCircle, RefreshCw, Presentation, ChevronRight, StickyNote, Columns, Quote, LayoutList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PageTransition } from "@/components/layout/PageTransition";

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

const statusLabels: Record<string, string> = {
  uploading: "Загрузка файлов",
  processing: "Анализ материалов",
  generating: "Генерация",
  completed: "Готово",
  failed: "Ошибка",
};

const lessonIcons = { text: BookOpen, quiz: HelpCircle, exercise: PenTool };

const slideTypeIcons: Record<string, any> = {
  title: Presentation,
  content: FileText,
  bullets: LayoutList,
  "two-column": Columns,
  quote: Quote,
  summary: StickyNote,
};

const slideTypeLabels: Record<string, string> = {
  title: "Титульный",
  content: "Контент",
  bullets: "Список",
  "two-column": "Две колонки",
  quote: "Цитата",
  summary: "Итоги",
};

const AIWorkspace = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const presFileInputRef = useRef<HTMLInputElement>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPresDropDragging, setIsPresDropDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedLesson, setExpandedLesson] = useState<string | null>(null);
  const [expandedSlide, setExpandedSlide] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("courses");
  const [presDescription, setPresDescription] = useState("");
  const [presMode, setPresMode] = useState<"file" | "description">("file");

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ["ai-courses", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("ai_courses")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as AICourseRow[];
    },
    enabled: !!user,
    refetchInterval: (query) => {
      const data = query.state.data as AICourseRow[] | undefined;
      const hasInProgress = data?.some((c) => ["uploading", "processing", "generating"].includes(c.status));
      return hasInProgress ? 3000 : false;
    },
  });

  const courseItems = courses.filter((c) => c.type === "course");
  const presItems = courses.filter((c) => c.type === "presentation");
  const selectedCourse = courses.find((c) => c.id === selectedCourseId) || null;
  const modules: CourseModule[] = selectedCourse?.modules || [];
  const slides: Slide[] = selectedCourse?.slides || [];

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const handleFiles = useCallback(async (files: FileList | File[], type: "course" | "presentation" = "course") => {
    if (!user) {
      toast.error("Войдите в аккаунт");
      return;
    }

    const validExtensions = [".pdf", ".txt", ".md", ".docx"];
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter((f) =>
      validExtensions.some((ext) => f.name.toLowerCase().endsWith(ext))
    );

    if (validFiles.length === 0) {
      toast.error("Поддерживаемые форматы: PDF, TXT, MD, DOCX");
      return;
    }

    setIsGenerating(true);

    try {
      let combinedContent = "";
      let mainFileName = validFiles[0].name;

      for (const file of validFiles) {
        try {
          const text = await readFileAsText(file);
          combinedContent += `\n\n--- ${file.name} ---\n\n${text}`;
        } catch {
          toast.error(`Не удалось прочитать файл: ${file.name}`);
        }
      }

      if (!combinedContent.trim()) {
        toast.error("Не удалось извлечь текст из файлов");
        setIsGenerating(false);
        return;
      }

      const { data: course, error: insertError } = await supabase
        .from("ai_courses")
        .insert({
          user_id: user.id,
          title: type === "course" ? `Курс из ${mainFileName}` : `Презентация из ${mainFileName}`,
          status: "uploading",
          progress: 10,
          type,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      queryClient.invalidateQueries({ queryKey: ["ai-courses"] });
      setSelectedCourseId(course.id);

      const fnName = type === "course" ? "generate-course" : "generate-presentation";
      const { error: fnError } = await supabase.functions.invoke(fnName, {
        body: {
          courseId: course.id,
          fileContent: combinedContent,
          fileName: mainFileName,
        },
      });

      if (fnError) {
        console.error("Edge function error:", fnError);
        toast.error("Ошибка генерации. Попробуйте снова.");
      } else {
        toast.success(type === "course" ? "Курс сгенерирован!" : "Презентация сгенерирована!");
      }

      queryClient.invalidateQueries({ queryKey: ["ai-courses"] });
    } catch (e) {
      console.error("Creation error:", e);
      toast.error("Произошла ошибка");
    } finally {
      setIsGenerating(false);
    }
  }, [user, queryClient]);

  const generatePresFromDescription = useCallback(async () => {
    if (!user || !presDescription.trim()) {
      toast.error("Введите описание для презентации");
      return;
    }

    setIsGenerating(true);
    try {
      const { data: course, error: insertError } = await supabase
        .from("ai_courses")
        .insert({
          user_id: user.id,
          title: `Презентация: ${presDescription.slice(0, 50)}...`,
          status: "uploading",
          progress: 10,
          type: "presentation",
        })
        .select()
        .single();

      if (insertError) throw insertError;

      queryClient.invalidateQueries({ queryKey: ["ai-courses"] });
      setSelectedCourseId(course.id);
      setActiveTab("presentations");

      const { error: fnError } = await supabase.functions.invoke("generate-presentation", {
        body: {
          courseId: course.id,
          description: presDescription,
        },
      });

      if (fnError) {
        console.error("Edge function error:", fnError);
        toast.error("Ошибка генерации презентации.");
      } else {
        toast.success("Презентация сгенерирована!");
        setPresDescription("");
      }

      queryClient.invalidateQueries({ queryKey: ["ai-courses"] });
    } catch (e) {
      console.error("Presentation error:", e);
      toast.error("Произошла ошибка");
    } finally {
      setIsGenerating(false);
    }
  }, [user, presDescription, queryClient]);

  const handleDrop = (e: React.DragEvent, type: "course" | "presentation" = "course") => {
    e.preventDefault();
    setIsDragging(false);
    setIsPresDropDragging(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files, type);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: "course" | "presentation" = "course") => {
    if (e.target.files?.length) handleFiles(e.target.files, type);
    e.target.value = "";
  };

  const renderItemList = (items: AICourseRow[], emptyText: string) => (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">
        {activeTab === "courses" ? "Мои курсы" : "Мои презентации"} ({items.length})
      </h2>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4">{emptyText}</p>
      ) : (
        items.map((course) => (
          <div
            key={course.id}
            onClick={() => setSelectedCourseId(course.id)}
            className={cn(
              "rounded-xl border bg-card p-4 cursor-pointer transition-all",
              selectedCourseId === course.id ? "border-primary ring-1 ring-primary/20" : "border-border hover:border-primary/30"
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-sm text-card-foreground truncate">{course.title}</h3>
              {course.status === "completed" ? (
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              ) : course.status === "failed" ? (
                <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
              ) : (
                <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mb-2">{statusLabels[course.status] || course.status}</p>
            <Progress value={course.progress || 0} className="h-1" />
          </div>
        ))
      )}
    </div>
  );

  const renderCoursePreview = () => {
    if (!selectedCourse) {
      return (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-3 opacity-40" />
          Выберите элемент для просмотра
        </div>
      );
    }

    return (
      <Card className="animate-fade-in">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{selectedCourse.title}</CardTitle>
            <Badge variant={selectedCourse.status === "completed" ? "default" : selectedCourse.status === "failed" ? "destructive" : "secondary"}>
              {statusLabels[selectedCourse.status] || selectedCourse.status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Создан: {new Date(selectedCourse.created_at).toLocaleDateString("ru-RU")}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* In progress */}
          {["uploading", "processing", "generating"].includes(selectedCourse.status) && (
            <div className="py-10 text-center space-y-3">
              <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" />
              <p className="text-sm text-muted-foreground">
                {statusLabels[selectedCourse.status]}... {selectedCourse.progress}%
              </p>
              <Progress value={selectedCourse.progress || 0} className="max-w-xs mx-auto" />
            </div>
          )}

          {/* Failed */}
          {selectedCourse.status === "failed" && (
            <div className="py-10 text-center space-y-3">
              <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
              <p className="text-sm text-muted-foreground">Не удалось сгенерировать</p>
            </div>
          )}

          {/* Completed course */}
          {selectedCourse.status === "completed" && selectedCourse.type === "course" && modules.length > 0 && (
            <div className="space-y-5">
              {modules.map((mod, mi) => (
                <div key={mod.id} className="space-y-2">
                  <h3 className="font-semibold text-sm text-card-foreground">
                    Модуль {mi + 1}: {mod.title}
                  </h3>
                  <div className="space-y-1 pl-4">
                    {mod.lessons.map((lesson) => {
                      const Icon = lessonIcons[lesson.type] || BookOpen;
                      const isExpanded = expandedLesson === lesson.id;
                      return (
                        <div key={lesson.id}>
                          <button
                            onClick={() => setExpandedLesson(isExpanded ? null : lesson.id)}
                            className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors w-full text-left"
                          >
                            <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-sm text-card-foreground flex-1">{lesson.title}</span>
                            <Badge variant="outline" className="text-[9px] shrink-0">
                              {lesson.type === "text" ? "Урок" : lesson.type === "quiz" ? "Тест" : "Задание"}
                            </Badge>
                          </button>
                          {isExpanded && lesson.content && (
                            <div className="ml-8 mr-2 mb-2 p-3 rounded-lg bg-muted/30 text-sm text-muted-foreground whitespace-pre-wrap">
                              {lesson.content}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="flex gap-4 pt-3 border-t border-border text-xs text-muted-foreground">
                <span>{modules.length} модулей</span>
                <span>{modules.reduce((sum, m) => sum + m.lessons.length, 0)} уроков</span>
                <span>{modules.reduce((sum, m) => sum + m.lessons.filter((l) => l.type === "quiz").length, 0)} тестов</span>
              </div>
            </div>
          )}

          {/* Completed presentation */}
          {selectedCourse.status === "completed" && selectedCourse.type === "presentation" && slides.length > 0 && (
            <div className="space-y-3">
              {slides.map((slide, si) => {
                const SlideIcon = slideTypeIcons[slide.type] || FileText;
                const isExpanded = expandedSlide === slide.id;
                return (
                  <div key={slide.id} className="border border-border rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedSlide(isExpanded ? null : slide.id)}
                      className="flex items-center gap-3 p-3 w-full text-left hover:bg-muted/30 transition-colors"
                    >
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-primary">{si + 1}</span>
                      </div>
                      <SlideIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium text-card-foreground flex-1 truncate">{slide.title}</span>
                      <Badge variant="outline" className="text-[9px] shrink-0">
                        {slideTypeLabels[slide.type] || slide.type}
                      </Badge>
                      <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", isExpanded && "rotate-90")} />
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                        {slide.content && (
                          <p className="text-sm text-muted-foreground">{slide.content}</p>
                        )}
                        {slide.bullets && slide.bullets.length > 0 && (
                          <ul className="space-y-1.5 pl-4">
                            {slide.bullets.map((b, i) => (
                              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                <span className="text-primary mt-1.5">•</span>
                                {b}
                              </li>
                            ))}
                          </ul>
                        )}
                        {slide.type === "two-column" && (
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 rounded-lg bg-muted/30 text-sm text-muted-foreground">
                              {slide.leftColumn}
                            </div>
                            <div className="p-3 rounded-lg bg-muted/30 text-sm text-muted-foreground">
                              {slide.rightColumn}
                            </div>
                          </div>
                        )}
                        {slide.notes && (
                          <div className="p-3 rounded-lg bg-accent/20 text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">Заметки: </span>{slide.notes}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="flex gap-4 pt-3 border-t border-border text-xs text-muted-foreground">
                <span>{slides.length} слайдов</span>
              </div>
            </div>
          )}

          {selectedCourse.status === "completed" && (
            (selectedCourse.type === "course" && modules.length === 0) ||
            (selectedCourse.type === "presentation" && slides.length === 0)
          ) && (
            <div className="py-10 text-center text-muted-foreground">Содержимое пусто</div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <PageTransition>
      <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-foreground">AI Workspace</h1>
          <p className="text-sm text-muted-foreground">Генерируйте курсы и презентации с помощью AI</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="courses" className="gap-2">
              <Brain className="h-4 w-4" /> Курсы
            </TabsTrigger>
            <TabsTrigger value="presentations" className="gap-2">
              <Presentation className="h-4 w-4" /> Презентации
            </TabsTrigger>
          </TabsList>

          {/* Courses tab */}
          <TabsContent value="courses" className="space-y-6 mt-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => handleDrop(e, "course")}
              onClick={() => !isGenerating && fileInputRef.current?.click()}
              className={cn(
                "rounded-xl border-2 border-dashed bg-card p-10 text-center space-y-3 transition-all cursor-pointer",
                isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/30",
                isGenerating && "pointer-events-none opacity-60"
              )}
            >
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                {isGenerating ? <Loader2 className="h-6 w-6 text-primary animate-spin" /> : <Upload className="h-6 w-6 text-primary" />}
              </div>
              <h3 className="font-semibold text-foreground">
                {isGenerating ? "Генерация курса..." : "Перетащите файлы или нажмите для выбора"}
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                PDF, TXT, MD, DOCX — AI сгенерирует структурированный курс с уроками, тестами и упражнениями
              </p>
              {!isGenerating && (
                <Button size="sm"><Brain className="h-4 w-4 mr-2" /> Создать AI-курс</Button>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md,.docx" multiple className="hidden" onChange={(e) => handleFileSelect(e, "course")} />

            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Загрузка...
              </div>
            ) : courseItems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>Загрузите файлы, чтобы создать первый AI-курс</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {renderItemList(courseItems, "Нет курсов")}
                <div className="lg:col-span-2">{renderCoursePreview()}</div>
              </div>
            )}
          </TabsContent>

          {/* Presentations tab */}
          <TabsContent value="presentations" className="space-y-6 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* From file */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsPresDropDragging(true); }}
                onDragLeave={() => setIsPresDropDragging(false)}
                onDrop={(e) => handleDrop(e, "presentation")}
                onClick={() => !isGenerating && presFileInputRef.current?.click()}
                className={cn(
                  "rounded-xl border-2 border-dashed bg-card p-8 text-center space-y-3 transition-all cursor-pointer",
                  isPresDropDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/30",
                  isGenerating && "pointer-events-none opacity-60"
                )}
              >
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                  <Upload className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-sm text-foreground">Из файла</h3>
                <p className="text-xs text-muted-foreground">Загрузите документ — AI создаст презентацию</p>
              </div>
              <input ref={presFileInputRef} type="file" accept=".pdf,.txt,.md,.docx" multiple className="hidden" onChange={(e) => handleFileSelect(e, "presentation")} />

              {/* From description */}
              <div className="rounded-xl border border-border bg-card p-6 space-y-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                  <PenTool className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-sm text-foreground text-center">По описанию</h3>
                <Textarea
                  value={presDescription}
                  onChange={(e) => setPresDescription(e.target.value)}
                  placeholder="Опишите тему презентации, целевую аудиторию и ключевые моменты..."
                  className="min-h-[80px] text-sm resize-none"
                />
                <Button
                  size="sm"
                  className="w-full"
                  onClick={generatePresFromDescription}
                  disabled={isGenerating || !presDescription.trim()}
                >
                  {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Presentation className="h-4 w-4 mr-2" />}
                  Создать презентацию
                </Button>
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Загрузка...
              </div>
            ) : presItems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Presentation className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>Создайте первую AI-презентацию</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {renderItemList(presItems, "Нет презентаций")}
                <div className="lg:col-span-2">{renderCoursePreview()}</div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PageTransition>
  );
};

export default AIWorkspace;
