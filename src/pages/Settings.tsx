import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save, User, Tags, MapPin, Upload, Loader2, Shield, Bell, Lock, Monitor, Globe, LayoutDashboard, Accessibility, UserX, ShieldCheck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const INTEREST_OPTIONS = [
  "Технологии", "Маркетинг", "Дизайн", "Бизнес", "Образование",
  "Финансы", "Здоровье", "Спорт", "Музыка", "Фото", "Видео",
  "Программирование", "AI", "Криптовалюта", "Путешествия",
];

const ROLE_OPTIONS: { value: AppRole; label: string; description: string }[] = [
  { value: "user", label: "Пользователь", description: "Просмотр и покупка контента" },
  { value: "creator", label: "Автор", description: "Создание и продажа контента" },
  { value: "advertiser", label: "Рекламодатель", description: "Размещение рекламы и сделки" },
];

const SECTIONS = [
  { id: "profile", label: "Профиль", icon: User },
  { id: "role", label: "Роль", icon: Shield },
  { id: "interests", label: "Интересы", icon: Tags },
  { id: "notifications", label: "Уведомления", icon: Bell },
  { id: "privacy", label: "Приватность", icon: Lock },
  { id: "blocked", label: "Блокировки", icon: UserX },
  { id: "content", label: "Контент", icon: Monitor },
  { id: "accessibility", label: "Доступность", icon: Accessibility },
  { id: "region", label: "Регион", icon: Globe },
  { id: "platform", label: "Платформа", icon: LayoutDashboard },
  { id: "security", label: "Безопасность", icon: ShieldCheck },
] as const;

function useLocalSettings() {
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem("mediaos-settings");
    return saved ? JSON.parse(saved) : {
      emailNotifications: true,
      pushNotifications: true,
      dealNotifications: true,
      messageNotifications: true,
      profilePublic: true,
      showActivity: true,
      showPurchases: false,
      autoplay: true,
      contentLanguage: "ru",
      videoQuality: "auto",
      matureContent: false,
    };
  });

  const update = (key: string, value: any) => {
    setSettings((prev: any) => {
      const next = { ...prev, [key]: value };
      localStorage.setItem("mediaos-settings", JSON.stringify(next));
      return next;
    });
  };

  return { settings, update };
}

function SettingToggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export default function Settings() {
  const { user, profile } = useAuth();
  const { primaryRole } = useUserRole();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { settings, update: updateSetting } = useLocalSettings();
  const [activeSection, setActiveSection] = useState("profile");

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [geo, setGeo] = useState("");
  const [niche, setNiche] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<AppRole>("user");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name, bio, avatar_url, geo, niche")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setDisplayName(data.display_name || "");
          setBio(data.bio || "");
          setAvatarUrl(data.avatar_url || "");
          setGeo(data.geo || "");
          setNiche(data.niche || []);
        }
      });
  }, [user]);

  useEffect(() => {
    setSelectedRole(primaryRole);
  }, [primaryRole]);

  const toggleNiche = (tag: string) => {
    setNiche((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) { toast.error("Выберите изображение"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Максимальный размер — 2 МБ"); return; }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (uploadError) { toast.error("Ошибка загрузки"); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatarUrl(urlData.publicUrl + "?t=" + Date.now());
    setUploading(false);
    toast.success("Аватар загружен");
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName, bio, avatar_url: avatarUrl, geo, niche })
      .eq("user_id", user.id);
    if (error) { toast.error("Не удалось сохранить профиль"); setSaving(false); return; }

    if (selectedRole !== primaryRole) {
      await supabase.from("user_roles").delete().eq("user_id", user.id).in("role", ["user", "creator", "advertiser"]);
      await supabase.from("user_roles").insert({ user_id: user.id, role: selectedRole });
      queryClient.invalidateQueries({ queryKey: ["user-roles"] });
    }

    localStorage.setItem("mediaos-interests", JSON.stringify(niche));
    queryClient.invalidateQueries({ queryKey: ["ai-recommendations"] });
    setSaving(false);
    toast.success("Профиль обновлён");
  };

  const handleChangePassword = async () => {
    if (!user?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email);
    if (error) { toast.error("Ошибка отправки"); return; }
    toast.success("Письмо для смены пароля отправлено на вашу почту");
  };

  const renderSection = () => {
    switch (activeSection) {
      case "profile":
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><User className="h-4 w-4" /> Основная информация</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">Отображаемое имя</Label>
                <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Ваше имя" />
              </div>
              <div className="space-y-2">
                <Label>Аватар</Label>
                <div className="flex gap-4 items-center">
                  <div className="relative h-16 w-16 rounded-full overflow-hidden border-2 border-border bg-muted flex items-center justify-center shrink-0">
                    {avatarUrl ? <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" /> : <User className="h-6 w-6 text-muted-foreground" />}
                    {uploading && <div className="absolute inset-0 bg-background/60 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                      <Upload className="h-4 w-4 mr-2" />Загрузить фото
                    </Button>
                    <p className="text-[11px] text-muted-foreground">JPG, PNG до 2 МБ</p>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">О себе</Label>
                <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Расскажите о себе..." rows={3} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="geo" className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Регион</Label>
                <Input id="geo" value={geo} onChange={(e) => setGeo(e.target.value)} placeholder="Москва, Россия" />
              </div>
            </CardContent>
          </Card>
        );
      case "role":
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Shield className="h-4 w-4" /> Роль</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">Выберите основную роль — от неё зависят доступные разделы</p>
              <div className="grid gap-2">
                {ROLE_OPTIONS.map((r) => (
                  <button key={r.value} onClick={() => setSelectedRole(r.value)}
                    className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-all ${selectedRole === r.value ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border hover:border-muted-foreground/30"}`}>
                    <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${selectedRole === r.value ? "border-primary" : "border-muted-foreground/40"}`}>
                      {selectedRole === r.value && <div className="h-2 w-2 rounded-full bg-primary" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{r.label}</p>
                      <p className="text-xs text-muted-foreground">{r.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      case "interests":
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Tags className="h-4 w-4" /> Интересы</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">Выберите интересы для персонализированных рекомендаций</p>
              <div className="flex flex-wrap gap-2">
                {INTEREST_OPTIONS.map((tag) => (
                  <Badge key={tag} variant={niche.includes(tag) ? "default" : "outline"} className="cursor-pointer transition-all" onClick={() => toggleNiche(tag)}>{tag}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      case "notifications":
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Bell className="h-4 w-4" /> Уведомления</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <SettingToggle label="Email-уведомления" description="Получать уведомления на почту" checked={settings.emailNotifications} onChange={(v) => updateSetting("emailNotifications", v)} />
              <SettingToggle label="Push-уведомления" description="Уведомления в браузере" checked={settings.pushNotifications} onChange={(v) => updateSetting("pushNotifications", v)} />
              <SettingToggle label="Сделки и предложения" description="Уведомления о новых сделках" checked={settings.dealNotifications} onChange={(v) => updateSetting("dealNotifications", v)} />
              <SettingToggle label="Сообщения" description="Уведомления о новых сообщениях" checked={settings.messageNotifications} onChange={(v) => updateSetting("messageNotifications", v)} />
            </CardContent>
          </Card>
        );
      case "privacy":
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Lock className="h-4 w-4" /> Приватность</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-1">Видимость профиля</p>
                <p className="text-xs text-muted-foreground mb-2">Кто может видеть ваш профиль</p>
                <Select value={settings.profileVisibility || "public"} onValueChange={(v) => updateSetting("profileVisibility", v)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Все пользователи</SelectItem>
                    <SelectItem value="subscribers">Только подписчики (платные и бесплатные)</SelectItem>
                    <SelectItem value="paid">Только платные подписчики</SelectItem>
                    <SelectItem value="private">Скрытый профиль</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <SettingToggle label="Показывать активность" description="Другие видят вашу недавнюю активность" checked={settings.showActivity} onChange={(v) => updateSetting("showActivity", v)} />
              <SettingToggle label="Показывать покупки" description="Показывать список покупок в профиле" checked={settings.showPurchases} onChange={(v) => updateSetting("showPurchases", v)} />
            </CardContent>
          </Card>
        );
      case "blocked":
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><UserX className="h-4 w-4" /> Управление заблокированными пользователями</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">Здесь отображаются пользователи, которых вы заблокировали. Заблокированные пользователи не могут видеть ваш профиль, контент и отправлять вам сообщения.</p>
              <div className="text-center py-8 text-muted-foreground rounded-xl border border-border bg-muted/30 text-sm">
                Нет заблокированных пользователей
              </div>
            </CardContent>
          </Card>
        );
      case "content":
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Monitor className="h-4 w-4" /> Контент</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <SettingToggle label="Автовоспроизведение" description="Автоматически воспроизводить видео при открытии" checked={settings.autoplay} onChange={(v) => updateSetting("autoplay", v)} />
              <SettingToggle label="Контент 18+" description="Показывать контент с возрастным ограничением" checked={settings.matureContent} onChange={(v) => updateSetting("matureContent", v)} />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Качество видео</p>
                  <p className="text-xs text-muted-foreground">Качество воспроизведения по умолчанию</p>
                </div>
                <Select value={settings.videoQuality} onValueChange={(v) => updateSetting("videoQuality", v)}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Авто</SelectItem>
                    <SelectItem value="1080p">1080p</SelectItem>
                    <SelectItem value="720p">720p</SelectItem>
                    <SelectItem value="480p">480p</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Язык контента</p>
                  <p className="text-xs text-muted-foreground">Предпочтительный язык</p>
                </div>
                <Select value={settings.contentLanguage} onValueChange={(v) => updateSetting("contentLanguage", v)}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ru">Русский</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="any">Любой</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        );
      case "accessibility":
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Accessibility className="h-4 w-4" /> Доступность</CardTitle>
              <p className="text-xs text-muted-foreground">Настройки для комфортного использования</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <p className="text-sm font-medium mb-1">Размер шрифта</p>
                <p className="text-xs text-muted-foreground mb-3">{settings.fontSize === "small" ? "Маленький" : settings.fontSize === "large" ? "Большой" : settings.fontSize === "xlarge" ? "Очень большой" : "Средний"}</p>
                <input
                  type="range"
                  min={0}
                  max={3}
                  value={settings.fontSize === "small" ? 0 : settings.fontSize === "large" ? 2 : settings.fontSize === "xlarge" ? 3 : 1}
                  onChange={(e) => {
                    const vals = ["small", "medium", "large", "xlarge"];
                    updateSetting("fontSize", vals[Number(e.target.value)]);
                  }}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-muted-foreground mt-1">
                  <span className="text-xs">A</span>
                  <span className="text-sm">A</span>
                  <span className="text-base">A</span>
                  <span className="text-lg">A</span>
                </div>
              </div>
              <SettingToggle label="Уменьшить анимации" description="Отключить или упростить анимации интерфейса" checked={settings.reduceMotion || false} onChange={(v) => updateSetting("reduceMotion", v)} />
              <SettingToggle label="Высокий контраст" description="Увеличить контрастность цветов для лучшей читаемости" checked={settings.highContrast || false} onChange={(v) => updateSetting("highContrast", v)} />
            </CardContent>
          </Card>
        );
      case "region":
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Globe className="h-4 w-4" /> Язык и регион</CardTitle>
              <p className="text-xs text-muted-foreground">Локализация и форматирование</p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <Label className="text-sm font-medium">Язык интерфейса</Label>
                <Select value={settings.uiLanguage || "ru"} onValueChange={(v) => updateSetting("uiLanguage", v)}>
                  <SelectTrigger className="w-full mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ru">Русский</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium">Часовой пояс</Label>
                <Select value={settings.timezone || "Europe/Moscow"} onValueChange={(v) => updateSetting("timezone", v)}>
                  <SelectTrigger className="w-full mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Europe/Moscow">Москва (UTC+3)</SelectItem>
                    <SelectItem value="Europe/Kaliningrad">Калининград (UTC+2)</SelectItem>
                    <SelectItem value="Asia/Yekaterinburg">Екатеринбург (UTC+5)</SelectItem>
                    <SelectItem value="Asia/Novosibirsk">Новосибирск (UTC+7)</SelectItem>
                    <SelectItem value="Asia/Vladivostok">Владивосток (UTC+10)</SelectItem>
                    <SelectItem value="UTC">UTC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium">Формат даты</Label>
                <Select value={settings.dateFormat || "dd.mm.yyyy"} onValueChange={(v) => updateSetting("dateFormat", v)}>
                  <SelectTrigger className="w-full mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dd.mm.yyyy">31.12.2026</SelectItem>
                    <SelectItem value="yyyy-mm-dd">2026-12-31</SelectItem>
                    <SelectItem value="mm/dd/yyyy">12/31/2026</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium">Формат времени</Label>
                <div className="flex gap-4 mt-1.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="timeFormat" checked={(settings.timeFormat || "24h") === "24h"} onChange={() => updateSetting("timeFormat", "24h")} className="accent-primary" />
                    <span className="text-sm">24-часовой (14:30)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="timeFormat" checked={settings.timeFormat === "12h"} onChange={() => updateSetting("timeFormat", "12h")} className="accent-primary" />
                    <span className="text-sm">12-часовой (2:30 PM)</span>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      case "platform":
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><LayoutDashboard className="h-4 w-4" /> Платформа</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Стартовая страница</p>
                  <p className="text-xs text-muted-foreground">Страница, на которую вы попадаете при входе</p>
                </div>
                <Select value={settings.startPage || "/"} onValueChange={(v) => updateSetting("startPage", v)}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="/">Главная</SelectItem>
                    <SelectItem value="/explore">Каталог</SelectItem>
                    <SelectItem value="/creator-studio">Студия</SelectItem>
                    <SelectItem value="/ad-studio">Биржа</SelectItem>
                    <SelectItem value="/marketplace">Предложения</SelectItem>
                    <SelectItem value="/trust-rating">Рейтинг</SelectItem>
                    <SelectItem value="/ai-workspace">AI</SelectItem>
                    <SelectItem value="/library">Библиотека</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        );
      case "security":
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4" /> Безопасность</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-xs text-muted-foreground">{user?.email || "—"}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleChangePassword}>
                <Lock className="h-4 w-4 mr-2" />Сменить пароль
              </Button>
              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Двухфакторная аутентификация</p>
                    <p className="text-xs text-muted-foreground">Дополнительный уровень безопасности при входе</p>
                  </div>
                  <Switch checked={settings.twoFactorEnabled || false} onCheckedChange={(v) => {
                    updateSetting("twoFactorEnabled", v);
                    toast.info(v ? "2FA будет настроена при следующем входе" : "2FA отключена");
                  }} />
                </div>
              </div>
              <div className="border-t border-border pt-4">
                <p className="text-sm font-medium mb-2">Активные сессии</p>
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm">Текущая сессия</p>
                      <p className="text-xs text-muted-foreground">Этот браузер</p>
                    </div>
                    <Badge variant="secondary" className="text-xs">Активна</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Настройки</h1>
        <Button onClick={handleSave} disabled={saving} size="sm">
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Сохранение..." : "Сохранить"}
        </Button>
      </div>

      {/* Horizontal section tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 border-b border-border">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-sm rounded-t-lg whitespace-nowrap transition-colors shrink-0",
              activeSection === s.id
                ? "text-primary border-b-2 border-primary font-medium bg-primary/5"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <s.icon className="h-3.5 w-3.5" />
            {s.label}
          </button>
        ))}
      </div>

      {renderSection()}
    </div>
  );
}
