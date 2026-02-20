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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Save, Building2, Landmark, ShieldCheck, CheckCircle2, Clock, Palette, Globe, Upload, X,
  Mail, Tag, Eye, EyeOff, Lock, Users, Loader2, AlertCircle, PlugZap, RefreshCw, Info,
  Copy, HelpCircle,
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
type SectionStatus = "empty" | "unsaved" | "filled" | "verified";

const ORD_PROVIDERS = [
  { id: "yandex", label: "Яндекс ОРД" },
  { id: "vk", label: "VK ОРД" },
  { id: "mediascout", label: "МедиаСкаут" },
  { id: "ozon", label: "Озон ОРД" },
  { id: "amords", label: "АМОРДС" },
];

// ─── Helpers ───
function getLegalConfig(type: string | null) {
  switch (type) {
    case "self":
      return { showName: true, nameLabel: "ФИО *", namePlaceholder: "Иванов Иван Иванович", innLen: 12, showOgrn: false, ogrnLen: 0, ogrnLabel: "" };
    case "ip":
      return { showName: true, nameLabel: "ФИО предпринимателя *", namePlaceholder: "Иванов Иван Иванович", innLen: 12, showOgrn: true, ogrnLen: 15, ogrnLabel: "ОГРНИП" };
    case "ooo":
    case "ul":
      return { showName: true, nameLabel: "Наименование организации *", namePlaceholder: 'ООО "Компания"', innLen: 10, showOgrn: true, ogrnLen: 13, ogrnLabel: "ОГРН" };
    default:
      return { showName: false, nameLabel: "", namePlaceholder: "", innLen: 12, showOgrn: false, ogrnLen: 0, ogrnLabel: "" };
  }
}

function isLegalFieldsValid(form: AdvSettings): boolean {
  const cfg = getLegalConfig(form.business_type);
  if (!form.business_type) return false;
  if (!form.business_name.trim()) return false;
  if (form.business_inn.length !== cfg.innLen) return false;
  if (cfg.showOgrn && form.business_ogrn.length !== cfg.ogrnLen) return false;
  return true;
}

function isBankFieldsValid(form: AdvSettings): boolean {
  return form.bank_bik.length === 9 && form.bank_account.length === 20;
}

/** Compare specific keys between form and saved to detect section-level dirty */
function isSectionDirty(form: AdvSettings, saved: AdvSettings, keys: (keyof AdvSettings)[]): boolean {
  return keys.some((k) => form[k] !== saved[k]);
}

function getSectionStatus(fieldsValid: boolean, verified: boolean, sectionDirty: boolean): SectionStatus {
  if (verified && fieldsValid && !sectionDirty) return "verified";
  if (fieldsValid && sectionDirty) return "unsaved";
  if (fieldsValid) return "filled";
  if (sectionDirty) return "unsaved";
  return "empty";
}

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

function StatusBadge({ status }: { status: SectionStatus }) {
  if (status === "verified") return <Badge variant="outline" className="text-[9px] border-success/30 text-success bg-success/10 ml-2">Подтверждено</Badge>;
  if (status === "unsaved") return <Badge variant="outline" className="text-[9px] border-warning/30 text-warning bg-warning/10 ml-2">Не сохранено</Badge>;
  if (status === "filled") return <Badge variant="outline" className="text-[9px] border-primary/30 text-primary bg-primary/10 ml-2">Заполнено</Badge>;
  return <Badge variant="outline" className="text-[9px] border-muted-foreground/30 text-muted-foreground ml-2">Не заполнено</Badge>;
}

