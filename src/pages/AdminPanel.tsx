import { users, deals, contentItems } from "@/data/mockData";
import { Shield, Users, FileText, AlertTriangle, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const AdminPanel = () => {
  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Панель администратора</h1>
        <p className="text-sm text-muted-foreground">Модерация контента, пользователей и споров</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Пользователи", value: users.length, icon: Users },
          { label: "Контент", value: contentItems.length, icon: FileText },
          { label: "Сделки", value: deals.length, icon: BarChart3 },
          { label: "Споры", value: 1, icon: AlertTriangle },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <s.icon className="h-4 w-4 text-muted-foreground mb-2" />
            <p className="text-2xl font-bold text-card-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Users table */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Пользователи</h2>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-3 text-xs font-medium text-muted-foreground">Имя</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground">Email</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground">Роль</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground">Дата</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="p-3 flex items-center gap-2">
                    <img src={u.avatar} alt="" className="h-6 w-6 rounded-full" />
                    <span className="text-card-foreground">{u.name}</span>
                  </td>
                  <td className="p-3 text-muted-foreground">{u.email}</td>
                  <td className="p-3"><Badge variant="outline" className="text-[10px]">{u.role}</Badge></td>
                  <td className="p-3 text-muted-foreground">{u.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Content moderation */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Контент на модерации</h2>
        <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          <Shield className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
          Нет контента, ожидающего модерации
        </div>
      </section>
    </div>
  );
};

export default AdminPanel;
