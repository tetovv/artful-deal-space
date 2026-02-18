import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, User, Tags, MapPin } from "lucide-react";

const INTEREST_OPTIONS = [
  "Технологии", "Маркетинг", "Дизайн", "Бизнес", "Образование",
  "Финансы", "Здоровье", "Спорт", "Музыка", "Фото", "Видео",
  "Программирование", "AI", "Криптовалюта", "Путешествия",
];

export default function Settings() {
  const { user, profile } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [geo, setGeo] = useState("");
  const [niche, setNiche] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

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

  const toggleNiche = (tag: string) => {
    setNiche((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName, bio, avatar_url: avatarUrl, geo, niche })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Не удалось сохранить");
    } else {
      toast.success("Профиль обновлён");
      // Also sync localStorage interests for AI recommendations
      localStorage.setItem("onboarding_interests", JSON.stringify(niche));
    }
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
            <Label htmlFor="avatarUrl">URL аватара</Label>
            <div className="flex gap-3 items-center">
              {avatarUrl && (
                <img src={avatarUrl} alt="avatar" className="h-10 w-10 rounded-full object-cover border border-border" />
              )}
              <Input id="avatarUrl" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." className="flex-1" />
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
