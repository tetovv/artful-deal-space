import { useUserRole } from "@/hooks/useUserRole";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, ArrowLeft } from "lucide-react";

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

export function RoleGuard({ blockedRoles, allowedRoles, fallbackUrl = "/", fallbackLabel = "Вернуться на главную", children }: RoleGuardProps) {
  const { isCreator, isAdvertiser, isModerator, isUser, isLoading } = useUserRole();
  const navigate = useNavigate();

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
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Shield className="h-10 w-10 text-muted-foreground" />
        <div className="text-center space-y-1">
          <p className="text-[16px] font-semibold text-foreground">Эта страница недоступна для вашей роли</p>
          <p className="text-[13px] text-muted-foreground">
            Данный раздел предназначен для другой категории пользователей.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate(fallbackUrl)}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          {fallbackLabel}
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
