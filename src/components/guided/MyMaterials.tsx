import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  FolderOpen, Plus, Clock, BookOpen, HelpCircle, CreditCard, Presentation,
  GraduationCap, ChevronRight, Trash2, Wrench, Play, Loader2,
  AlertTriangle, RotateCcw, MoreVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LegacyWorkspace } from "@/components/guided/LegacyWorkspace";

/* ─── Format icons ─── */
const FORMAT_ICONS: Record<string, React.ElementType> = {
  COURSE_LEARN: BookOpen,
  EXAM_PREP: GraduationCap,
  QUIZ_ONLY: HelpCircle,
  FLASHCARDS: CreditCard,
  PRESENTATION: Presentation,
  self_learn: BookOpen,
  exam_prep: GraduationCap,
  quiz_only: HelpCircle,
  flashcards: CreditCard,
  presentation: Presentation,
};

const GOAL_LABELS: Record<string, string> = {
  COURSE_LEARN: "Курс",
  EXAM_PREP: "Подготовка",
  QUIZ_ONLY: "Тесты",
  FLASHCARDS: "Карточки",
  PRESENTATION: "Презентация",
  self_learn: "Курс",
  exam_prep: "Подготовка",
  quiz_only: "Тесты",
  flashcards: "Карточки",
  presentation: "Презентация",
};

/* ─── Guide status types ─── */
type GuideStatus = "ready" | "error" | "generating" | "draft";

function deriveStatus(proj: any): GuideStatus {
  const s = proj.status as string;
  if (s === "error" || s === "failed") return "error";
  if (["generating", "ingesting", "planning"].includes(s)) return "generating";
  if (s === "draft" || s === "uploaded" || s === "ingested") return "draft";
  return "ready";
}


/* ─── Props ─── */
interface MyMaterialsProps {
  onResume: (projectId: string) => void;
  onNewProject: () => void;
}

export const MyMaterials = ({ onResume, onNewProject }: MyMaterialsProps) => {
  const { user } = useAuth();
  const [legacyProjectId, setLegacyProjectId] = useState<string | null>(null);

  const { data: projects = [], refetch: refetchProjects } = useQuery({
    queryKey: ["my-guided-projects", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("projects")
        .select("*, artifacts(count)")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 5000, // Poll for status changes
  });

  const handleDelete = async (id: string) => {
    await supabase.from("artifacts").delete().eq("project_id", id);
    await supabase.from("project_chunks").delete().eq("project_id", id);
    await supabase.from("project_sources").delete().eq("project_id", id);
    await supabase.from("projects").delete().eq("id", id);
    toast.success("Проект удалён");
    refetchProjects();
  };

  const handleRetry = (projectId: string) => {
    // Re-trigger generation by resuming the project
    onResume(projectId);
  };

  /* ─── Legacy view (read-only) ─── */
  if (legacyProjectId) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setLegacyProjectId(null)} className="gap-1.5">
          <ChevronRight className="h-3.5 w-3.5 rotate-180" /> Назад к материалам
        </Button>
        <LegacyWorkspace readOnly />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Мои гайды</h2>
        <Button size="sm" onClick={onNewProject}>
          <Plus className="h-4 w-4 mr-1.5" /> Новый гайд
        </Button>
      </div>

      {/* Empty state */}
      {projects.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <FolderOpen className="h-12 w-12 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">У вас пока нет гайдов</p>
          <Button variant="outline" size="sm" onClick={onNewProject}>
            <Plus className="h-4 w-4 mr-1.5" /> Создать первый
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((proj: any) => {
            const status = deriveStatus(proj);
            const FormatIcon = FORMAT_ICONS[proj.goal] || BookOpen;
            const goalLabel = GOAL_LABELS[proj.goal] || proj.goal || "Гайд";
            const roadmapSteps = (proj.roadmap as any[])?.length || 0;
            const completedSteps = (proj.roadmap as any[])?.filter((s: any) => s.status === "completed").length || 0;
            const progressPercent = roadmapSteps > 0 ? Math.round((completedSteps / roadmapSteps) * 100) : 0;
            const hasProgress = completedSteps > 0; // proxy for last_position

            return (
              <Card key={proj.id} className="p-4 space-y-3 hover:border-primary/30 transition-all group">
                {/* Top row: icon + title + kebab */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                      status === "error" ? "bg-destructive/10" :
                      status === "generating" ? "bg-primary/10 animate-pulse" :
                      status === "draft" ? "bg-muted" : "bg-primary/10"
                    )}>
                      {status === "error" ? <AlertTriangle className="h-4 w-4 text-destructive" /> :
                       status === "generating" ? <Loader2 className="h-4 w-4 text-primary animate-spin" /> :
                       <FormatIcon className="h-4 w-4 text-primary" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{proj.title}</p>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(proj.updated_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                        <span className="text-foreground/40">·</span>
                        <span>{goalLabel}</span>
                      </div>
                    </div>
                  </div>

                  {/* Kebab menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all p-1 rounded">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setLegacyProjectId(proj.id)}>
                        <Wrench className="h-3.5 w-3.5 mr-2" /> Открыть в legacy
                      </DropdownMenuItem>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Удалить
                          </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Удалить проект?</AlertDialogTitle>
                            <AlertDialogDescription>Все данные проекта будут безвозвратно удалены.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Отмена</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(proj.id)}>Удалить</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

              {/* Status-specific content */}
                {status === "error" && (
                  <div className="flex items-center gap-2 text-[12px] text-destructive">
                    <AlertTriangle className="h-3 w-3" />
                    <span>Ошибка генерации</span>
                  </div>
                )}

                {status === "generating" && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-[12px] text-primary">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Генерация… {(proj as any).ingest_progress > 0 ? `${(proj as any).ingest_progress}%` : ""}</span>
                    </div>
                    {(proj as any).ingest_progress > 0 && (
                      <div className="h-1 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary transition-all" style={{ width: `${(proj as any).ingest_progress}%` }} />
                      </div>
                    )}
                  </div>
                )}

                {status === "draft" && (
                  <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Черновик</span>
                  </div>
                )}

                {status === "ready" && roadmapSteps > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{completedSteps}/{roadmapSteps} шагов</span>
                      <span>{progressPercent}%</span>
                    </div>
                    <div className="flex gap-0.5">
                      {(proj.roadmap as any[]).map((s: any, i: number) => (
                        <div key={i} className={cn("h-1.5 flex-1 rounded-full",
                          s.status === "completed" ? "bg-accent" :
                          s.status === "available" ? "bg-primary" : "bg-muted")} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Action button */}
                {status === "error" ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full text-xs gap-1.5"
                    onClick={() => handleRetry(proj.id)}
                  >
                    <RotateCcw className="h-3 w-3" /> Повторить
                  </Button>
                ) : status === "generating" ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full text-xs gap-1.5"
                    disabled
                  >
                    <Loader2 className="h-3 w-3 animate-spin" /> Генерация…
                  </Button>
                ) : status === "draft" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs gap-1.5"
                    onClick={() => onResume(proj.id)}
                  >
                    <Wrench className="h-3 w-3" /> Продолжить настройку
                  </Button>
                ) : (
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full text-xs gap-1.5"
                    onClick={() => onResume(proj.id)}
                  >
                    {hasProgress ? (
                      <><Play className="h-3 w-3" /> Продолжить изучение</>
                    ) : (
                      <><BookOpen className="h-3 w-3" /> Начать изучать</>
                    )}
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
