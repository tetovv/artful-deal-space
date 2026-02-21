import { useUserRole } from "@/hooks/useUserRole";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, ArrowLeft } from "lucide-react";
import { getMyDealsRoute } from "@/lib/roleRoutes";

interface RoleGuardProps {
  /** Roles that are BLOCKED from accessing this page */
  blockedRoles?: ("creator" | "advertiser" | "moderator" | "user")[];
  /** Roles that are ALLOWED — if specified, only these can access */
  allowedRoles?: ("creator" | "advertiser" | "moderator" | "user")[];
  /** Where to redirect */
  fallbackUrl?: string;
  fallbackLabel?: string;
  children: React.ReactNode;
}

export function RoleGuard({ blockedRoles, allowedRoles, fallbackUrl, fallbackLabel, children }: RoleGuardProps) {
  const { isCreator, isAdvertiser, isModerator, isUser, isLoading, primaryRole } = useUserRole();
  const navigate = useNavigate();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Загрузка...</div>
      </div>
    );
  }

  const roleMap = { creator: isCreator, advertiser: isAdvertiser, moderator: isModerator, user: isUser };

  let blocked = false;
  if (blockedRoles) {
    blocked = blockedRoles.some((r) => roleMap[r]);
  }
  if (allowedRoles) {
    blocked = !allowedRoles.some((r) => roleMap[r]);
    // Moderators always pass
    if (isModerator) blocked = false;
  }

  if (blocked) {
    // Debug logging — helps identify which links route users to forbidden pages
    console.warn(
      `[RoleGuard] BLOCKED route="${location.pathname}" detectedRole="${primaryRole}" blockedRoles=${JSON.stringify(blockedRoles)} allowedRoles=${JSON.stringify(allowedRoles)}`
    );

    // Role-aware fallback
    const resolvedUrl = fallbackUrl ?? getMyDealsRoute(primaryRole);
    const resolvedLabel = fallbackLabel ?? (isCreator ? "К моим сделкам" : isAdvertiser ? "К моим сделкам" : "Вернуться на главную");

    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Shield className="h-10 w-10 text-muted-foreground" />
        <div className="text-center space-y-1">
          <p className="text-[16px] font-semibold text-foreground">Эта страница недоступна для вашей роли</p>
          <p className="text-[13px] text-muted-foreground">
            Данный раздел предназначен для другой категории пользователей.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate(resolvedUrl)}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          {resolvedLabel}
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
