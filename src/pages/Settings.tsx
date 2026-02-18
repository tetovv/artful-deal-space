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
import { toast } from "sonner";
import { Save, User, Tags, MapPin, Upload, Loader2, Shield } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
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

export default function Settings() {
  const { user, profile } = useAuth();
  const { primaryRole, roles } = useUserRole();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    if (!file.type.startsWith("image/")) {
      toast.error("Выберите изображение");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Максимальный размер — 2 МБ");
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast.error("Ошибка загрузки");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatarUrl(urlData.publicUrl + "?t=" + Date.now());
    setUploading(false);
    toast.success("Аватар загружен");
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    // Update profile
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName, bio, avatar_url: avatarUrl, geo, niche })
      .eq("user_id", user.id);

    if (error) {
      toast.error("Не удалось сохранить профиль");
      setSaving(false);
      return;
    }

    // Update role if changed
    if (selectedRole !== primaryRole) {
      // Delete old non-moderator/support roles
      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", user.id)
        .in("role", ["user", "creator", "advertiser"]);

      // Insert new role
      await supabase
        .from("user_roles")
        .insert({ user_id: user.id, role: selectedRole });

      queryClient.invalidateQueries({ queryKey: ["user-roles"] });
    }

    localStorage.setItem("mediaos-interests", JSON.stringify(niche));
    queryClient.invalidateQueries({ queryKey: ["ai-recommendations"] });
    setSaving(false);
    toast.success("Профиль обновлён");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-6 px-4">
      <h1 className="text-2xl font-bold">Настройки профиля</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" /> Основная информация
          </CardTitle>
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
                {avatarUrl ? (
                  <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-6 w-6 text-muted-foreground" />
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Загрузить фото
                </Button>
                <p className="text-[11px] text-muted-foreground">JPG, PNG до 2 МБ</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
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

      {/* Role selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" /> Роль
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">Выберите основную роль — от неё зависят доступные разделы</p>
          <div className="grid gap-2">
            {ROLE_OPTIONS.map((r) => (
              <button
                key={r.value}
                onClick={() => setSelectedRole(r.value)}
                className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                  selectedRole === r.value
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  selectedRole === r.value ? "border-primary" : "border-muted-foreground/40"
                }`}>
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Tags className="h-4 w-4" /> Интересы
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">Выберите интересы для персонализированных рекомендаций</p>
          <div className="flex flex-wrap gap-2">
            {INTEREST_OPTIONS.map((tag) => (
              <Badge
                key={tag}
                variant={niche.includes(tag) ? "default" : "outline"}
                className="cursor-pointer transition-all"
                onClick={() => toggleNiche(tag)}
              >
                {tag}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        <Save className="h-4 w-4 mr-2" />
        {saving ? "Сохранение..." : "Сохранить изменения"}
      </Button>
    </div>
  );
}
