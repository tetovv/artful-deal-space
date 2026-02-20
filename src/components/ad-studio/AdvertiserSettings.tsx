import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Save, Building2, Landmark, ShieldCheck, CheckCircle2, Clock, Palette, Globe, Upload, X, ImageIcon,
  Mail, Tag, Eye, EyeOff, Lock, Users, Loader2, AlertCircle, PlugZap, RefreshCw, Info,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ───
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
  brand_name: string;
  brand_website: string;
  brand_description: string;
  brand_logo_url: string;
  business_category: string;
  contact_email: string;
}

const defaults: AdvSettings = {
  business_type: null, business_name: "", business_inn: "", business_ogrn: "", business_verified: false,
  bank_name: "", bank_bik: "", bank_account: "", bank_corr_account: "", bank_verified: false,
  ord_identifier: "", ord_token: "", ord_verified: false,
  brand_name: "", brand_website: "", brand_description: "", brand_logo_url: "",
  business_category: "", contact_email: "",
};

type VerifyState = "idle" | "loading" | "success" | "error";

// ─── Shared UI pieces ───
function PrivacyLabel({ isPublic }: { isPublic: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground font-normal ml-auto">
      {isPublic ? <><Users className="h-2.5 w-2.5" /> Видно авторам</> : <><Lock className="h-2.5 w-2.5" /> Приватно</>}
    </span>
  );
}

function VerifyResult({ state, successText, errorText }: { state: VerifyState; successText: string; errorText?: string }) {
  if (state === "loading") return <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Проверка…</div>;
  if (state === "success") return <div className="flex items-center gap-1.5 text-xs text-success"><CheckCircle2 className="h-3.5 w-3.5" /> {successText}</div>;
  if (state === "error") return <div className="flex items-center gap-1.5 text-xs text-destructive"><AlertCircle className="h-3.5 w-3.5" /> {errorText || "Ошибка проверки"}</div>;
  return null;
}

