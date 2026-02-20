import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Save, Settings, Bell, Globe, DollarSign, Eye } from "lucide-react";
import { toast } from "sonner";

interface StudioSettings {
  channel_name: string;
  channel_description: string;
  default_language: string;
  default_monetization: string;
  auto_publish: boolean;
  watermark_enabled: boolean;
  notify_new_subscriber: boolean;
  notify_new_comment: boolean;
  notify_new_deal: boolean;
}

const defaults: StudioSettings = {
  channel_name: "",
  channel_description: "",
  default_language: "ru",
  default_monetization: "free",
  auto_publish: false,
  watermark_enabled: false,
  notify_new_subscriber: true,
  notify_new_comment: true,
  notify_new_deal: true,
};

export function StudioSettingsSection() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<StudioSettings>(defaults);
  const [dirty, setDirty] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["studio-settings", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("studio_settings")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        channel_name: settings.channel_name || "",
        channel_description: settings.channel_description || "",
        default_language: settings.default_language || "ru",
        default_monetization: settings.default_monetization || "free",
        auto_publish: settings.auto_publish || false,
        watermark_enabled: settings.watermark_enabled || false,
        notify_new_subscriber: settings.notify_new_subscriber ?? true,
        notify_new_comment: settings.notify_new_comment ?? true,
        notify_new_deal: settings.notify_new_deal ?? true,
      });
    } else if (profile) {
      setForm({ ...defaults, channel_name: profile.display_name || "" });
    }
    setDirty(false);
  }, [settings, profile]);

  const update = (key: keyof StudioSettings, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (settings) {
        const { error } = await supabase.from("studio_settings").update(form).eq("user_id", user!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("studio_settings").insert({ ...form, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["studio-settings"] });
      toast.success("Настройки сохранены");
      setDirty(false);
    },
    onError: () => toast.error("Ошибка сохранения"),
  });

  if (isLoading) {
    return <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Загрузка…</CardContent></Card>;
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-foreground">Настройки студии</h1>
          <p className="text-sm text-muted-foreground">Персонализация и параметры</p>
        </div>
        <Button size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
          <Save className="h-3.5 w-3.5 mr-1.5" />
          {save.isPending ? "Сохранение…" : "Сохранить"}
        </Button>
      </div>

      {/* Channel info */}
      <Card>
        <CardHeader className="pb-3 pt-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Settings className="h-4 w-4 text-primary" /> Канал
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Название канала</Label>
            <Input value={form.channel_name} onChange={(e) => update("channel_name", e.target.value)}
              placeholder="Мой канал" className="text-sm h-9" maxLength={100} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Описание канала</Label>
            <Textarea value={form.channel_description} onChange={(e) => update("channel_description", e.target.value)}
              placeholder="Расскажите о своём канале…" className="text-sm min-h-[80px] resize-none" maxLength={500} />
            <p className="text-[10px] text-muted-foreground text-right">{form.channel_description.length}/500</p>
          </div>
        </CardContent>
      </Card>

      {/* Publishing defaults */}
      <Card>
        <CardHeader className="pb-3 pt-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" /> Публикация
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Язык по умолчанию</Label>
              <Select value={form.default_language} onValueChange={(v) => update("default_language", v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ru">Русский</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="uk">Українська</SelectItem>
                  <SelectItem value="kk">Қазақша</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Монетизация по умолчанию</Label>
              <Select value={form.default_monetization} onValueChange={(v) => update("default_monetization", v)}>
                <SelectTrigger className="h-9 text-sm"><DollarSign className="h-3 w-3 mr-1" /><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Бесплатно</SelectItem>
                  <SelectItem value="paid">Платный</SelectItem>
                  <SelectItem value="subscription">По подписке</SelectItem>
                  <SelectItem value="donate">Донаты</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Автопубликация</p>
                <p className="text-[11px] text-muted-foreground">Публиковать контент сразу после создания</p>
              </div>
              <Switch checked={form.auto_publish} onCheckedChange={(v) => update("auto_publish", v)} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Водяной знак</p>
                <p className="text-[11px] text-muted-foreground">Добавлять водяной знак на медиа</p>
              </div>
              <Switch checked={form.watermark_enabled} onCheckedChange={(v) => update("watermark_enabled", v)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader className="pb-3 pt-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" /> Уведомления
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Новый подписчик</p>
              <p className="text-[11px] text-muted-foreground">Уведомлять о новых подписчиках</p>
            </div>
            <Switch checked={form.notify_new_subscriber} onCheckedChange={(v) => update("notify_new_subscriber", v)} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Новый комментарий</p>
              <p className="text-[11px] text-muted-foreground">Уведомлять о новых комментариях</p>
            </div>
            <Switch checked={form.notify_new_comment} onCheckedChange={(v) => update("notify_new_comment", v)} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Новая сделка</p>
              <p className="text-[11px] text-muted-foreground">Уведомлять о новых предложениях</p>
            </div>
            <Switch checked={form.notify_new_deal} onCheckedChange={(v) => update("notify_new_deal", v)} />
          </div>
        </CardContent>
      </Card>
    </>
  );
}
