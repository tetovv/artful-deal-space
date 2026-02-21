import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import Home from "./pages/Home";
import Explore from "./pages/Explore";
import ProductPage from "./pages/ProductPage";
import CreatorStudio from "./pages/CreatorStudio";
import CreatorProfile from "./pages/CreatorProfile";
import AdStudio from "./pages/AdStudio";
import Marketplace from "./pages/Marketplace";
// TrustRating merged into Marketplace
import AIWorkspace from "./pages/AIWorkspace";
import AdminPanel from "./pages/AdminPanel";
import MyPurchases from "./pages/MyPurchases";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import Library from "./pages/Library";
import Subscriptions from "./pages/Subscriptions";
import Achievements from "./pages/Achievements";
import CreatorProposal from "./pages/CreatorProposal";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { useUserRole } from "@/hooks/useUserRole";
import { useEffect } from "react";
import { toast } from "sonner";

const queryClient = new QueryClient();

/** Soft redirect for advertisers hitting /marketplace — it's creator-only */
function MarketplaceGuard() {
  const { isAdvertiser, isLoading } = useUserRole();

  useEffect(() => {
    if (!isLoading && isAdvertiser) {
      toast.info("Раздел «Предложения» доступен только авторам. Перенаправлено в рекламную студию.");
    }
  }, [isLoading, isAdvertiser]);

  if (isLoading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><div className="animate-pulse text-muted-foreground">Загрузка...</div></div>;
  }
  if (isAdvertiser) {
    return <Navigate to="/ad-studio" replace />;
  }
  return <Marketplace />;
}

const Protected = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <AppLayout>{children}</AppLayout>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/" element={<Protected><Home /></Protected>} />
              <Route path="/explore" element={<Protected><Explore /></Protected>} />
              <Route path="/library" element={<Protected><Library /></Protected>} />
              <Route path="/authors" element={<Navigate to="/subscriptions" replace />} />
              <Route path="/subscriptions" element={<Protected><Subscriptions /></Protected>} />
              <Route path="/product/:id" element={<Protected><ProductPage /></Protected>} />
              <Route path="/creator-studio" element={<Protected><CreatorStudio /></Protected>} />
              <Route path="/creator/:id" element={<Protected><CreatorProfile /></Protected>} />
              <Route path="/ad-studio" element={<Protected><AdStudio /></Protected>} />
              <Route path="/marketplace" element={<Protected><MarketplaceGuard /></Protected>} />
              <Route path="/trust-rating" element={<Navigate to="/marketplace" replace />} />
              <Route path="/creator/proposals/:proposalId" element={<Protected><CreatorProposal /></Protected>} />
              <Route path="/ai-workspace" element={<Protected><AIWorkspace /></Protected>} />
              <Route path="/admin" element={<Protected><AdminPanel /></Protected>} />
              <Route path="/my-purchases" element={<Protected><MyPurchases /></Protected>} />
              <Route path="/achievements" element={<Protected><Achievements /></Protected>} />
              {/* legacy redirect removed — now has dedicated page above */}
              <Route path="/settings" element={<Protected><Settings /></Protected>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
