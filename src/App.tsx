import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import Home from "./pages/Home";
import Explore from "./pages/Explore";
import ProductPage from "./pages/ProductPage";
import CreatorStudio from "./pages/CreatorStudio";
import AdStudio from "./pages/AdStudio";
import Marketplace from "./pages/Marketplace";
import TrustRating from "./pages/TrustRating";
import AIWorkspace from "./pages/AIWorkspace";
import AdminPanel from "./pages/AdminPanel";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={<AppLayout><Home /></AppLayout>} />
          <Route path="/explore" element={<AppLayout><Explore /></AppLayout>} />
          <Route path="/product/:id" element={<AppLayout><ProductPage /></AppLayout>} />
          <Route path="/creator-studio" element={<AppLayout><CreatorStudio /></AppLayout>} />
          <Route path="/ad-studio" element={<AppLayout><AdStudio /></AppLayout>} />
          <Route path="/marketplace" element={<AppLayout><Marketplace /></AppLayout>} />
          <Route path="/trust-rating" element={<AppLayout><TrustRating /></AppLayout>} />
          <Route path="/ai-workspace" element={<AppLayout><AIWorkspace /></AppLayout>} />
          <Route path="/admin" element={<AppLayout><AdminPanel /></AppLayout>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
