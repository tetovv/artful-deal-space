import { Home, Compass, Palette, Megaphone, Store, Brain, Settings, LogOut, ChevronLeft, ChevronRight, Sun, Moon, Library, Trophy, Users } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  /** If set, only these roles see this item */
  roles?: ("creator" | "advertiser" | "moderator" | "user")[];
  /** If set, these roles are hidden from this item */
  hideForRoles?: ("creator" | "advertiser" | "moderator" | "user")[];
}

const allMainNav: NavItem[] = [
  { title: "Главная", url: "/", icon: Home },
  { title: "Каталог", url: "/explore", icon: Compass },
  { title: "Подписки", url: "/subscriptions", icon: Users },
  { title: "Библиотека", url: "/library", icon: Library },
  { title: "Студия автора", url: "/creator-studio", icon: Palette, hideForRoles: ["advertiser"] },
  { title: "Рекламная студия", url: "/ad-studio", icon: Megaphone },
  { title: "Предложения", url: "/marketplace", icon: Store, hideForRoles: ["creator"] },
  { title: "AI Workspace", url: "/ai-workspace", icon: Brain },
  { title: "Достижения", url: "/achievements", icon: Trophy },
];

const bottomNav = [
  { title: "Админ", url: "/admin", icon: Settings },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isCreator, isAdvertiser, isModerator } = useUserRole();
  const navigate = useNavigate();

  const mainNav = useMemo(() => {
    return allMainNav.filter((item) => {
      if (item.hideForRoles) {
        if (item.hideForRoles.includes("creator") && isCreator && !isModerator) return false;
        if (item.hideForRoles.includes("advertiser") && isAdvertiser && !isModerator) return false;
      }
      if (item.roles) {
        const roleMap: Record<string, boolean> = { creator: isCreator, advertiser: isAdvertiser, moderator: isModerator };
        return item.roles.some((r) => roleMap[r]) || isModerator;
      }
      return true;
    });
  }, [isCreator, isAdvertiser, isModerator]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <aside className={cn(
      "flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 sticky top-0",
      collapsed ? "w-16" : "w-60"
    )}>
      {/* Logo */}
      <div className="flex items-center h-14 px-4 border-b border-sidebar-border">
        {!collapsed && (
          <span className="text-lg font-bold gradient-text tracking-tight">MediaOS</span>
        )}
        {collapsed && (
          <span className="text-lg font-bold gradient-text mx-auto">M</span>
        )}
      </div>

      {/* Main Nav */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {mainNav.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            end={item.url === "/"}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors text-sm",
              collapsed && "justify-center px-2"
            )}
            activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
          >
            <item.icon className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && <span>{item.title}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-sidebar-border py-3 px-2 space-y-1">
        {bottomNav.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors text-sm",
              collapsed && "justify-center px-2"
            )}
            activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
          >
            <item.icon className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && <span>{item.title}</span>}
          </NavLink>
        ))}

        {/* User */}
        <div className={cn("flex items-center gap-3 px-3 py-2.5", collapsed && "justify-center px-2")}>
          <div className="h-7 w-7 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-medium text-sidebar-accent-foreground shrink-0">
            {(profile?.display_name || "U").charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-sidebar-accent-foreground truncate">{profile?.display_name || "Пользователь"}</p>
              <p className="text-[10px] text-sidebar-muted truncate">{profile?.email || ""}</p>
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors text-sm w-full",
            collapsed && "justify-center px-2"
          )}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {!collapsed && <span className="text-xs">{theme === "dark" ? "Светлая тема" : "Тёмная тема"}</span>}
        </button>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors text-sm w-full",
            collapsed && "justify-center px-2"
          )}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="text-xs">Выйти</span>}
        </button>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors text-sm w-full",
            collapsed && "justify-center px-2"
          )}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!collapsed && <span className="text-xs">Свернуть</span>}
        </button>
      </div>
    </aside>
  );
}
