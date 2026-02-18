import { TopHeader } from "./TopHeader";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen w-full bg-background">
      <TopHeader />
      <main className="flex-1 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
