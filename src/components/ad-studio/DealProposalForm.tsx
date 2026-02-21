import { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  Send, Save, CalendarIcon, Upload, X, Lock, FileText,
  Video, FileEdit, Mic, Loader2, ChevronDown, HelpCircle, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useExistingDraft, useSaveDraft, type DealProposal } from "@/hooks/useDealProposals";
import { useNavigate } from "react-router-dom";

/* ── Constants ── */

const PLACEMENT_TYPES = [
  { value: "video", label: "Видео", fullLabel: "Видео-интеграция", icon: Video, hint: "Рекламная вставка в видеоролике" },
  { value: "post", label: "Пост", fullLabel: "Пост", icon: FileEdit, hint: "Рекламный пост в канале / блоге" },
  { value: "podcast", label: "Подкаст", fullLabel: "Подкаст", icon: Mic, hint: "Спонсорская вставка в подкасте" },
] as const;

const PLACEMENT_LABEL_MAP: Record<string, string> = {
  video: "Видео-интеграция",
  post: "Пост",
  podcast: "Подкаст",
};

const MARKING_OPTIONS = [
  { value: "platform", label: "Платформа маркирует" },
  { value: "advertiser", label: "Рекламодатель предоставляет данные" },
];

const BRIEF_PLACEHOLDER = `• Ключевое сообщение: …
• Призыв к действию (CTA): …
• Ограничения / запреты: …`;

/* ── Types ── */

interface CreatorInfo {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  offers: { type: string; price: number }[];
  platforms: { name: string; metric: string }[];
}

interface DealProposalFormProps {
  open: boolean;
  onClose: () => void;
  creator: CreatorInfo;
  /** Pre-loaded draft to resume */
  resumeDraft?: DealProposal | null;
}

/* ── Component ── */

