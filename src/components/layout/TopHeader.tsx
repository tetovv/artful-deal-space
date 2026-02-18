import { Home, Compass, Palette, Megaphone, Store, Shield, Brain, Settings, Bell, Search, Sun, Moon, LogOut, Menu, X, User } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  roles?: string[]; // if empty — visible to all
}

const allNavItems: NavItem[] = [
  { title: "Главная", url: "/", icon: Home },
  { title: "Каталог", url: "/explore", icon: Compass },
  { title: "Студия", url: "/creator-studio", icon: Palette, roles: ["creator", "moderator"] },
  { title: "Реклама", url: "/ad-studio", icon: Megaphone, roles: ["advertiser", "creator", "moderator"] },
  { title: "Биржа", url: "/marketplace", icon: Store },
  { title: "Рейтинг", url: "/trust-rating", icon: Shield },
  { title: "AI", url: "/ai-workspace", icon: Brain },
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

export function TopHeader() {
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { primaryRole, isCreator, isAdvertiser, isModerator } = useUserRole();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const visibleItems = allNavItems.filter((item) => {
    if (!item.roles) return true;
    if (isModerator) return true;
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
        {/* Logo */}
        <NavLink to="/" className="flex items-center gap-2 shrink-0 mr-2">
          <span className="text-lg font-bold gradient-text tracking-tight">MediaOS</span>
        </NavLink>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 flex-1">
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

        {/* Right section */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Role badge */}
          <span className={cn("hidden sm:inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full", roleBadgeColors[primaryRole] || roleBadgeColors.user)}>
            {roleLabels[primaryRole] || "Пользователь"}
          </span>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* Notifications */}
          <button className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors relative">
            <Bell className="h-4 w-4" />
            <span className="absolute top-1 right-1 h-2 w-2 bg-primary rounded-full" />
          </button>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary hover:bg-primary/20 transition-colors">
                {(profile?.display_name || "U").charAt(0).toUpperCase()}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-3 py-2">
                <p className="text-sm font-medium">{profile?.display_name || "Пользователь"}</p>
                <p className="text-xs text-muted-foreground">{profile?.email || ""}</p>
              </div>
              <DropdownMenuSeparator />
              {isModerator && (
                <DropdownMenuItem onClick={() => navigate("/admin")}>
                  <Settings className="h-4 w-4 mr-2" />
                  Админ-панель
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => navigate(`/creator/${profile?.display_name || "me"}`)}>
                <User className="h-4 w-4 mr-2" />
                Мой профиль
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                <LogOut className="h-4 w-4 mr-2" />
                Выйти
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* Mobile menu */}
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
