import { useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Upload, Brain, Loader2, CheckCircle2, BookOpen, HelpCircle, PenTool, FileText, X, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PageTransition } from "@/components/layout/PageTransition";

interface CourseModule {
  id: string;
  title: string;
  lessons: { id: string; title: string; content: string; type: "text" | "quiz" | "exercise" }[];
}

interface AICourseRow {
  id: string;
  user_id: string;
  title: string;
  status: string;
  progress: number;
  modules: any;
  created_at: string;
}

const statusLabels: Record<string, string> = {
  uploading: "Загрузка файлов",
  processing: "Анализ материалов",
  generating: "Генерация курса",
  completed: "Готово",
  failed: "Ошибка",
};

const statusColors: Record<string, string> = {
  completed: "default",
  generating: "secondary",
  processing: "secondary",
  uploading: "secondary",
  failed: "destructive",
};

const lessonIcons = { text: BookOpen, quiz: HelpCircle, exercise: PenTool };

const AIWorkspace = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedLesson, setExpandedLesson] = useState<string | null>(null);

  // Fetch courses from DB
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
      // Poll while any course is in progress
      const data = query.state.data as AICourseRow[] | undefined;
      const hasInProgress = data?.some((c) => ["uploading", "processing", "generating"].includes(c.status));
      return hasInProgress ? 3000 : false;
    },
  });

  const selectedCourse = courses.find((c) => c.id === selectedCourseId) || null;
  const modules: CourseModule[] = selectedCourse?.modules || [];

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    if (!user) {
      toast.error("Войдите в аккаунт для создания курсов");
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
      // Read file content
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

      // Create course record in DB
      const { data: course, error: insertError } = await supabase
        .from("ai_courses")
        .insert({
          user_id: user.id,
          title: `Курс из ${mainFileName}`,
          status: "uploading",
          progress: 10,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Refetch immediately
      queryClient.invalidateQueries({ queryKey: ["ai-courses"] });
      setSelectedCourseId(course.id);

      // Call edge function
      const { error: fnError } = await supabase.functions.invoke("generate-course", {
        body: {
          courseId: course.id,
          fileContent: combinedContent,
          fileName: mainFileName,
        },
      });

      if (fnError) {
        console.error("Edge function error:", fnError);
        toast.error("Ошибка генерации курса. Попробуйте снова.");
      } else {
        toast.success("Курс успешно сгенерирован!");
      }

      // Refetch to get final state
      queryClient.invalidateQueries({ queryKey: ["ai-courses"] });
    } catch (e) {
      console.error("Course creation error:", e);
      toast.error("Произошла ошибка при создании курса");
    } finally {
      setIsGenerating(false);
    }
  }, [user, queryClient]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) handleFiles(e.target.files);
    e.target.value = "";
  };

  const retryGeneration = async (courseId: string) => {
    toast.info("Повторная генерация пока не реализована. Загрузите файл заново.");
  };

  return (
    <PageTransition>
      <div className="p-6 lg:p-8 space-y-8 max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">AI Workspace</h1>
            <p className="text-sm text-muted-foreground">Загрузите материалы — AI создаст структурированный курс с уроками, тестами и упражнениями</p>
          </div>
        </div>

        {/* Upload zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !isGenerating && fileInputRef.current?.click()}
          className={cn(
            "rounded-xl border-2 border-dashed bg-card p-10 text-center space-y-3 transition-all cursor-pointer",
            isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/30",
            isGenerating && "pointer-events-none opacity-60"
          )}
        >
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
            {isGenerating ? (
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
            ) : (
              <Upload className="h-6 w-6 text-primary" />
            )}
          </div>
          <h3 className="font-semibold text-foreground">
            {isGenerating ? "Генерация курса..." : "Перетащите файлы или нажмите для выбора"}
          </h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            PDF, TXT, MD, DOCX — AI проанализирует содержимое и сгенерирует структурированный курс с уроками, тестами и упражнениями
          </p>
          {!isGenerating && (
            <Button size="sm">
              <Brain className="h-4 w-4 mr-2" /> Создать AI-курс
            </Button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.md,.docx"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Courses list + preview */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            Загрузка курсов...
          </div>
        ) : courses.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>Загрузите файлы, чтобы создать первый AI-курс</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Course list */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Мои курсы ({courses.length})</h2>
              {courses.map((course) => (
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
              ))}
            </div>

            {/* Course preview */}
            <div className="lg:col-span-2">
              {selectedCourse ? (
                <Card className="animate-fade-in">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{selectedCourse.title}</CardTitle>
                      <Badge variant={statusColors[selectedCourse.status] as any || "secondary"}>
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
                        <p className="text-sm text-muted-foreground">Не удалось сгенерировать курс</p>
                        <Button variant="outline" size="sm" onClick={() => retryGeneration(selectedCourse.id)}>
                          <RefreshCw className="h-4 w-4 mr-2" /> Попробовать снова
                        </Button>
                      </div>
                    )}

                    {/* Completed - show modules */}
                    {selectedCourse.status === "completed" && modules.length > 0 && (
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

                        {/* Stats */}
                        <div className="flex gap-4 pt-3 border-t border-border text-xs text-muted-foreground">
                          <span>{modules.length} модулей</span>
                          <span>{modules.reduce((sum, m) => sum + m.lessons.length, 0)} уроков</span>
                          <span>{modules.reduce((sum, m) => sum + m.lessons.filter((l) => l.type === "quiz").length, 0)} тестов</span>
                          <span>{modules.reduce((sum, m) => sum + m.lessons.filter((l) => l.type === "exercise").length, 0)} заданий</span>
                        </div>
                      </div>
                    )}

                    {selectedCourse.status === "completed" && modules.length === 0 && (
                      <div className="py-10 text-center text-muted-foreground">
                        Модули курса пусты
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-3 opacity-40" />
                  Выберите курс для просмотра
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
};

export default AIWorkspace;
