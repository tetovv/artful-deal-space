import { useState } from "react";
import { aiCourses } from "@/data/mockData";
import { Upload, Brain, Loader2, CheckCircle2, BookOpen, HelpCircle, PenTool } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AICourse } from "@/types";

const statusLabels: Record<AICourse["status"], string> = {
  uploading: "Загрузка файлов",
  processing: "Анализ материалов",
  generating: "Генерация курса",
  completed: "Готово",
  failed: "Ошибка",
};

const lessonIcons = { text: BookOpen, quiz: HelpCircle, exercise: PenTool };

const AIWorkspace = () => {
  const [selectedCourse, setSelectedCourse] = useState<AICourse | null>(null);

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">AI Workspace</h1>
          <p className="text-sm text-muted-foreground">Генерация курсов из ваших материалов с помощью AI</p>
        </div>
      </div>

      {/* Upload */}
      <div className="rounded-xl border-2 border-dashed border-border bg-card p-8 text-center space-y-3 hover:border-primary/40 transition-colors">
        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
          <Upload className="h-6 w-6 text-primary" />
        </div>
        <h3 className="font-semibold text-foreground">Загрузите материалы</h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">PDF, DOCX, TXT, MD — AI проанализирует содержимое и сгенерирует структурированный курс с уроками, тестами и упражнениями</p>
        <Button><Brain className="h-4 w-4 mr-2" /> Создать AI-курс</Button>
      </div>

      {/* Courses list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Мои курсы</h2>
          {aiCourses.map((course) => (
            <div
              key={course.id}
              onClick={() => setSelectedCourse(course)}
              className={`rounded-xl border bg-card p-4 cursor-pointer transition-all ${
                selectedCourse?.id === course.id ? "border-primary" : "border-border hover:border-primary/30"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-sm text-card-foreground truncate">{course.title}</h3>
                {course.status === "completed" ? (
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                ) : course.status === "generating" ? (
                  <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
                ) : null}
              </div>
              <p className="text-[11px] text-muted-foreground mb-2">{statusLabels[course.status]}</p>
              <Progress value={course.progress} className="h-1" />
            </div>
          ))}
        </div>

        {/* Course preview */}
        <div className="lg:col-span-2">
          {selectedCourse ? (
            <div className="rounded-xl border border-border bg-card p-5 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-card-foreground">{selectedCourse.title}</h2>
                <Badge variant={selectedCourse.status === "completed" ? "default" : "secondary"}>
                  {statusLabels[selectedCourse.status]}
                </Badge>
              </div>

              {selectedCourse.status === "generating" && (
                <div className="py-8 text-center space-y-3">
                  <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" />
                  <p className="text-sm text-muted-foreground">AI генерирует курс... {selectedCourse.progress}%</p>
                  <Progress value={selectedCourse.progress} className="max-w-xs mx-auto" />
                </div>
              )}

              {selectedCourse.status === "completed" && (
                <div className="space-y-4">
                  {selectedCourse.modules.map((mod, mi) => (
                    <div key={mod.id} className="space-y-2">
                      <h3 className="font-semibold text-sm text-card-foreground">
                        Модуль {mi + 1}: {mod.title}
                      </h3>
                      <div className="space-y-1 pl-4">
                        {mod.lessons.map((lesson) => {
                          const Icon = lessonIcons[lesson.type];
                          return (
                            <div key={lesson.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                              <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="text-sm text-card-foreground">{lesson.title}</span>
                              <Badge variant="outline" className="text-[9px] ml-auto">
                                {lesson.type === "text" ? "Урок" : lesson.type === "quiz" ? "Тест" : "Задание"}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
              Выберите курс для просмотра
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIWorkspace;
