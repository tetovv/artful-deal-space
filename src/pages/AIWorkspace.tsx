import { useState } from "react";
import { PageTransition } from "@/components/layout/PageTransition";
import { LegacyWorkspace } from "@/components/guided/LegacyWorkspace";
import { GuidedWorkspace } from "@/components/guided/GuidedWorkspace";
import { cn } from "@/lib/utils";

const AIWorkspace = () => {
  const [tab, setTab] = useState<"guided" | "legacy">("guided");

  return (
    <PageTransition>
      <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-foreground">AI Workspace</h1>
          <p className="text-sm text-muted-foreground">Генерируйте курсы, квизы, презентации и документы с помощью AI</p>
        </div>

        {/* Top tabs */}
        <div className="flex gap-1 p-1 rounded-lg bg-muted/50 w-fit">
          <button onClick={() => setTab("guided")}
            className={cn("px-4 py-2 rounded-md text-sm font-medium transition-all",
              tab === "guided" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            Guided AI
          </button>
          <button onClick={() => setTab("legacy")}
            className={cn("px-4 py-2 rounded-md text-sm font-medium transition-all",
              tab === "legacy" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            Курсы / Презентации
          </button>
        </div>

        {tab === "guided" ? <GuidedWorkspace /> : <LegacyWorkspace />}
      </div>
    </PageTransition>
  );
};

export default AIWorkspace;