function SectionCheck({ status, label }: { status: SectionStatus; label: string }) {
  const done = status === "verified";
  const partial = status === "filled" || status === "unsaved";
  return (
    <div className="flex items-center gap-2 text-xs">
      {done ? <CheckCircle2 className="h-3.5 w-3.5 text-success flex-shrink-0" />
        : partial ? <Clock className="h-3.5 w-3.5 text-warning flex-shrink-0" />
        : <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/40 flex-shrink-0" />}
      <span className={done ? "text-card-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}

function CopyableField({ value, label }: { value: string; label: string }) {
  const [showFull, setShowFull] = useState(false);
  if (!value) return null;
  const display = showFull ? value : value;
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-1.5">
        <Input value={display} readOnly className="text-sm h-9 font-mono bg-muted/30 cursor-default flex-1" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" size="sm" variant="ghost" className="h-9 w-9 p-0 flex-shrink-0"
              onClick={() => { navigator.clipboard.writeText(value); toast.success("Скопировано"); }}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top"><p className="text-xs">Копировать</p></TooltipContent>
        </Tooltip>
      </div>
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
  const [showBankNumbers, setShowBankNumbers] = useState(false);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(savedSnapshot), [form, savedSnapshot]);

  // Section-level dirty detection
  const brandKeys: (keyof AdvSettings)[] = ["brand_name", "brand_website", "brand_description", "brand_logo_url", "business_category", "contact_email"];
  const legalKeys: (keyof AdvSettings)[] = ["business_type", "business_name", "business_inn", "business_ogrn"];
  const bankKeys: (keyof AdvSettings)[] = ["bank_bik", "bank_name", "bank_account", "bank_corr_account"];
  const ordKeys: (keyof AdvSettings)[] = ["ord_identifier", "ord_token"];

  const brandDirty = isSectionDirty(form, savedSnapshot, brandKeys);
  const legalDirty = isSectionDirty(form, savedSnapshot, legalKeys);
  const bankDirty = isSectionDirty(form, savedSnapshot, bankKeys);
  const ordDirty = isSectionDirty(form, savedSnapshot, ordKeys);

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
      if (["business_type", "business_name", "business_inn", "business_ogrn"].includes(key)) {
        next.business_verified = false;
        setVerifyStates((s) => ({ ...s, business: "idle" }));
      }
      if (key === "business_type") {
        const cfg = getLegalConfig(value);
        if (next.business_inn.length > cfg.innLen) next.business_inn = next.business_inn.slice(0, cfg.innLen);
        if (!cfg.showOgrn) next.business_ogrn = "";
        else if (next.business_ogrn.length > cfg.ogrnLen) next.business_ogrn = next.business_ogrn.slice(0, cfg.ogrnLen);
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

  // BIK auto-fill bank name via edge function
  const [bikLoading, setBikLoading] = useState(false);
  const bikLookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleBikChange = useCallback((rawValue: string) => {
    const v = rawValue.replace(/\D/g, "").slice(0, 9);
    setForm((prev) => {
      const next = { ...prev, bank_bik: v, bank_verified: false };
      if (v.length !== 9) next.bank_name = "";
      setVerifyStates((s) => ({ ...s, bank: "idle" }));
      return next;
    });
    if (bikLookupTimer.current) clearTimeout(bikLookupTimer.current);
    if (v.length === 9) {
      setBikLoading(true);
      bikLookupTimer.current = setTimeout(async () => {
        try {
          const { data, error } = await supabase.functions.invoke("bik-lookup", { body: { bik: v } });
          if (!error && data && data.bank_name) {
            setForm((prev) => ({
              ...prev,
              bank_name: data.bank_name,
              ...(data.corr_account && !prev.bank_corr_account ? { bank_corr_account: data.corr_account } : {}),
            }));
          } else {
            setForm((prev) => ({ ...prev, bank_name: "" }));
            if (!error) toast.info("Банк не найден по данному БИК");
          }
        } catch {
          setForm((prev) => ({ ...prev, bank_name: "" }));
        } finally {
          setBikLoading(false);
        }
      }, 300);
    }
  }, []);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

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
    if (dirty) {
      try { await save.mutateAsync(); } catch { return; }
    }
    setVerifyStates((s) => ({ ...s, [type]: "loading" }));
    await new Promise((r) => setTimeout(r, 1200));
    if (type === "business") {
      if (!isLegalFieldsValid(form)) {
        setVerifyStates((s) => ({ ...s, business: "error" }));
        toast.error("Заполните все обязательные поля реквизитов корректно");
        return;
      }
      setForm((f) => ({ ...f, business_verified: true }));
      setVerifyStates((s) => ({ ...s, business: "success" }));
      toast.success("Реквизиты подтверждены (тест)");
    } else if (type === "bank") {
      if (!isBankFieldsValid(form)) {
        setVerifyStates((s) => ({ ...s, bank: "error" }));
        toast.error("Заполните БИК (9 цифр) и расчётный счёт (20 цифр)");
        return;
      }
      if (form.bank_corr_account && form.bank_corr_account.length !== 20) {
        setVerifyStates((s) => ({ ...s, bank: "error" }));
        toast.error("Корр. счёт должен содержать 20 цифр");
        return;
      }
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

  // ─── Section statuses (with dirty awareness) ───
  const legalCfg = getLegalConfig(form.business_type);
  const legalStatus = getSectionStatus(isLegalFieldsValid(form), form.business_verified, legalDirty);
  const bankStatus = getSectionStatus(isBankFieldsValid(form), form.bank_verified, bankDirty);
  const brandStatus = getSectionStatus(!!form.brand_name, true, brandDirty); // brand has no server verification; treat as "verified" if name exists
  const ordStatus = getSectionStatus(!!form.ord_identifier, form.ord_verified, ordDirty);

  // ─── Readiness: split mandatory vs optional ───
  const mandatoryReady = !!(form.brand_name) && !!(form.business_verified && isLegalFieldsValid(form));
  const mandatoryScore = [!!form.brand_name, !!(form.business_verified && isLegalFieldsValid(form))].filter(Boolean).length;
  const optionalItems = [
    { done: !!(form.bank_verified && isBankFieldsValid(form)), label: "Банк", hint: "Для выплат" },
    { done: !!(form.ord_verified && !!form.ord_identifier), label: "ОРД", hint: "Для маркировки рекламы" },
  ];

  if (isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />Загрузка…</div>;
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Sticky save bar */}
      {dirty && (
        <div className="sticky top-0 z-20 bg-warning/10 border-b border-warning/20 px-6 py-2 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2 text-xs text-warning">
            <AlertCircle className="h-3.5 w-3.5" />
            <span className="font-medium">Есть несохранённые изменения</span>
          </div>
          <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()} className="h-7 text-xs gap-1.5">
            <Save className="h-3 w-3" />
            {save.isPending ? "Сохранение…" : "Сохранить"}
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-3 pb-2">
        <div>
          <h2 className="text-base font-bold text-foreground">Настройки рекламодателя</h2>
          <p className="text-xs text-muted-foreground">Верификация и данные бренда для размещения рекламы</p>
        </div>
        <Button size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
          <Save className="h-3.5 w-3.5 mr-1.5" />
          {save.isPending ? "Сохранение…" : "Сохранить"}
        </Button>
      </div>

      {/* Readiness block — split mandatory / optional */}
      <div className="px-6 pb-3 space-y-2">
        {/* Mandatory for deals */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-card-foreground">Готовность к сделкам</span>
            <span className="text-xs text-muted-foreground">{mandatoryScore} / 2</span>
          </div>
          <Progress value={(mandatoryScore / 2) * 100} className="h-1.5" />
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-0.5">
              <SectionCheck status={brandStatus} label="Бренд" />
              <p className="text-[10px] text-muted-foreground pl-5">Обязательно для сделок</p>
            </div>
            <div className="space-y-0.5">
              <SectionCheck status={legalStatus} label="Реквизиты" />
              <p className="text-[10px] text-muted-foreground pl-5">Обязательно для сделок</p>
            </div>
          </div>
          {mandatoryReady && (
            <p className="text-[10px] text-success flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Вы можете создавать сделки</p>
          )}
        </div>
        {/* Optional sections */}
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="grid grid-cols-2 gap-2">
            {optionalItems.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <SectionCheck status={item.done ? "verified" : "empty"} label={item.label} />
                <span className="text-[10px] text-muted-foreground">— {item.hint}</span>
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
              {brandDirty && <Badge variant="outline" className="text-[9px] border-warning/30 text-warning bg-warning/10 ml-1">изменено</Badge>}
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
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="h-9 w-9 rounded border border-dashed border-border flex items-center justify-center flex-shrink-0 hover:border-primary/50 hover:bg-muted/30 transition-colors cursor-pointer"
                    title="Загрузить логотип">
                    <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
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
                  } finally { setUploading(false); }
                }} />
                <Button type="button" size="sm" variant="outline" className="h-9 text-xs gap-1.5" disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5" />
                  {uploading ? "Загрузка…" : form.brand_logo_url ? "Заменить" : "Загрузить"}
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
              <StatusBadge status={legalStatus} />
              <PrivacyLabel isPublic={false} />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2.5 flex-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  Форма собственности *
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[260px]">
                      <p className="text-xs leading-relaxed">
                        <strong>Самозанятый (НПД)</strong> — физлицо на налоге на профдоход. Нужны только ФИО и ИНН (12 цифр), ОГРНИП не требуется.<br />
                        <strong>ИП</strong> — индивидуальный предприниматель. ФИО + ИНН (12) + ОГРНИП (15).<br />
                        <strong>ООО</strong> — юрлицо. Наименование + ИНН (10) + ОГРН (13).
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Select value={form.business_type || ""} onValueChange={(v) => update("business_type", v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Выберите тип" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="self">Самозанятый (НПД)</SelectItem>
                    <SelectItem value="ip">ИП</SelectItem>
                    <SelectItem value="ooo">ООО</SelectItem>
                    <SelectItem value="ul">Юр. лицо (иное)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.business_type && legalCfg.showName && (
                <div className="space-y-1">
                  <Label className="text-xs">{legalCfg.nameLabel}</Label>
                  <Input value={form.business_name} onChange={(e) => update("business_name", e.target.value)}
                    placeholder={legalCfg.namePlaceholder} className="text-sm h-9" maxLength={200} />
                </div>
              )}
            </div>
            {form.business_type && (
              <div className={`grid gap-3 ${legalCfg.showOgrn ? "grid-cols-2" : "grid-cols-1"}`}>
                <div className="space-y-1">
                  <Label className="text-xs">ИНН * <span className="text-muted-foreground font-normal">({legalCfg.innLen} цифр)</span></Label>
                  <Input value={form.business_inn} onChange={(e) => update("business_inn", e.target.value.replace(/\D/g, "").slice(0, legalCfg.innLen))}
                    placeholder={"0".repeat(legalCfg.innLen)} className="text-sm h-9 font-mono" maxLength={legalCfg.innLen} />
                  {form.business_inn.length > 0 && form.business_inn.length !== legalCfg.innLen && (
                    <p className="text-[10px] text-warning">{form.business_inn.length}/{legalCfg.innLen} цифр</p>
                  )}
                </div>
                {legalCfg.showOgrn && (
                  <div className="space-y-1">
                    <Label className="text-xs">{legalCfg.ogrnLabel} * <span className="text-muted-foreground font-normal">({legalCfg.ogrnLen} цифр)</span></Label>
                    <Input value={form.business_ogrn} onChange={(e) => update("business_ogrn", e.target.value.replace(/\D/g, "").slice(0, legalCfg.ogrnLen))}
                      placeholder={"0".repeat(legalCfg.ogrnLen)} className="text-sm h-9 font-mono" maxLength={legalCfg.ogrnLen} />
                    {form.business_ogrn.length > 0 && form.business_ogrn.length !== legalCfg.ogrnLen && (
                      <p className="text-[10px] text-warning">{form.business_ogrn.length}/{legalCfg.ogrnLen} цифр</p>
                    )}
                  </div>
                )}
              </div>
            )}
            {!form.business_type && (
              <p className="text-xs text-muted-foreground py-2">Выберите форму собственности, чтобы заполнить реквизиты</p>
            )}
            <VerifyResult state={verifyStates.business} successText="Реквизиты подтверждены" errorText="Проверьте заполнение полей" />
            {isLegalFieldsValid(form) && !form.business_verified && verifyStates.business !== "success" && (
              <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={() => mockVerify("business")} disabled={verifyStates.business === "loading"}>
                <ShieldCheck className="h-3.5 w-3.5" />
                {dirty ? "Сохранить и проверить" : "Проверить"}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* ──────── 3. Banking ──────── */}
        <Card className="flex flex-col">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Landmark className="h-4 w-4 text-primary" /> Банковские реквизиты
              <StatusBadge status={bankStatus} />
              <PrivacyLabel isPublic={false} />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2.5 flex-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">БИК * <span className="text-muted-foreground font-normal">(9 цифр)</span></Label>
                <div className="flex items-center gap-1.5">
                  <Input value={form.bank_bik} onChange={(e) => handleBikChange(e.target.value)}
                    placeholder="044525974" className="text-sm h-9 font-mono flex-1" maxLength={9} />
                  {form.bank_bik.length === 9 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button type="button" size="sm" variant="ghost" className="h-9 w-9 p-0 flex-shrink-0"
                          onClick={() => { navigator.clipboard.writeText(form.bank_bik); toast.success("БИК скопирован"); }}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p className="text-xs">Копировать</p></TooltipContent>
                    </Tooltip>
                  )}
                </div>
                {form.bank_bik.length > 0 && form.bank_bik.length !== 9 && (
                  <p className="text-[10px] text-warning">{form.bank_bik.length}/9 цифр</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Банк</Label>
                <div className="relative">
                  <Input value={form.bank_name} readOnly
                    placeholder={bikLoading ? "Определяется…" : "Заполнится автоматически по БИК"}
                    className="text-sm h-9 bg-muted/30 cursor-not-allowed" />
                  {bikLoading && <Loader2 className="h-3.5 w-3.5 animate-spin absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />}
                </div>
                <p className="text-[10px] text-muted-foreground"><Info className="h-2.5 w-2.5 inline mr-0.5 -mt-px" />Определяется автоматически по БИК</p>
              </div>
            </div>

            {/* Account numbers with show/hide toggle and copy */}
            <div className="flex items-center gap-2 mb-1">
              <Label className="text-xs text-muted-foreground">Номера счетов</Label>
              <button type="button" onClick={() => setShowBankNumbers(!showBankNumbers)}
                className="text-muted-foreground hover:text-foreground transition-colors">
                {showBankNumbers ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Расчётный счёт * <span className="text-muted-foreground font-normal">(20 цифр)</span></Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    value={showBankNumbers || !form.bank_account ? form.bank_account : "••••" + form.bank_account.slice(-4)}
                    onChange={showBankNumbers ? (e) => update("bank_account", e.target.value.replace(/\D/g, "").slice(0, 20)) : undefined}
                    readOnly={!showBankNumbers}
                    placeholder="40802810..."
                    className={`text-sm h-9 font-mono flex-1 ${!showBankNumbers && form.bank_account ? "bg-muted/30 cursor-not-allowed" : ""}`}
                    maxLength={20}
                  />
                  {form.bank_account.length === 20 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button type="button" size="sm" variant="ghost" className="h-9 w-9 p-0 flex-shrink-0"
                          onClick={() => { navigator.clipboard.writeText(form.bank_account); toast.success("Счёт скопирован"); }}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p className="text-xs">Копировать</p></TooltipContent>
                    </Tooltip>
                  )}
                </div>
                {showBankNumbers && form.bank_account.length > 0 && form.bank_account.length !== 20 && (
                  <p className="text-[10px] text-warning">{form.bank_account.length}/20 цифр</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Корр. счёт <span className="text-muted-foreground font-normal">(20 цифр)</span></Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    value={showBankNumbers || !form.bank_corr_account ? form.bank_corr_account : "••••" + form.bank_corr_account.slice(-4)}
                    onChange={showBankNumbers ? (e) => update("bank_corr_account", e.target.value.replace(/\D/g, "").slice(0, 20)) : undefined}
                    readOnly={!showBankNumbers}
                    placeholder="30101810..."
                    className={`text-sm h-9 font-mono flex-1 ${!showBankNumbers && form.bank_corr_account ? "bg-muted/30 cursor-not-allowed" : ""}`}
                    maxLength={20}
                  />
                  {form.bank_corr_account.length === 20 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button type="button" size="sm" variant="ghost" className="h-9 w-9 p-0 flex-shrink-0"
                          onClick={() => { navigator.clipboard.writeText(form.bank_corr_account); toast.success("Корр. счёт скопирован"); }}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p className="text-xs">Копировать</p></TooltipContent>
                    </Tooltip>
                  )}
                </div>
                {showBankNumbers && form.bank_corr_account.length > 0 && form.bank_corr_account.length !== 20 && (
                  <p className="text-[10px] text-warning">{form.bank_corr_account.length}/20 цифр</p>
                )}
              </div>
            </div>
            <VerifyResult state={verifyStates.bank} successText="Банк подтверждён" errorText="Проверьте заполнение" />
            {isBankFieldsValid(form) && !form.bank_verified && verifyStates.bank !== "success" && (
              <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={() => mockVerify("bank")} disabled={verifyStates.bank === "loading"}>
                <ShieldCheck className="h-3.5 w-3.5" />
                {dirty ? "Сохранить и проверить" : "Проверить"}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* ──────── 4. ORD ──────── */}
        <Card className="flex flex-col">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> ОРД — Маркировка рекламы
              <StatusBadge status={ordStatus} />
              <PrivacyLabel isPublic={false} />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-3 flex-1">
            {!form.ord_verified && verifyStates.ord !== "success" ? (
              <>
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <span className="font-medium text-card-foreground">ОРД (Оператор рекламных данных)</span> — обязательная система маркировки рекламы в РФ.
                    Выберите провайдера и подключитесь.
                  </p>
                </div>
                {/* Provider selection as radio-like chips */}
                <div className="space-y-1">
                  <Label className="text-xs">Провайдер ОРД *</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {ORD_PROVIDERS.map((p) => {
                      const selected = form.ord_identifier === p.id;
                      return (
                        <button key={p.id} type="button"
                          onClick={() => update("ord_identifier", p.id)}
                          className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${
                            selected
                              ? "border-primary bg-primary/15 text-primary font-medium"
                              : "border-border bg-muted/20 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                          }`}>
                          {selected && <CheckCircle2 className="h-3 w-3 inline mr-1 -mt-px" />}
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                  {/* Or custom input */}
                  {form.ord_identifier && !ORD_PROVIDERS.some((p) => p.id === form.ord_identifier) && (
                    <p className="text-[10px] text-muted-foreground">Пользовательский: {form.ord_identifier}</p>
                  )}
                  <div className="pt-1">
                    <Input value={ORD_PROVIDERS.some((p) => p.id === form.ord_identifier) ? "" : form.ord_identifier}
                      onChange={(e) => update("ord_identifier", e.target.value)}
                      placeholder="Или введите идентификатор вручную" className="text-sm h-8" maxLength={100} />
                  </div>
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
                <VerifyResult state={verifyStates.ord} successText="ОРД подключён" errorText="Проверьте идентификатор" />
                <Button size="sm" className="gap-1.5 h-9 text-xs" onClick={() => mockVerify("ord")}
                  disabled={verifyStates.ord === "loading" || !form.ord_identifier}>
                  <PlugZap className="h-3.5 w-3.5" />
                  {dirty ? "Сохранить и подключить" : "Подключить ОРД"}
                </Button>
              </>
            ) : (
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
                    <p>Провайдер: <span className="text-card-foreground">{ORD_PROVIDERS.find((p) => p.id === form.ord_identifier)?.label || form.ord_identifier || "—"}</span></p>
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