export function DealProposalForm({ open, onClose, creator, resumeDraft }: DealProposalFormProps) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveDraftMutation = useSaveDraft();

  /* Core fields */
  const [draftId, setDraftId] = useState<string | null>(null);
  const [placementType, setPlacementType] = useState("");
  const [platform, setPlatform] = useState("");
  const [budgetMode, setBudgetMode] = useState<"fixed" | "range">("fixed");
  const [budgetFixed, setBudgetFixed] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [deadlineStart, setDeadlineStart] = useState<Date | undefined>();
  const [deadlineEnd, setDeadlineEnd] = useState<Date | undefined>();
  const [briefText, setBriefText] = useState("");
  const [platformCompliance, setPlatformCompliance] = useState(false);
  const [budgetAutoFilled, setBudgetAutoFilled] = useState(false);

  /* Detail fields */
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [revisions, setRevisions] = useState("");
  const [acceptanceCriteria, setAcceptanceCriteria] = useState("");
  const [marking, setMarking] = useState("platform");
  const [files, setFiles] = useState<File[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load draft data when resumeDraft is provided
  useEffect(() => {
    if (resumeDraft && open) {
      setDraftId(resumeDraft.id);
      // Reverse-map placement type
      const ptEntry = Object.entries(PLACEMENT_LABEL_MAP).find(([_, v]) => v === resumeDraft.placement_type);
      setPlacementType(ptEntry ? ptEntry[0] : resumeDraft.placement_type);
      if (resumeDraft.budget_value) {
        setBudgetMode("fixed");
        setBudgetFixed(String(resumeDraft.budget_value));
      } else if (resumeDraft.budget_min || resumeDraft.budget_max) {
        setBudgetMode("range");
        setBudgetMin(String(resumeDraft.budget_min || ""));
        setBudgetMax(String(resumeDraft.budget_max || ""));
      }
      if (resumeDraft.publish_start) setDeadlineStart(new Date(resumeDraft.publish_start));
      if (resumeDraft.publish_end) setDeadlineEnd(new Date(resumeDraft.publish_end));
      setBriefText(resumeDraft.brief_text || "");
      setRevisions(String(resumeDraft.revisions_count || ""));
      setAcceptanceCriteria(resumeDraft.acceptance_criteria || "");
      setMarking(resumeDraft.ord_responsibility || "platform");
    }
  }, [resumeDraft, open]);

  // Reset form on close
  const resetForm = useCallback(() => {
    setDraftId(null);
    setPlacementType("");
    setPlatform("");
    setBudgetMode("fixed");
    setBudgetFixed("");
    setBudgetMin("");
    setBudgetMax("");
    setDeadlineStart(undefined);
    setDeadlineEnd(undefined);
    setBriefText("");
    setPlatformCompliance(false);
    setBudgetAutoFilled(false);
    setDetailsOpen(false);
    setRevisions("");
    setAcceptanceCriteria("");
    setMarking("platform");
    setFiles([]);
  }, []);

  /* Derived */
  const selectedOffer = creator.offers.find((o) => o.type === PLACEMENT_LABEL_MAP[placementType]);

  // Auto-fill budget from creator offer when placement type changes
  useEffect(() => {
    if (placementType && selectedOffer && !budgetFixed && !budgetMin && !resumeDraft) {
      setBudgetFixed(String(selectedOffer.price));
      setBudgetAutoFilled(true);
    } else if (!selectedOffer) {
      setBudgetAutoFilled(false);
    }
  }, [placementType, selectedOffer]);

  const budgetDisplay = budgetMode === "fixed"
    ? (budgetFixed ? `${parseInt(budgetFixed).toLocaleString("ru-RU")} ₽` : "—")
    : (budgetMin && budgetMax ? `${parseInt(budgetMin).toLocaleString("ru-RU")} – ${parseInt(budgetMax).toLocaleString("ru-RU")} ₽` : "—");

  const deadlineDisplay = deadlineStart
    ? deadlineEnd
      ? `${format(deadlineStart, "dd.MM", { locale: ru })} – ${format(deadlineEnd, "dd.MM.yyyy", { locale: ru })}`
      : format(deadlineStart, "dd MMM yyyy", { locale: ru })
    : "—";

  const budgetValue = budgetMode === "fixed" ? budgetFixed.trim() !== "" : (budgetMin.trim() !== "" && budgetMax.trim() !== "");

  const canSubmit =
    placementType !== "" &&
    budgetValue &&
    deadlineStart !== undefined &&
    briefText.trim() !== "" &&
    platformCompliance;

  /* Handlers */
  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
  };
  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const buildDraftPayload = (): Partial<DealProposal> & { creator_id: string } => ({
    ...(draftId ? { id: draftId } : {}),
    creator_id: creator.userId,
    placement_type: PLACEMENT_LABEL_MAP[placementType] || placementType,
    budget_value: budgetMode === "fixed" && budgetFixed ? parseInt(budgetFixed) : null,
    budget_min: budgetMode === "range" && budgetMin ? parseInt(budgetMin) : null,
    budget_max: budgetMode === "range" && budgetMax ? parseInt(budgetMax) : null,
    publish_start: deadlineStart?.toISOString() || null,
    publish_end: deadlineEnd?.toISOString() || null,
    brief_text: briefText,
    revisions_count: revisions ? parseInt(revisions) : 0,
    acceptance_criteria: acceptanceCriteria,
    ord_responsibility: marking,
  });

  const handleSaveDraft = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const result = await saveDraftMutation.mutateAsync(buildDraftPayload());
      setDraftId(result.id);
      toast.success("Черновик сохранён");
    } catch {
      toast.error("Ошибка сохранения черновика");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || !canSubmit) return;
    setSubmitting(true);
    try {
      const advertiserName = profile?.display_name || user.email || "";
      const finalBudget = budgetMode === "fixed" ? parseInt(budgetFixed) || 0 : parseInt(budgetMax) || 0;

      const { data: deal, error: dealErr } = await supabase.from("deals").insert({
        title: `${PLACEMENT_LABEL_MAP[placementType]} — ${creator.displayName}`,
        advertiser_id: user.id,
        advertiser_name: advertiserName,
        creator_id: creator.userId,
        creator_name: creator.displayName,
        budget: finalBudget,
        status: "pending",
        deadline: deadlineStart?.toISOString() || null,
        description: briefText,
      }).select().single();

      if (dealErr) throw dealErr;

      await supabase.from("deal_terms").insert({
        deal_id: deal.id,
        created_by: user.id,
        version: 1,
        status: "draft",
        fields: {
          placementType: PLACEMENT_LABEL_MAP[placementType],
          platform: platform || "—",
          budget: budgetMode === "fixed" ? budgetFixed : `${budgetMin}–${budgetMax}`,
          budgetMode,
          deadlineStart: deadlineStart ? format(deadlineStart, "dd.MM.yyyy") : "",
          deadlineEnd: deadlineEnd ? format(deadlineEnd, "dd.MM.yyyy") : "",
          brief: briefText,
          revisions: revisions || "Не указано",
          acceptanceCriteria: acceptanceCriteria || "Не указано",
          markingResponsibility: marking === "platform" ? "Платформа" : "Рекламодатель",
        },
      });

      await supabase.from("deal_audit_log").insert({
        deal_id: deal.id,
        user_id: user.id,
        action: "Отправил предложение о сделке",
        category: "general",
        metadata: { placementType: PLACEMENT_LABEL_MAP[placementType], budget: finalBudget },
      });

      // If we had a draft, mark it as sent
      if (draftId) {
        await supabase.from("deal_proposals" as any).update({ status: "sent" }).eq("id", draftId);
      }

      for (const file of files) {
        const path = `${user.id}/${deal.id}/${Date.now()}_${file.name}`;
        const { error: upErr } = await supabase.storage.from("deal-files").upload(path, file);
        if (!upErr) {
          await supabase.from("deal_files").insert({
            deal_id: deal.id, user_id: user.id, file_name: file.name,
            file_size: file.size, file_type: file.type, category: "brief", storage_path: path,
          });
        }
      }

      if (creator.userId) {
        await supabase.from("notifications").insert({
          user_id: creator.userId,
          title: "Новое предложение о сделке",
          message: `${advertiserName} предлагает сотрудничество: ${PLACEMENT_LABEL_MAP[placementType]}, бюджет ${finalBudget.toLocaleString()} ₽`,
          type: "deal",
          link: "/marketplace",
        });
      }

      toast.success("Предложение отправлено автору", {
        action: {
          label: "Перейти в Мои сделки",
          onClick: () => navigate("/ad-studio"),
        },
      });
      resetForm();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error("Ошибка при отправке предложения");
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Render ── */
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { resetForm(); onClose(); } }}>
      <DialogContent className="max-w-[720px] max-h-[90vh] p-0 gap-0 flex flex-col">
        <DialogHeader className="px-6 pt-5 pb-0">
          <DialogTitle className="text-lg">
            Предложение о сделке
            {draftId && <Badge variant="secondary" className="ml-2 text-[10px]">Черновик</Badge>}
          </DialogTitle>
        </DialogHeader>

        {/* ── Summary strip ── */}
        <div className="mx-6 mt-3 flex items-center gap-3 bg-muted/40 rounded-lg px-4 py-2.5">
          <img
            src={creator.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${creator.userId}`}
            alt="" className="h-9 w-9 rounded-full bg-muted object-cover shrink-0"
          />
          <div className="flex-1 min-w-0 flex items-center gap-4 flex-wrap">
            <span className="text-[14px] font-semibold text-foreground truncate">{creator.displayName}</span>
            {placementType && (
              <Badge variant="secondary" className="text-[11px] h-5">{PLACEMENT_LABEL_MAP[placementType]}</Badge>
            )}
            <span className="text-[12px] text-muted-foreground">{budgetDisplay}</span>
            <span className="text-[12px] text-muted-foreground">{deadlineDisplay}</span>
          </div>
        </div>

        <ScrollArea className="flex-1 max-h-[calc(90vh-200px)]">
          <div className="px-6 pb-4 pt-4 space-y-1">

            {/* ═══════════ Section A: Core (required) ═══════════ */}
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex items-center justify-between w-full py-2.5 group">
                <span className="text-[13px] font-bold uppercase tracking-wider text-foreground">
                  Основное <span className="text-destructive text-[11px] normal-case ml-1">обязательно</span>
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-5 pb-4">

                {/* Placement type — segmented control */}
                <div className="space-y-2">
                  <FieldLabel required>Тип размещения</FieldLabel>
                  <div className="grid grid-cols-3 gap-0 border border-border rounded-lg overflow-hidden">
                    {PLACEMENT_TYPES.map((pt) => {
                      const Icon = pt.icon;
                      const selected = placementType === pt.value;
                      const offer = creator.offers.find((o) => o.type === PLACEMENT_LABEL_MAP[pt.value]);
                      return (
                        <button
                          key={pt.value}
                          type="button"
                          onClick={() => { setPlacementType(pt.value); setBudgetAutoFilled(false); }}
                          className={cn(
                            "flex flex-col items-center gap-1 px-3 py-3.5 text-center transition-colors relative",
                            "border-r last:border-r-0 border-border",
                            selected
                              ? "bg-primary/10 text-primary"
                              : "bg-background hover:bg-muted/50 text-muted-foreground"
                          )}
                        >
                          <Icon className={cn("h-6 w-6", selected && "text-primary")} />
                          <span className={cn("text-[14px] font-semibold", selected && "text-primary")}>{pt.label}</span>
                          <span className="text-[11px] leading-tight opacity-70">{pt.hint}</span>
                          {offer && (
                            <span className="text-[11px] font-medium mt-0.5">от {offer.price.toLocaleString("ru-RU")} ₽</span>
                          )}
                          {selected && (
                            <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-primary rounded-t-sm" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Platform selector (if multiple) */}
                {creator.platforms.length > 1 && (
                  <div className="space-y-1.5">
                    <FieldLabel>Платформа / канал</FieldLabel>
                    <Select value={platform} onValueChange={setPlatform}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Выберите платформу" /></SelectTrigger>
                      <SelectContent>
                        {creator.platforms.map((p) => (
                          <SelectItem key={p.name} value={p.name}>{p.name} ({p.metric})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Budget */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <FieldLabel required>Бюджет (₽)</FieldLabel>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className={cn("text-[12px]", budgetMode === "fixed" ? "text-foreground font-medium" : "text-muted-foreground")}>
                        Фиксированный
                      </span>
                      <Switch
                        checked={budgetMode === "range"}
                        onCheckedChange={(v) => setBudgetMode(v ? "range" : "fixed")}
                        className="h-5 w-9 data-[state=checked]:bg-primary"
                      />
                      <span className={cn("text-[12px]", budgetMode === "range" ? "text-foreground font-medium" : "text-muted-foreground")}>
                        Диапазон
                      </span>
                    </label>
                  </div>

                  {budgetMode === "fixed" ? (
                    <div className="space-y-1">
                      <div className="relative">
                        <Input
                          type="number"
                          value={budgetFixed}
                          onChange={(e) => { setBudgetFixed(e.target.value); setBudgetAutoFilled(false); }}
                          placeholder={selectedOffer ? `напр. ${selectedOffer.price.toLocaleString("ru-RU")}` : "напр. 50 000"}
                          className="h-10 pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">₽</span>
                      </div>
                      {budgetAutoFilled && selectedOffer && (
                        <p className="text-[11px] text-primary flex items-center gap-1">
                          <Info className="h-3 w-3" />На основе оффера автора
                        </p>
                      )}
                      {!selectedOffer && placementType && (
                        <p className="text-[11px] text-muted-foreground">Цена по запросу — автор не указал оффер</p>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="relative">
                        <Input
                          type="number"
                          value={budgetMin}
                          onChange={(e) => setBudgetMin(e.target.value)}
                          placeholder="От (напр. 30 000)"
                          className="h-10 pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">₽</span>
                      </div>
                      <div className="relative">
                        <Input
                          type="number"
                          value={budgetMax}
                          onChange={(e) => setBudgetMax(e.target.value)}
                          placeholder="До (напр. 80 000)"
                          className="h-10 pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">₽</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Deadline — date range */}
                <div className="space-y-2">
                  <FieldLabel required>Окно публикации</FieldLabel>
                  <div className="grid grid-cols-2 gap-2">
                    <DatePickerField
                      value={deadlineStart}
                      onChange={setDeadlineStart}
                      placeholder="Начало"
                      minDate={new Date()}
                    />
                    <DatePickerField
                      value={deadlineEnd}
                      onChange={setDeadlineEnd}
                      placeholder="Конец (опц.)"
                      minDate={deadlineStart || new Date()}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">Укажите диапазон дат, когда публикация допустима. Второе поле необязательно.</p>
                </div>

                {/* Brief */}
                <div className="space-y-2">
                  <FieldLabel required>Бриф</FieldLabel>
                  <Textarea
                    value={briefText}
                    onChange={(e) => setBriefText(e.target.value)}
                    placeholder={BRIEF_PLACEHOLDER}
                    rows={5}
                    className="text-[14px] leading-relaxed"
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* ═══════════ Section B: Details (optional) ═══════════ */}
            <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
              <CollapsibleTrigger className="flex items-center justify-between w-full py-2.5 border-t border-border group">
                <span className="text-[13px] font-bold uppercase tracking-wider text-foreground">
                  Детали <span className="text-muted-foreground text-[11px] normal-case ml-1">опционально</span>
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pb-4">

                {/* Revisions & acceptance */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <FieldLabel>Кол-во правок</FieldLabel>
                    <Input type="number" value={revisions} onChange={(e) => setRevisions(e.target.value)} placeholder="напр. 2" className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel>Критерии приёмки</FieldLabel>
                    <Input value={acceptanceCriteria} onChange={(e) => setAcceptanceCriteria(e.target.value)} placeholder="Утверждение рекламодателем" className="h-9" />
                  </div>
                </div>

                {/* Files */}
                <div className="space-y-2">
                  <FieldLabel>Файлы брифа</FieldLabel>
                  <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileAdd} />
                  <Button variant="outline" size="sm" className="h-8 text-[12px] gap-1.5" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-3.5 w-3.5" />Прикрепить файлы
                  </Button>
                  {files.length > 0 && (
                    <div className="space-y-1 mt-1">
                      {files.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 bg-muted/30 rounded-md px-2.5 py-1.5">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-[12px] text-foreground truncate flex-1">{f.name}</span>
                          <span className="text-[11px] text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
                          <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Marking (ORD) */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <FieldLabel>Маркировка (ОРД)</FieldLabel>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[260px] text-[12px]">
                          По закону рекламные интеграции должны быть промаркированы через ОРД. По умолчанию платформа берёт это на себя.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Select value={marking} onValueChange={setMarking}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MARKING_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </ScrollArea>

        {/* ── Platform-only checkbox (above footer) ── */}
        <div className="px-6 py-2.5 border-t border-border">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <Checkbox
              checked={platformCompliance}
              onCheckedChange={(v) => setPlatformCompliance(v === true)}
            />
            <span className="text-[13px] text-foreground leading-snug flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-primary shrink-0" />
              Работа и оплата — только через платформу <span className="text-destructive">*</span>
            </span>
          </label>
        </div>

        {/* ── Footer: 3 actions ── */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-card">
          <Button variant="ghost" size="sm" onClick={() => { resetForm(); onClose(); }} className="h-9 text-muted-foreground">
            Отмена
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={handleSaveDraft} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Черновик
            </Button>
            <Button
              size="sm"
              className="h-9 gap-1.5"
              disabled={!canSubmit || submitting}
              onClick={handleSubmit}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Отправить
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Shared sub-components ── */

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="text-[13px] font-semibold text-foreground">
      {children} {required && <span className="text-destructive">*</span>}
    </label>
  );
}

function DatePickerField({ value, onChange, placeholder, minDate }: {
  value: Date | undefined;
  onChange: (d: Date | undefined) => void;
  placeholder: string;
  minDate: Date;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("w-full justify-start h-10 text-left font-normal", !value && "text-muted-foreground")}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, "dd MMM yyyy", { locale: ru }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          disabled={(date) => date < minDate}
          initialFocus
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}
