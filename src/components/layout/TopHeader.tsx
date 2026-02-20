import { Home, Compass, Palette, Megaphone, Store, Shield, Brain, Settings, Bell, Sun, Moon, LogOut, Menu, X, User, ShoppingBag, Check, CheckCheck, Rss, Library, Wallet, Plus, Minus } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useNotifications } from "@/hooks/useNotifications";
import { useUserBalance } from "@/hooks/useDealData";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

/* ─── Balance Indicator ─── */
function BalanceIndicator() {
  const { user } = useAuth();
  const { data: balance } = useUserBalance();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  const handleTopUp = async () => {
    const val = parseInt(amount);
    if (!val || val <= 0) { toast.error("Введите корректную сумму"); return; }
    setLoading(true);
    try {
      const current = balance?.available || 0;
      const { error } = await supabase
        .from("user_balances")
        .update({ available: current + val })
        .eq("user_id", user.id);
      if (error) throw error;
      toast.success(`Баланс пополнен на ${val.toLocaleString()} ₽`);
      setAmount("");
      setOpen(false);
    } catch { toast.error("Ошибка пополнения"); }
    finally { setLoading(false); }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-medium bg-success/10 text-success hover:bg-success/20 transition-colors"
      >
        <Wallet className="h-3.5 w-3.5" />
        {(balance?.available || 0).toLocaleString()} ₽
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg">Баланс</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-muted-foreground text-xs">Доступно</p>
                <p className="text-lg font-bold text-foreground">{(balance?.available || 0).toLocaleString()} ₽</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-muted-foreground text-xs">В резерве</p>
                <p className="text-lg font-bold text-foreground">{(balance?.reserved || 0).toLocaleString()} ₽</p>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Пополнить баланс</p>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Сумма, ₽"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleTopUp} disabled={loading} size="sm" className="h-10 px-4">
                  <Plus className="h-4 w-4 mr-1" />
                  {loading ? "…" : "Пополнить"}
                </Button>
              </div>
              <div className="flex gap-1.5">
                {[1000, 5000, 10000, 50000].map((v) => (
                  <button
                    key={v}
                    onClick={() => setAmount(String(v))}
                    className="text-xs px-2 py-1 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                  >
                    {v.toLocaleString()} ₽
                  </button>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  roles?: string[];
}

const allNavItems: NavItem[] = [
  { title: "Главная", url: "/", icon: Home, roles: ["user"] },
  { title: "Главная", url: "/explore", icon: Home, roles: ["creator", "advertiser", "moderator"] },
  { title: "Подписки", url: "/subscriptions", icon: Rss },
  { title: "Студия", url: "/creator-studio", icon: Palette, roles: ["creator", "moderator"] },
  { title: "Биржа", url: "/ad-studio", icon: Megaphone, roles: ["advertiser", "moderator"] },
  { title: "Предложения", url: "/marketplace", icon: Store, roles: ["creator", "moderator"] },
  
  { title: "AI", url: "/ai-workspace", icon: Brain },
  { title: "Библиотека", url: "/library", icon: Library },
];

const roleLabels: Record<string, string> = {
  user: "Пользователь",
  creator: "Автор",
  advertiser: "Рекламодатель",
  moderator: "Модератор",
  support: "Поддержка",
};

const roleBadgeColors: Record<string, string> = {
  user: "bg-secondary text-secondary-foreground",
  creator: "bg-primary/10 text-primary",
  advertiser: "bg-warning/10 text-warning",
  moderator: "bg-destructive/10 text-destructive",
  support: "bg-info/10 text-info",
};

const notifTypeIcons: Record<string, string> = {
  deal: "🤝",
  message: "💬",
  purchase: "🛒",
  info: "ℹ️",
};

export function TopHeader() {
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { primaryRole, isCreator, isAdvertiser, isModerator } = useUserRole();
  const { notifications, unreadCount, markAsRead, markAllRead } = useNotifications();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isRegularUser = !isCreator && !isAdvertiser && !isModerator;
  const visibleItems = allNavItems.filter((item) => {
    if (!item.roles) return true;
    if (isModerator) return true;
    if (item.roles.includes("user")) return isRegularUser;
    return item.roles.some((r) =>
      r === "creator" ? isCreator : r === "advertiser" ? isAdvertiser : false
    );
  });

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <>
      <header className="sticky top-0 z-50 h-14 border-b border-border bg-card/80 backdrop-blur-xl flex items-center px-4 lg:px-6 gap-4">
        <NavLink to="/" className="flex items-center gap-2 shrink-0 mr-2">
          <span className="text-lg font-bold gradient-text tracking-tight">MediaOS</span>
        </NavLink>

        <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
          {visibleItems.map((item) => (
            <NavLink
              key={item.url}
              to={item.url}
              end={item.url === "/"}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
              activeClassName="text-primary bg-primary/10 font-medium"
            >
              <item.icon className="h-4 w-4" />
              <span>{item.title}</span>
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3 ml-auto">
          <BalanceIndicator />

          <span className={cn("hidden sm:inline-flex text-xs font-medium px-2.5 py-1 rounded-full", roleBadgeColors[primaryRole] || roleBadgeColors.user)}>
            {roleLabels[primaryRole] || "Пользователь"}
          </span>

          <button
            onClick={toggleTheme}
            className="h-9 w-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </button>

          {/* Notifications dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-9 w-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors relative">
                <Bell className="h-[18px] w-[18px]" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 flex items-center justify-center bg-primary text-primary-foreground text-[10px] font-bold rounded-full">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <div className="flex items-center justify-between px-3 py-2">
                <p className="text-sm font-semibold">Уведомления</p>
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllRead.mutate()}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <CheckCheck className="h-3 w-3" /> Прочитать все
                  </button>
                )}
              </div>
              <DropdownMenuSeparator />
              <ScrollArea className="max-h-72">
                {notifications.length === 0 ? (
                  <div className="px-3 py-6 text-center text-xs text-muted-foreground">Нет уведомлений</div>
                ) : (
                  notifications.map((n) => (
                    <DropdownMenuItem
                      key={n.id}
                      className={cn("flex items-start gap-3 px-3 py-2.5 cursor-pointer", !n.read && "bg-primary/5")}
                      onClick={() => {
                        if (!n.read) markAsRead.mutate(n.id);
                        if (n.link) navigate(n.link);
                      }}
                    >
                      <span className="text-lg shrink-0 mt-0.5">{notifTypeIcons[n.type] || "ℹ️"}</span>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-xs", !n.read && "font-semibold")}>{n.title}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{n.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {new Date(n.created_at).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      {!n.read && <div className="h-2 w-2 bg-primary rounded-full shrink-0 mt-1.5" />}
                    </DropdownMenuItem>
                  ))
                )}
              </ScrollArea>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary hover:bg-primary/20 transition-colors">
                {(profile?.display_name || "U").charAt(0).toUpperCase()}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-3 py-2">
                <p className="text-sm font-medium">{profile?.display_name || "Пользователь"}</p>
                <p className="text-xs text-muted-foreground">{profile?.email || ""}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/my-purchases")}>
                <ShoppingBag className="h-4 w-4 mr-2" />
                Мои покупки
              </DropdownMenuItem>
              {isModerator && (
                <DropdownMenuItem onClick={() => navigate("/admin")}>
                  <Settings className="h-4 w-4 mr-2" />
                  Админ-панель
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => navigate(`/creator/me`)}>
                <User className="h-4 w-4 mr-2" />
                Мой профиль
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/settings")}>
                <Settings className="h-4 w-4 mr-2" />
                Настройки
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                <LogOut className="h-4 w-4 mr-2" />
                Выйти
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-b border-border bg-card/95 backdrop-blur-xl overflow-hidden z-40 sticky top-14"
          >
            <nav className="p-3 space-y-1">
              {visibleItems.map((item) => (
                <NavLink
                  key={item.url}
                  to={item.url}
                  end={item.url === "/"}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  activeClassName="text-primary bg-primary/10 font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </NavLink>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
