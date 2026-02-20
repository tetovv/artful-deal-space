import { GuidedWorkspace } from "@/components/guided/GuidedWorkspace";

interface AIGuideFlowProps {
  resumeProjectId?: string | null;
  onResumeComplete?: () => void;
}

export const AIGuideFlow = ({ resumeProjectId, onResumeComplete }: AIGuideFlowProps) => {
  return (
    <GuidedWorkspace
      resumeProjectId={resumeProjectId}
      onResumeComplete={onResumeComplete}
    />
  );
};
