import { TopHeader } from "./TopHeader";
import { useAchievementNotifications } from "@/hooks/useAchievementNotifications";

export function AppLayout({ children }: { children: React.ReactNode }) {
  useAchievementNotifications();

  return (
    <div className="flex flex-col min-h-screen w-full bg-background">
      <TopHeader />
      <main className="flex-1 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