function SectionCheck({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {done ? <CheckCircle2 className="h-3.5 w-3.5 text-success flex-shrink-0" /> : <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/40 flex-shrink-0" />}
      <span className={done ? "text-card-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}

// ─── Hook (unchanged export) ───
export function useAdvertiserVerification() {
  const { user } = useAuth();
  const { data: settings } = useQuery({
    queryKey: ["studio-settings", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("studio_settings").select("business_verified, bank_verified, ord_verified").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
  const isVerified = !!(settings?.business_verified && settings?.ord_verified);
  return { isVerified, settings };
}

// ─── Main Component ───
export function AdvertiserSettings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<AdvSettings>(defaults);
  const [savedSnapshot, setSavedSnapshot] = useState<AdvSettings>(defaults);
  const [uploading, setUploading] = useState(false);
  const [showOrdToken, setShowOrdToken] = useState(false);
  const [verifyStates, setVerifyStates] = useState<Record<string, VerifyState>>({ business: "idle", bank: "idle", ord: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(savedSnapshot), [form, savedSnapshot]);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["studio-settings", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("studio_settings").select("*").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (settings) {
      const loaded: AdvSettings = {
        business_type: settings.business_type || null,
        business_name: settings.business_name || "", business_inn: settings.business_inn || "",
        business_ogrn: settings.business_ogrn || "", business_verified: settings.business_verified || false,
        bank_name: settings.bank_name || "", bank_bik: settings.bank_bik || "",
        bank_account: settings.bank_account || "", bank_corr_account: settings.bank_corr_account || "",
        bank_verified: settings.bank_verified || false,
        ord_identifier: settings.ord_identifier || "", ord_token: settings.ord_token || "",
        ord_verified: settings.ord_verified || false,
        brand_name: (settings as any).brand_name || "", brand_website: (settings as any).brand_website || "",
        brand_description: (settings as any).brand_description || "", brand_logo_url: (settings as any).brand_logo_url || "",
        business_category: (settings as any).business_category || "", contact_email: (settings as any).contact_email || "",
      };
      setForm(loaded);
      setSavedSnapshot(loaded);
    }
  }, [settings]);

  const update = useCallback((key: keyof AdvSettings, value: any) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      // Reset verification when editing verified section fields
      if (["business_type", "business_name", "business_inn", "business_ogrn"].includes(key)) {
        next.business_verified = false;
        setVerifyStates((s) => ({ ...s, business: "idle" }));
      }
      if (["bank_name", "bank_bik", "bank_account", "bank_corr_account"].includes(key)) {
        next.bank_verified = false;
        setVerifyStates((s) => ({ ...s, bank: "idle" }));
      }
      if (["ord_identifier", "ord_token"].includes(key)) {
        next.ord_verified = false;
        setVerifyStates((s) => ({ ...s, ord: "idle" }));
      }
      return next;
    });
  }, []);

  const save = useMutation({
    mutationFn: async () => {
      if (settings) {
        const { error } = await supabase.from("studio_settings").update(form as any).eq("user_id", user!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("studio_settings").insert({ ...form, user_id: user!.id } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["studio-settings"] });
      setSavedSnapshot({ ...form });
      toast.success("Настройки сохранены");
    },
    onError: () => toast.error("Ошибка сохранения"),
  });

  const mockVerify = useCallback(async (type: "business" | "bank" | "ord") => {
    // If dirty, save first
    if (dirty) {
      try {
        await save.mutateAsync();
      } catch {
        return;
      }
    }
    setVerifyStates((s) => ({ ...s, [type]: "loading" }));
    // Simulate async verification
    await new Promise((r) => setTimeout(r, 1200));

    if (type === "business") {
      if (!form.business_type || !form.business_name || !form.business_inn) {
        setVerifyStates((s) => ({ ...s, business: "error" }));
        toast.error("Заполните обязательные поля реквизитов");
        return;
      }
      const innLen = form.business_type === "ip" || form.business_type === "self" ? 12 : 10;
      if (form.business_inn.length !== innLen) {
        setVerifyStates((s) => ({ ...s, business: "error" }));
        toast.error(`ИНН должен содержать ${innLen} цифр для ${form.business_type === "ip" || form.business_type === "self" ? "ИП" : "ООО"}`);
        return;
      }
      setForm((f) => ({ ...f, business_verified: true }));
      setVerifyStates((s) => ({ ...s, business: "success" }));
      toast.success("Реквизиты подтверждены (тест)");
    } else if (type === "bank") {
      if (!form.bank_bik || form.bank_bik.length !== 9) { setVerifyStates((s) => ({ ...s, bank: "error" })); toast.error("БИК должен содержать 9 цифр"); return; }
      if (!form.bank_account || form.bank_account.length !== 20) { setVerifyStates((s) => ({ ...s, bank: "error" })); toast.error("Расчётный счёт должен содержать 20 цифр"); return; }
      if (form.bank_corr_account && form.bank_corr_account.length !== 20) { setVerifyStates((s) => ({ ...s, bank: "error" })); toast.error("Корр. счёт должен содержать 20 цифр"); return; }
      setForm((f) => ({ ...f, bank_verified: true }));
      setVerifyStates((s) => ({ ...s, bank: "success" }));
      toast.success("Банк подтверждён (тест)");
    } else {
      if (!form.ord_identifier) { setVerifyStates((s) => ({ ...s, ord: "error" })); toast.error("Укажите идентификатор ОРД"); return; }
      setForm((f) => ({ ...f, ord_verified: true }));
      setVerifyStates((s) => ({ ...s, ord: "success" }));
      toast.success("ОРД подключён (тест)");
    }
  }, [form, dirty, save]);

  // ─── Readiness ───
  const brandReady = !!(form.brand_name);
  const legalReady = !!(form.business_verified);
  const bankReady = !!(form.bank_verified);
  const ordReady = !!(form.ord_verified);
  const readinessItems = [
    { done: brandReady, label: "Бренд", hint: "Обязательно для сделок" },
    { done: legalReady, label: "Реквизиты", hint: "Обязательно для сделок" },
    { done: bankReady, label: "Банк", hint: "Для выплат" },
    { done: ordReady, label: "ОРД", hint: "Для маркировки рекламы" },
  ];
  const readiness = readinessItems.filter((i) => i.done).length;
  const readinessPercent = (readiness / readinessItems.length) * 100;

  // ─── Legal field config based on business type ───
  const isIP = form.business_type === "ip" || form.business_type === "self";
  const innMax = isIP ? 12 : 10;
  const ogrnMax = isIP ? 15 : 13;
  const ogrnLabel = isIP ? "ОГРНИП" : "ОГРН";
  const nameLabel = isIP ? "ФИО предпринимателя *" : "Наименование организации *";
  const namePlaceholder = isIP ? "Иванов Иван Иванович" : 'ООО "Компания"';

  if (isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />Загрузка…</div>;
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-3 pb-2">
        <div>
          <h2 className="text-base font-bold text-foreground">Настройки рекламодателя</h2>
          <p className="text-xs text-muted-foreground">Верификация и данные бренда для размещения рекламы</p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <Badge variant="outline" className="text-[10px] gap-1 border-warning/30 text-warning bg-warning/10 animate-fade-in">
              <AlertCircle className="h-2.5 w-2.5" /> Есть несохранённые изменения
            </Badge>
          )}
          <Button size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
            <Save className="h-3.5 w-3.5 mr-1.5" />
            {save.isPending ? "Сохранение…" : "Сохранить"}
          </Button>
        </div>
      </div>

      {/* Readiness block */}
      <div className="px-6 pb-3">
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-card-foreground">Готовность профиля</span>
            <span className="text-xs text-muted-foreground">{readiness} / {readinessItems.length}</span>
          </div>
          <Progress value={readinessPercent} className="h-1.5" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {readinessItems.map((item) => (
              <div key={item.label} className="space-y-0.5">
                <SectionCheck done={item.done} label={item.label} />
                <p className="text-[10px] text-muted-foreground pl-5">{item.hint}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cards grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-3 px-6 pb-4 min-h-0 overflow-y-auto">
        {/* ──────── 1. Brand ──────── */}
        <Card className="flex flex-col">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Palette className="h-4 w-4 text-primary" /> Бренд
              <PrivacyLabel isPublic />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2.5 flex-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Название бренда *</Label>
                <Input value={form.brand_name} onChange={(e) => update("brand_name", e.target.value)}
                  placeholder="Например: Яндекс" className="text-sm h-9" maxLength={100} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1"><Globe className="h-3 w-3" /> Сайт</Label>
                <Input value={form.brand_website} onChange={(e) => update("brand_website", e.target.value)}
                  placeholder="https://example.com" className="text-sm h-9" maxLength={200} type="url" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1"><Tag className="h-3 w-3" /> Категория бизнеса</Label>
                <Select value={form.business_category || ""} onValueChange={(v) => update("business_category", v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Выберите" /></SelectTrigger>
                  <SelectContent>
                    {[["ecommerce","E-commerce"],["saas","SaaS / IT"],["finance","Финансы"],["education","Образование"],["health","Здоровье"],["food","Еда и напитки"],["fashion","Мода и красота"],["travel","Путешествия"],["entertainment","Развлечения"],["realestate","Недвижимость"],["auto","Авто"],["other","Другое"]].map(([v,l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1"><Mail className="h-3 w-3" /> Email для авторов</Label>
                <Input value={form.contact_email} onChange={(e) => update("contact_email", e.target.value)}
                  placeholder="ads@company.com" className="text-sm h-9" maxLength={200} type="email" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Описание бренда</Label>
              <Textarea value={form.brand_description} onChange={(e) => update("brand_description", e.target.value)}
                placeholder="Кратко о бренде и сфере деятельности…" className="text-sm min-h-[52px] resize-none" maxLength={500} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Логотип</Label>
              <div className="flex items-center gap-2">
                {form.brand_logo_url ? (
                  <div className="relative h-9 w-9 rounded border border-border overflow-hidden flex-shrink-0">
                    <img src={form.brand_logo_url} alt="Logo" className="h-full w-full object-cover" />
                    <button type="button" onClick={() => update("brand_logo_url", "")}
                      className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ) : (
                  <div className="h-9 w-9 rounded border border-dashed border-border flex items-center justify-center flex-shrink-0">
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file || !user) return;
                  setUploading(true);
                  try {
                    const ext = file.name.split(".").pop();
                    const path = `${user.id}/${Date.now()}.${ext}`;
                    const { error } = await supabase.storage.from("brand-logos").upload(path, file, { upsert: true });
                    if (error) throw error;
                    const { data: urlData } = supabase.storage.from("brand-logos").getPublicUrl(path);
                    update("brand_logo_url", urlData.publicUrl);
                    toast.success("Логотип загружен");
                  } catch {
                    toast.error("Ошибка загрузки");
                  } finally {
                    setUploading(false);
                  }
                }} />
                <Button type="button" size="sm" variant="outline" className="h-9 text-xs gap-1.5" disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5" />
                  {uploading ? "Загрузка…" : "Загрузить"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ──────── 2. Legal ──────── */}
        <Card className="flex flex-col">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Реквизиты
              <PrivacyLabel isPublic={false} />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2.5 flex-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Форма собственности *</Label>
                <Select value={form.business_type || ""} onValueChange={(v) => update("business_type", v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Выберите тип" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ip">ИП</SelectItem>
                    <SelectItem value="ooo">ООО</SelectItem>
                    <SelectItem value="self">Самозанятый</SelectItem>
                    <SelectItem value="ul">Юр. лицо (иное)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{nameLabel}</Label>
                <Input value={form.business_name} onChange={(e) => update("business_name", e.target.value)}
                  placeholder={namePlaceholder} className="text-sm h-9" maxLength={200} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">ИНН * <span className="text-muted-foreground font-normal">({innMax} цифр)</span></Label>
                <Input value={form.business_inn} onChange={(e) => update("business_inn", e.target.value.replace(/\D/g, "").slice(0, innMax))}
                  placeholder={"0".repeat(innMax)} className="text-sm h-9 font-mono" maxLength={innMax} />
                {form.business_inn.length > 0 && form.business_inn.length !== innMax && (
                  <p className="text-[10px] text-warning">{form.business_inn.length}/{innMax} цифр</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{ogrnLabel} <span className="text-muted-foreground font-normal">({ogrnMax} цифр)</span></Label>
                <Input value={form.business_ogrn} onChange={(e) => update("business_ogrn", e.target.value.replace(/\D/g, "").slice(0, ogrnMax))}
                  placeholder={"0".repeat(ogrnMax)} className="text-sm h-9 font-mono" maxLength={ogrnMax} />
                {form.business_ogrn.length > 0 && form.business_ogrn.length !== ogrnMax && (
                  <p className="text-[10px] text-warning">{form.business_ogrn.length}/{ogrnMax} цифр</p>
                )}
              </div>
            </div>
            <VerifyResult state={verifyStates.business} successText="Реквизиты подтверждены" errorText="Проверьте заполнение полей" />
            {verifyStates.business !== "success" && !form.business_verified && (
              <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={() => mockVerify("business")} disabled={verifyStates.business === "loading"}>
                <ShieldCheck className="h-3.5 w-3.5" />
                {dirty ? "Сохранить и проверить" : "Проверить"}
              </Button>
            )}
            {form.business_verified && verifyStates.business !== "loading" && (
              <VerifyResult state="success" successText="Реквизиты подтверждены" />
            )}
          </CardContent>
        </Card>

        {/* ──────── 3. Banking ──────── */}
        <Card className="flex flex-col">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Landmark className="h-4 w-4 text-primary" /> Банковские реквизиты
              <PrivacyLabel isPublic={false} />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2.5 flex-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">БИК * <span className="text-muted-foreground font-normal">(9 цифр)</span></Label>
                <Input value={form.bank_bik} onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 9);
                  update("bank_bik", v);
                  // Auto-fill hint
                  if (v.length === 9 && !form.bank_name) {
                    update("bank_name", "Банк (определяется по БИК)");
                  }
                }}
                  placeholder="044525974" className="text-sm h-9 font-mono" maxLength={9} />
                {form.bank_bik.length > 0 && form.bank_bik.length !== 9 && (
                  <p className="text-[10px] text-warning">{form.bank_bik.length}/9 цифр</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Банк</Label>
                <Input value={form.bank_name} onChange={(e) => update("bank_name", e.target.value)}
                  placeholder="Заполняется из БИК или вручную" className="text-sm h-9" maxLength={200} />
                <p className="text-[10px] text-muted-foreground"><Info className="h-2.5 w-2.5 inline mr-0.5 -mt-px" />При вводе БИК банк определится автоматически</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Расчётный счёт * <span className="text-muted-foreground font-normal">(20 цифр)</span></Label>
                <Input value={form.bank_account} onChange={(e) => update("bank_account", e.target.value.replace(/\D/g, "").slice(0, 20))}
                  placeholder="40802810..." className="text-sm h-9 font-mono" maxLength={20} />
                {form.bank_account.length > 0 && form.bank_account.length !== 20 && (
                  <p className="text-[10px] text-warning">{form.bank_account.length}/20 цифр</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Корр. счёт <span className="text-muted-foreground font-normal">(20 цифр)</span></Label>
                <Input value={form.bank_corr_account} onChange={(e) => update("bank_corr_account", e.target.value.replace(/\D/g, "").slice(0, 20))}
                  placeholder="30101810..." className="text-sm h-9 font-mono" maxLength={20} />
                {form.bank_corr_account.length > 0 && form.bank_corr_account.length !== 20 && (
                  <p className="text-[10px] text-warning">{form.bank_corr_account.length}/20 цифр</p>
                )}
              </div>
            </div>
            <VerifyResult state={verifyStates.bank} successText="Банк подтверждён" errorText="Проверьте заполнение" />
            {verifyStates.bank !== "success" && !form.bank_verified && (
              <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={() => mockVerify("bank")} disabled={verifyStates.bank === "loading"}>
                <ShieldCheck className="h-3.5 w-3.5" />
                {dirty ? "Сохранить и проверить" : "Проверить"}
              </Button>
            )}
            {form.bank_verified && verifyStates.bank !== "loading" && (
              <VerifyResult state="success" successText="Банк подтверждён" />
            )}
          </CardContent>
        </Card>

        {/* ──────── 4. ORD ──────── */}
        <Card className="flex flex-col">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> ОРД — Маркировка рекламы
              <PrivacyLabel isPublic={false} />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-3 flex-1">
            {!form.ord_verified && verifyStates.ord !== "success" ? (
              /* Not connected state */
              <>
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <span className="font-medium text-card-foreground">ОРД (Оператор рекламных данных)</span> — обязательная система маркировки рекламы в РФ.
                    Подключите провайдера для автоматической маркировки при создании рекламных кампаний.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {["Яндекс", "VK", "МедиаСкаут", "Озон", "АМОРДС"].map((p) => (
                      <Badge key={p} variant="secondary" className="text-[10px]">{p}</Badge>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Идентификатор ОРД *</Label>
                    <Input value={form.ord_identifier} onChange={(e) => update("ord_identifier", e.target.value)}
                      placeholder="ord-123456" className="text-sm h-9" maxLength={100} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Токен доступа</Label>
                    <div className="relative">
                      <Input value={form.ord_token} onChange={(e) => update("ord_token", e.target.value)}
                        placeholder="••••••••" className="text-sm h-9 pr-9" maxLength={500}
                        type={showOrdToken ? "text" : "password"} />
                      <button type="button" onClick={() => setShowOrdToken(!showOrdToken)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                        {showOrdToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
                <VerifyResult state={verifyStates.ord} successText="ОРД подключён" errorText="Проверьте идентификатор" />
                <Button size="sm" className="gap-1.5 h-9 text-xs" onClick={() => mockVerify("ord")} disabled={verifyStates.ord === "loading"}>
                  <PlugZap className="h-3.5 w-3.5" />
                  {dirty ? "Сохранить и подключить" : "Подключить ОРД"}
                </Button>
              </>
            ) : (
              /* Connected state */
              <>
                <div className="rounded-lg border border-success/20 bg-success/5 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      <span className="text-xs font-medium text-card-foreground">ОРД подключён</span>
                    </div>
                    <Badge variant="outline" className="text-[9px] border-success/30 text-success bg-success/10">Активен</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Провайдер: <span className="text-card-foreground">{form.ord_identifier || "—"}</span></p>
                    <p>Токен: <span className="font-mono text-card-foreground">{"•".repeat(12)}</span></p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={() => {
                    setForm((f) => ({ ...f, ord_verified: false }));
                    setVerifyStates((s) => ({ ...s, ord: "idle" }));
                  }}>
                    <RefreshCw className="h-3 w-3" /> Переподключить
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
