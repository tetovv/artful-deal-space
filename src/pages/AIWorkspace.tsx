import { useState } from "react";
import { PageTransition } from "@/components/layout/PageTransition";
import { AIGuideFlow } from "@/components/guided/AIGuideFlow";
import { MyMaterials } from "@/components/guided/MyMaterials";
import { cn } from "@/lib/utils";
import { Brain, FolderOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Tab = "generate" | "my-materials";

const AIWorkspace = () => {
  const [tab, setTab] = useState<Tab>("generate");
  const [resumeProjectId, setResumeProjectId] = useState<string | null>(null);

  const handleResume = (projectId: string) => {
    setResumeProjectId(projectId);
    setTab("generate");
  };

  return (
    <PageTransition>
      <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-foreground">AI Workplace</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Загрузите материалы → выберите цель → получите гайд.
            <br />
            Дальше учитесь по шагам в плеере.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-lg bg-muted/50 w-fit">
          <button onClick={() => setTab("generate")}
            className={cn("flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
              tab === "generate" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            <Brain className="h-4 w-4" /> Сгенерировать
          </button>
          <button onClick={() => setTab("my-materials")}
            className={cn("flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
              tab === "my-materials" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            <FolderOpen className="h-4 w-4" /> Мои материалы
          </button>
        </div>

        {tab === "generate" ? (
          <AIGuideFlow resumeProjectId={resumeProjectId} onResumeComplete={() => setResumeProjectId(null)} />
        ) : (
          <MyMaterials onResume={handleResume} onNewProject={() => setTab("generate")} />
        )}
      </div>
    </PageTransition>
  );
};

export default AIWorkspace;
