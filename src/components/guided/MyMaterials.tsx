import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FolderOpen, Plus, Clock, BookOpen, HelpCircle, CreditCard, Presentation, GraduationCap, ChevronRight, Trash2, Wrench } from "lucide-react";
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
import { LegacyWorkspace } from "@/components/guided/LegacyWorkspace";

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

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "Черновик", color: "text-muted-foreground" },
  ingesting: { label: "Извлечение…", color: "text-yellow-600" },
  planning: { label: "Планирование…", color: "text-yellow-600" },
  planned: { label: "Готов к генерации", color: "text-primary" },
  ingested: { label: "Готов к плану", color: "text-primary" },
  completed: { label: "Завершён", color: "text-accent" },
};

interface MyMaterialsProps {
  onResume: (projectId: string) => void;
  onNewProject: () => void;
}

export const MyMaterials = ({ onResume, onNewProject }: MyMaterialsProps) => {
  const { user } = useAuth();
  const [showLegacy, setShowLegacy] = useState(false);

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
  });

  const handleDelete = async (id: string) => {
    await supabase.from("artifacts").delete().eq("project_id", id);
    await supabase.from("project_chunks").delete().eq("project_id", id);
    await supabase.from("project_sources").delete().eq("project_id", id);
    await supabase.from("projects").delete().eq("id", id);
    toast.success("Проект удалён");
    refetchProjects();
  };

  if (showLegacy) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setShowLegacy(false)} className="gap-1.5">
          <ChevronRight className="h-3.5 w-3.5 rotate-180" /> Назад к материалам
        </Button>
        <LegacyWorkspace />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Мои проекты</h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowLegacy(true)} className="gap-1.5 text-muted-foreground">
            <Wrench className="h-3.5 w-3.5" /> Ручной режим (legacy)
          </Button>
          <Button size="sm" onClick={onNewProject}>
            <Plus className="h-4 w-4 mr-1.5" /> Новый
          </Button>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <FolderOpen className="h-12 w-12 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">У вас пока нет проектов</p>
          <Button variant="outline" size="sm" onClick={onNewProject}>
            <Plus className="h-4 w-4 mr-1.5" /> Создать первый
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((proj: any) => {
            const FormatIcon = FORMAT_ICONS[proj.goal] || BookOpen;
            const artifactCount = proj.artifacts?.[0]?.count || 0;
            const roadmapSteps = (proj.roadmap as any[])?.length || 0;
            const completedSteps = (proj.roadmap as any[])?.filter((s: any) => s.status === "completed").length || 0;
            const statusInfo = STATUS_LABELS[proj.status] || { label: proj.status, color: "text-muted-foreground" };
            const isIncomplete = ["draft", "ingesting", "planning", "ingested", "planned"].includes(proj.status) && artifactCount === 0;

            return (
              <Card key={proj.id} className="p-4 space-y-3 hover:border-primary/30 transition-all group">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FormatIcon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{proj.title}</p>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(proj.updated_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                        <span className={cn("ml-1", statusInfo.color)}>• {statusInfo.label}</span>
                      </p>
                    </div>
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
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
                </div>

                {roadmapSteps > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{completedSteps}/{roadmapSteps} шагов</span>
                      <span>{artifactCount} артефактов</span>
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

                <Button variant={isIncomplete ? "default" : "outline"} size="sm" className="w-full text-xs" onClick={() => onResume(proj.id)}>
                  {isIncomplete ? "Повторить" : "Продолжить"} <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
