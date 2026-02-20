import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  Send, Save, CalendarIcon, Upload, X, Lock, FileText,
  Video, FileEdit, Mic, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const PLACEMENT_TYPES = [
  { value: "video", label: "Видео-интеграция", icon: Video },
  { value: "post", label: "Пост", icon: FileEdit },
  { value: "podcast", label: "Подкаст", icon: Mic },
] as const;

const MARKING_OPTIONS = [
  { value: "platform", label: "Платформа маркирует (по умолчанию)" },
  { value: "advertiser", label: "Рекламодатель предоставляет данные" },
];

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
}

export function DealProposalForm({ open, onClose, creator }: DealProposalFormProps) {
  const { user, profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [placementType, setPlacementType] = useState("");
  const [platform, setPlatform] = useState("");
  const [budgetFixed, setBudgetFixed] = useState("");
  const [deadline, setDeadline] = useState<Date | undefined>();
  const [briefText, setBriefText] = useState("");
  const [revisions, setRevisions] = useState("");
  const [acceptanceCriteria, setAcceptanceCriteria] = useState("");
  const [marking, setMarking] = useState("platform");
  const [platformCompliance, setPlatformCompliance] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Derive starting price from creator offers
  const PLACEMENT_LABEL_MAP: Record<string, string> = {
    video: "Видео-интеграция",
    post: "Пост",
    podcast: "Подкаст",
  };
  const selectedOffer = creator.offers.find(
    (o) => o.type === PLACEMENT_LABEL_MAP[placementType]
  );

  const canSubmit =
    placementType !== "" &&
    budgetFixed.trim() !== "" &&
    deadline !== undefined &&
    briefText.trim() !== "" &&
    platformCompliance;

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!user || !canSubmit) return;
    setSubmitting(true);
    try {
      const advertiserName = profile?.display_name || user.email || "";

      // 1. Create deal
      const { data: deal, error: dealErr } = await supabase.from("deals").insert({
        title: `${PLACEMENT_LABEL_MAP[placementType]} — ${creator.displayName}`,
        advertiser_id: user.id,
        advertiser_name: advertiserName,
        creator_id: creator.userId,
        creator_name: creator.displayName,
        budget: parseInt(budgetFixed) || 0,
        status: "pending",
        deadline: deadline?.toISOString() || null,
        description: briefText,
      }).select().single();

      if (dealErr) throw dealErr;

      // 2. Create initial deal terms
      const termsFields = {
        placementType: PLACEMENT_LABEL_MAP[placementType],
        platform: platform || "—",
        budget: budgetFixed,
        deadline: deadline ? format(deadline, "dd.MM.yyyy") : "",
        brief: briefText,
        revisions: revisions || "Не указано",
        acceptanceCriteria: acceptanceCriteria || "Не указано",
        markingResponsibility: marking === "platform" ? "Платформа" : "Рекламодатель",
      };

      await supabase.from("deal_terms").insert({
        deal_id: deal.id,
        created_by: user.id,
        version: 1,
        status: "draft",
        fields: termsFields,
      });

      // 3. Audit log
      await supabase.from("deal_audit_log").insert({
        deal_id: deal.id,
        user_id: user.id,
        action: "Отправил предложение о сделке",
        category: "general",
        metadata: { placementType: PLACEMENT_LABEL_MAP[placementType], budget: budgetFixed },
      });

      // 4. Upload files if any
      for (const file of files) {
        const path = `${user.id}/${deal.id}/${Date.now()}_${file.name}`;
        const { error: upErr } = await supabase.storage.from("deal-files").upload(path, file);
        if (!upErr) {
          await supabase.from("deal_files").insert({
            deal_id: deal.id,
            user_id: user.id,
            file_name: file.name,
            file_size: file.size,
            file_type: file.type,
            category: "brief",
            storage_path: path,
          });
        }
      }

      toast.success("Предложение отправлено автору");
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error("Ошибка при отправке предложения");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[720px] max-h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-3">
          <DialogTitle className="text-lg">Предложение о сделке</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-130px)]">
          <div className="px-6 pb-6 space-y-5">
            {/* Summary strip */}
            <div className="flex items-center gap-3 bg-muted/40 rounded-lg px-4 py-3">
              <img
                src={creator.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${creator.userId}`}
                alt="" className="h-10 w-10 rounded-full bg-muted object-cover shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-foreground truncate">{creator.displayName}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[10px] h-5 gap-0.5 border-primary/40 text-primary">
                    <Lock className="h-2.5 w-2.5" />Platform-only
                  </Badge>
                  {selectedOffer && (
                    <span className="text-[12px] text-muted-foreground">
                      {selectedOffer.type}: от {selectedOffer.price.toLocaleString("ru-RU")} ₽
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 1. Placement type */}
            <div className="space-y-2">
              <label className="text-[13px] font-semibold text-foreground">
                Тип размещения <span className="text-destructive">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {PLACEMENT_TYPES.map((pt) => {
                  const Icon = pt.icon;
                  const offer = creator.offers.find((o) => o.type === PLACEMENT_LABEL_MAP[pt.value]);
                  return (
                    <button
                      key={pt.value}
                      type="button"
                      onClick={() => setPlacementType(pt.value)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-center transition-colors",
                        placementType === pt.value
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border hover:border-primary/30 text-muted-foreground"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-[13px] font-medium">{pt.label}</span>
                      {offer && (
                        <span className="text-[11px]">от {offer.price.toLocaleString("ru-RU")} ₽</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Platform/channel */}
            {creator.platforms.length > 1 && (
              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-foreground">Платформа / канал</label>
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

            <Separator />

            {/* 3. Budget */}
            <div className="space-y-2">
              <label className="text-[13px] font-semibold text-foreground">
                Бюджет (₽) <span className="text-destructive">*</span>
              </label>
              <Input
                type="number"
                value={budgetFixed}
                onChange={(e) => setBudgetFixed(e.target.value)}
                placeholder={selectedOffer ? `Минимум: ${selectedOffer.price.toLocaleString("ru-RU")} ₽` : "Укажите сумму"}
                className="h-9"
              />
            </div>

            {/* 4. Deadline */}
            <div className="space-y-2">
              <label className="text-[13px] font-semibold text-foreground">
                Срок / дата публикации <span className="text-destructive">*</span>
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start h-9 text-left font-normal", !deadline && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {deadline ? format(deadline, "dd MMMM yyyy", { locale: ru }) : "Выберите дату"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={deadline}
                    onSelect={setDeadline}
                    disabled={(date) => date < new Date()}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <Separator />

            {/* 5. Brief */}
            <div className="space-y-2">
              <label className="text-[13px] font-semibold text-foreground">
                Бриф: сообщение, CTA, ограничения <span className="text-destructive">*</span>
              </label>
              <Textarea
                value={briefText}
                onChange={(e) => setBriefText(e.target.value)}
                placeholder="Опишите ключевое сообщение, призыв к действию и ограничения..."
                rows={4}
                className="text-[14px]"
              />
            </div>

            {/* 6. Deliverables */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-foreground">Кол-во правок</label>
                <Input
                  type="number"
                  value={revisions}
                  onChange={(e) => setRevisions(e.target.value)}
                  placeholder="Напр. 2"
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-foreground">Критерии приёмки</label>
                <Input
                  value={acceptanceCriteria}
                  onChange={(e) => setAcceptanceCriteria(e.target.value)}
                  placeholder="Утверждение рекламодателем"
                  className="h-9"
                />
              </div>
            </div>

            <Separator />

            {/* 7. Marking (ORD) */}
            <div className="space-y-2">
              <label className="text-[13px] font-semibold text-foreground">Маркировка (ОРД)</label>
              <Select value={marking} onValueChange={setMarking}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MARKING_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 8. Files */}
            <div className="space-y-2">
              <label className="text-[13px] font-semibold text-foreground">Файлы брифа</label>
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

            <Separator />

            {/* Compliance */}
            <label className="flex items-start gap-2.5 cursor-pointer">
              <Checkbox
                checked={platformCompliance}
                onCheckedChange={(v) => setPlatformCompliance(v === true)}
                className="mt-0.5"
              />
              <span className="text-[13px] text-foreground leading-snug">
                Вся коммуникация и поставка контента происходят исключительно внутри платформы <span className="text-destructive">*</span>
              </span>
            </label>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-3.5 border-t border-border bg-card">
          <Button variant="outline" size="sm" onClick={onClose} className="h-9">Отмена</Button>
          <Button
            size="sm"
            className="h-9 gap-1.5"
            disabled={!canSubmit || submitting}
            onClick={handleSubmit}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Отправить предложение
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
