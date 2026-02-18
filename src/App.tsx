import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import TrustRating from "./pages/TrustRating";
import AIWorkspace from "./pages/AIWorkspace";
import AdminPanel from "./pages/AdminPanel";
import MyPurchases from "./pages/MyPurchases";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

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
              <Route path="/product/:id" element={<Protected><ProductPage /></Protected>} />
              <Route path="/creator-studio" element={<Protected><CreatorStudio /></Protected>} />
              <Route path="/creator/:id" element={<Protected><CreatorProfile /></Protected>} />
              <Route path="/ad-studio" element={<Protected><AdStudio /></Protected>} />
              <Route path="/marketplace" element={<Protected><Marketplace /></Protected>} />
              <Route path="/trust-rating" element={<Protected><TrustRating /></Protected>} />
              <Route path="/ai-workspace" element={<Protected><AIWorkspace /></Protected>} />
              <Route path="/admin" element={<Protected><AdminPanel /></Protected>} />
              <Route path="/my-purchases" element={<Protected><MyPurchases /></Protected>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
