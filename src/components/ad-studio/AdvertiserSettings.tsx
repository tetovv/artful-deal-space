import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Save, Building2, Landmark, ShieldCheck, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface AdvSettings {
  business_type: string | null;
  business_name: string;
  business_inn: string;
  business_ogrn: string;
  business_verified: boolean;
  bank_name: string;
  bank_bik: string;
  bank_account: string;
  bank_corr_account: string;
  bank_verified: boolean;
  ord_identifier: string;
  ord_token: string;
  ord_verified: boolean;
}

const defaults: AdvSettings = {
  business_type: null,
  business_name: "",
  business_inn: "",
  business_ogrn: "",
  business_verified: false,
  bank_name: "",
  bank_bik: "",
  bank_account: "",
  bank_corr_account: "",
  bank_verified: false,
  ord_identifier: "",
  ord_token: "",
  ord_verified: false,
};

function VerificationBadge({ verified }: { verified: boolean }) {
  if (verified) {
    return (
      <Badge variant="outline" className="text-[10px] gap-1 border-green-500/30 text-green-600 bg-green-500/10">
        <CheckCircle2 className="h-3 w-3" /> Подтверждено
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] gap-1 border-yellow-500/30 text-yellow-600 bg-yellow-500/10">
      <Clock className="h-3 w-3" /> Не подтверждено
    </Badge>
  );
}

