import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { DealWorkspace } from "@/components/ad-studio/DealWorkspace";
import { useAdvertiserVerification } from "@/components/ad-studio/AdvertiserSettings";
import { AdvertiserSettings } from "@/components/ad-studio/AdvertiserSettings";
import { BuiltInAds } from "@/components/ad-studio/BuiltInAds";
import { BirzhaTab } from "@/components/ad-studio/BirzhaTab";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Megaphone, MonitorPlay, Settings } from "lucide-react";


/* ── Main AdStudio Page ── */
type AdStudioTab = "birzha" | "deals" | "builtin" | "settings";

const AdStudio = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<AdStudioTab>("birzha");
  const { isVerified } = useAdvertiserVerification();

  // Auto-switch to deals tab when navigated with openDealId
  useEffect(() => {
    const state = location.state as { openDealId?: string } | null;
    if (state?.openDealId) {
      setActiveTab("deals");
    }
  }, [location.state]);

  const goToSettings = () => setActiveTab("settings");

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] max-h-[calc(100vh-3.5rem)]">
      {/* Tab switcher */}
      <div className="px-4 pt-3 pb-0 bg-card border-b border-border">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AdStudioTab)}>
          <TabsList className="bg-muted/50">
            <TabsTrigger value="birzha" className="text-sm gap-1.5">
              <Search className="h-3.5 w-3.5" />
              Биржа авторов
            </TabsTrigger>
            <TabsTrigger value="deals" className="text-sm gap-1.5">
              <Megaphone className="h-3.5 w-3.5" />
              Мои сделки
            </TabsTrigger>
            <TabsTrigger value="builtin" className="text-sm gap-1.5">
              <MonitorPlay className="h-3.5 w-3.5" />
              Встроенная реклама
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-sm gap-1.5 relative">
              <Settings className="h-3.5 w-3.5" />
              Настройки
              {!isVerified && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-yellow-500" />
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tab content */}
      {activeTab === "birzha" && <BirzhaTab isVerified={isVerified} onGoToSettings={goToSettings} />}
      {activeTab === "deals" && <DealWorkspace />}
      {activeTab === "builtin" && <BuiltInAds isVerified={isVerified} onGoToSettings={goToSettings} />}
      {activeTab === "settings" && <AdvertiserSettings />}
    </div>
  );
};

export default AdStudio;