export function useAdvertiserVerification() {
  const { user } = useAuth();

  const { data: settings } = useQuery({
    queryKey: ["studio-settings", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("studio_settings")
        .select("business_verified, bank_verified, ord_verified")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const isVerified = !!(settings?.business_verified && settings?.ord_verified);
  return { isVerified, settings };
}

export function AdvertiserSettings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<AdvSettings>(defaults);
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
        business_type: settings.business_type || null,
        business_name: settings.business_name || "",
        business_inn: settings.business_inn || "",
        business_ogrn: settings.business_ogrn || "",
        business_verified: settings.business_verified || false,
        bank_name: settings.bank_name || "",
        bank_bik: settings.bank_bik || "",
        bank_account: settings.bank_account || "",
        bank_corr_account: settings.bank_corr_account || "",
        bank_verified: settings.bank_verified || false,
        ord_identifier: settings.ord_identifier || "",
        ord_token: settings.ord_token || "",
        ord_verified: settings.ord_verified || false,
      });
    }
    setDirty(false);
  }, [settings]);

  const update = (key: keyof AdvSettings, value: any) => {
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

  const mockVerify = (type: "business" | "bank" | "ord") => {
    if (type === "business") {
      if (!form.business_type || !form.business_name || !form.business_inn) {
        toast.error("Заполните все обязательные поля реквизитов");
        return;
      }
      update("business_verified", true);
      toast.success("Реквизиты ИП/ООО подтверждены (тест)");
    } else if (type === "bank") {
      if (!form.bank_name || !form.bank_bik || !form.bank_account) {
        toast.error("Заполните все обязательные поля банка");
        return;
      }
      update("bank_verified", true);
      toast.success("Банковские реквизиты подтверждены (тест)");
    } else {
      if (!form.ord_identifier) {
        toast.error("Укажите идентификатор ОРД");
        return;
      }
      update("ord_verified", true);
      toast.success("ОРД подключён (тест)");
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Загрузка…</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-foreground">Настройки рекламодателя</h2>
            <p className="text-xs text-muted-foreground">
              Верификация обязательна для размещения рекламы и работы с авторами
            </p>
          </div>
          <Button size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
            <Save className="h-3.5 w-3.5 mr-1.5" />
            {save.isPending ? "Сохранение…" : "Сохранить"}
          </Button>
        </div>

        {/* Business details */}
        <Card>
          <CardHeader className="pb-3 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Реквизиты ИП / ООО
              <VerificationBadge verified={form.business_verified} />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Форма собственности *</Label>
              <Select value={form.business_type || ""} onValueChange={(v) => { update("business_type", v); update("business_verified", false); }}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Выберите тип" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ip">ИП (Индивидуальный предприниматель)</SelectItem>
                  <SelectItem value="ooo">ООО (Общество с ограниченной ответственностью)</SelectItem>
                  <SelectItem value="self">Самозанятый</SelectItem>
                  <SelectItem value="ul">Юридическое лицо (иное)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Наименование организации / ФИО ИП *</Label>
              <Input value={form.business_name} onChange={(e) => { update("business_name", e.target.value); update("business_verified", false); }}
                placeholder='ООО "Компания" или ИП Иванов И.И.' className="text-sm h-9" maxLength={200} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">ИНН *</Label>
                <Input value={form.business_inn} onChange={(e) => { update("business_inn", e.target.value.replace(/\D/g, "")); update("business_verified", false); }}
                  placeholder="1234567890" className="text-sm h-9" maxLength={12} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">ОГРН / ОГРНИП</Label>
                <Input value={form.business_ogrn} onChange={(e) => { update("business_ogrn", e.target.value.replace(/\D/g, "")); update("business_verified", false); }}
                  placeholder="1234567890123" className="text-sm h-9" maxLength={15} />
              </div>
            </div>
            {!form.business_verified && (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => mockVerify("business")}>
                <ShieldCheck className="h-3.5 w-3.5" /> Проверить реквизиты
              </Button>
            )}
            {form.business_verified && (
              <div className="flex items-center gap-2 text-xs text-green-600">
                <CheckCircle2 className="h-4 w-4" /> Реквизиты прошли проверку
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bank details */}
        <Card>
          <CardHeader className="pb-3 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Landmark className="h-4 w-4 text-primary" /> Банковские реквизиты
              <VerificationBadge verified={form.bank_verified} />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Наименование банка *</Label>
              <Input value={form.bank_name} onChange={(e) => { update("bank_name", e.target.value); update("bank_verified", false); }}
                placeholder="АО «Тинькофф Банк»" className="text-sm h-9" maxLength={200} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">БИК *</Label>
                <Input value={form.bank_bik} onChange={(e) => { update("bank_bik", e.target.value.replace(/\D/g, "")); update("bank_verified", false); }}
                  placeholder="044525974" className="text-sm h-9" maxLength={9} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Расчётный счёт *</Label>
                <Input value={form.bank_account} onChange={(e) => { update("bank_account", e.target.value.replace(/\D/g, "")); update("bank_verified", false); }}
                  placeholder="40802810000000000000" className="text-sm h-9" maxLength={20} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Корреспондентский счёт</Label>
              <Input value={form.bank_corr_account} onChange={(e) => { update("bank_corr_account", e.target.value.replace(/\D/g, "")); update("bank_verified", false); }}
                placeholder="30101810400000000000" className="text-sm h-9" maxLength={20} />
            </div>
            {!form.bank_verified && (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => mockVerify("bank")}>
                <ShieldCheck className="h-3.5 w-3.5" /> Проверить банк
              </Button>
            )}
            {form.bank_verified && (
              <div className="flex items-center gap-2 text-xs text-green-600">
                <CheckCircle2 className="h-4 w-4" /> Банковские реквизиты подтверждены
              </div>
            )}
          </CardContent>
        </Card>

        {/* ORD */}
        <Card>
          <CardHeader className="pb-3 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> ОРД — Маркировка рекламы
              <VerificationBadge verified={form.ord_verified} />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-4">
            <p className="text-xs text-muted-foreground">
              Подключение ОРД обязательно для маркировки рекламного контента — как при работе с авторами, так и для встроенной рекламы на платформе.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Идентификатор ОРД *</Label>
                <Input value={form.ord_identifier} onChange={(e) => { update("ord_identifier", e.target.value); update("ord_verified", false); }}
                  placeholder="ord-123456" className="text-sm h-9" maxLength={100} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Токен доступа</Label>
                <Input value={form.ord_token} onChange={(e) => { update("ord_token", e.target.value); update("ord_verified", false); }}
                  placeholder="Bearer token" className="text-sm h-9" maxLength={500} type="password" />
              </div>
            </div>
            <div className="rounded-lg border border-muted p-3 space-y-1.5">
              <p className="text-xs font-medium flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5 text-muted-foreground" /> Поддерживаемые ОРД</p>
              <p className="text-[11px] text-muted-foreground">ОРД «Яндекс», ОРД VK, ОРД «МедиаСкаут», ОРД «Озон», ОРД «АМОРДС»</p>
            </div>
            {!form.ord_verified && (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => mockVerify("ord")}>
                <ShieldCheck className="h-3.5 w-3.5" /> Подключить ОРД
              </Button>
            )}
            {form.ord_verified && (
              <div className="flex items-center gap-2 text-xs text-green-600">
                <CheckCircle2 className="h-4 w-4" /> ОРД подключён и верифицирован
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
