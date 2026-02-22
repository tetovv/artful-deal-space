import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Download, Upload, FileText, Clock, AlertTriangle, CheckCircle2, XCircle, Loader2, Copy, Info, Trash2, FileJson, FileSpreadsheet, Rss, Shield, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { format as formatDate } from "date-fns";
import { ru } from "date-fns/locale";

/* ─────────── Types ─────────── */
interface DataExport {
  id: string;
  status: string;
  categories: string[];
  format: string;
  file_path: string | null;
  file_size: number | null;
  error: string | null;
  created_at: string;
  finished_at: string | null;
  expires_at: string | null;
  downloaded_at: string | null;
}

interface DataImport {
  id: string;
  status: string;
  categories: string[];
  format: string;
  preview_data: any;
  result_data: any;
  conflict_strategy: string;
  error: string | null;
  created_at: string;
  confirmed_at: string | null;
  finished_at: string | null;
}

/* ─────────── Constants ─────────── */
const EXPORT_CATEGORIES = [
  { id: "subscriptions", label: "Подписки", description: "Авторы, на которых вы подписаны", icon: Rss },
  { id: "playlists", label: "Плейлисты и коллекции", description: "Списки с контентом и метаданные", icon: FileText },
  { id: "bookmarks", label: "Закладки / Смотреть позже", description: "Сохранённый контент", icon: Clock },
  { id: "templates", label: "Шаблоны (метаданные)", description: "Только метаданные шаблонов, без файлов", icon: FileJson },
  { id: "projects", label: "Проекты (метаданные)", description: "Структура рабочего пространства, без приватных файлов", icon: FileSpreadsheet },
] as const;

const FORMAT_OPTIONS = [
  { value: "json", label: "JSON", description: "Универсальный формат с версионированием", icon: FileJson },
  { value: "opml", label: "OPML", description: "Для подписок (частичный: только подписки)", icon: Rss },
  { value: "csv", label: "CSV", description: "Таблицы: плейлисты, закладки, подписки", icon: FileSpreadsheet },
] as const;

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  queued: { label: "В очереди", color: "text-muted-foreground", icon: Clock },
  running: { label: "Генерация…", color: "text-primary", icon: Loader2 },
  ready: { label: "Готов", color: "text-success", icon: CheckCircle2 },
  failed: { label: "Ошибка", color: "text-destructive", icon: XCircle },
};

/* ─────────── Component ─────────── */
export default function DataPortabilitySection() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("export");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Download className="h-4 w-4" />
          Переносимость данных
        </CardTitle>
        <p className="text-xs text-muted-foreground">Экспорт и импорт ваших данных в стандартных форматах</p>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="export" className="flex-1 gap-1.5"><Download className="h-3.5 w-3.5" />Экспорт</TabsTrigger>
            <TabsTrigger value="import" className="flex-1 gap-1.5"><Upload className="h-3.5 w-3.5" />Импорт</TabsTrigger>
            <TabsTrigger value="schema" className="flex-1 gap-1.5"><FileText className="h-3.5 w-3.5" />Схема</TabsTrigger>
          </TabsList>

          <TabsContent value="export"><ExportTab userId={user?.id} /></TabsContent>
          <TabsContent value="import"><ImportTab userId={user?.id} /></TabsContent>
          <TabsContent value="schema"><SchemaTab /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════
   EXPORT TAB
   ═══════════════════════════════════════ */
function ExportTab({ userId }: { userId?: string }) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["subscriptions", "playlists", "bookmarks"]);
  const [format, setFormat] = useState("json");
  const [exports, setExports] = useState<DataExport[]>([]);
  const [creating, setCreating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const fetchExports = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("data_exports")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);
    if (data) setExports(data as unknown as DataExport[]);
  }, [userId]);

  useEffect(() => { fetchExports(); }, [fetchExports]);

  // Poll for running exports
  useEffect(() => {
    const hasRunning = exports.some((e) => e.status === "queued" || e.status === "running");
    if (hasRunning) {
      pollRef.current = setInterval(fetchExports, 3000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [exports, fetchExports]);

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleCreateExport = async () => {
    if (!userId || selectedCategories.length === 0) return;
    setCreating(true);
    setConfirmOpen(false);

    // Create export record
    const { data: exportRow, error } = await supabase
      .from("data_exports")
      .insert({
        user_id: userId,
        categories: selectedCategories,
        format,
        status: "queued",
      } as any)
      .select()
      .single();

    if (error || !exportRow) {
      toast.error("Не удалось создать экспорт");
      setCreating(false);
      return;
    }

    // Trigger edge function
    supabase.functions.invoke("data-export", {
      body: { exportId: (exportRow as any).id },
    }).then(() => {
      fetchExports();
    }).catch(() => {
      fetchExports();
    });

    toast.success("Экспорт запущен");
    setCreating(false);
    fetchExports();
  };

  const handleDownload = async (exp: DataExport) => {
    if (!exp.file_path) return;
    const { data, error } = await supabase.storage
      .from("data-exports")
      .createSignedUrl(exp.file_path, 300); // 5 min
    if (error || !data?.signedUrl) {
      toast.error("Не удалось получить ссылку");
      return;
    }
    // Mark as downloaded
    await supabase.from("data_exports").update({ downloaded_at: new Date().toISOString() } as any).eq("id", exp.id);
    window.open(data.signedUrl, "_blank");
    fetchExports();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("data_exports").delete().eq("id", id);
    toast.success("Экспорт удалён");
    fetchExports();
  };

  const formatWarning = format === "opml" && !selectedCategories.includes("subscriptions")
    ? "OPML поддерживает только подписки. Остальные категории будут экспортированы в JSON внутри."
    : format === "csv" && selectedCategories.some((c) => c === "templates" || c === "projects")
      ? "CSV оптимален для плейлистов и закладок. Шаблоны/проекты могут потерять вложенные данные."
      : null;

  return (
    <div className="space-y-5 mt-4">
      {/* Category selector */}
      <div>
        <p className="text-sm font-medium mb-2">Категории для экспорта</p>
        <div className="space-y-2">
          {EXPORT_CATEGORIES.map((cat) => (
            <label key={cat.id} className={cn(
              "flex items-center gap-3 p-2.5 rounded-lg border transition-colors cursor-pointer",
              selectedCategories.includes(cat.id)
                ? "border-primary/40 bg-primary/5"
                : "border-border hover:border-muted-foreground/30"
            )}>
              <Checkbox
                checked={selectedCategories.includes(cat.id)}
                onCheckedChange={() => toggleCategory(cat.id)}
              />
              <cat.icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium">{cat.label}</p>
                <p className="text-xs text-muted-foreground">{cat.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Format selector */}
      <div>
        <p className="text-sm font-medium mb-2">Формат</p>
        <div className="grid grid-cols-3 gap-2">
          {FORMAT_OPTIONS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFormat(f.value)}
              className={cn(
                "flex flex-col items-center gap-1 p-3 rounded-lg border text-center transition-colors",
                format === f.value
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border hover:border-muted-foreground/30 text-muted-foreground"
              )}
            >
              <f.icon className="h-5 w-5" />
              <span className="text-sm font-medium">{f.label}</span>
              <span className="text-[10px] leading-tight">{f.description}</span>
            </button>
          ))}
        </div>
        {formatWarning && (
          <div className="flex items-start gap-2 mt-2 p-2 rounded-md bg-warning/10 border border-warning/20">
            <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
            <p className="text-xs text-warning">{formatWarning}</p>
          </div>
        )}
      </div>

      {/* CTA */}
      <Button
        onClick={() => setConfirmOpen(true)}
        disabled={creating || selectedCategories.length === 0}
        className="w-full"
      >
        {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
        Создать экспорт
      </Button>

      {/* Confirm dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Shield className="h-4 w-4" />Подтверждение экспорта</DialogTitle>
            <DialogDescription>
              Вы собираетесь экспортировать {selectedCategories.length} категории(й) данных в формате {format.toUpperCase()}.
              Файл будет доступен для скачивания в течение 24 часов.
            </DialogDescription>
          </DialogHeader>
          <div className="text-xs text-muted-foreground space-y-1">
            {selectedCategories.map((c) => {
              const cat = EXPORT_CATEGORIES.find((x) => x.id === c);
              return <p key={c}>• {cat?.label}</p>;
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Отмена</Button>
            <Button onClick={handleCreateExport} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Подтвердить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export history */}
      {exports.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">Последние экспорты</p>
          <div className="space-y-2">
            {exports.map((exp) => {
              const st = STATUS_MAP[exp.status] || STATUS_MAP.queued;
              const Icon = st.icon;
              const isExpired = exp.expires_at && new Date(exp.expires_at) < new Date();
              return (
                <div key={exp.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <Icon className={cn("h-4 w-4 shrink-0", st.color, exp.status === "running" && "animate-spin")} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="text-[10px] shrink-0">{exp.format.toUpperCase()}</Badge>
                        <span className="text-xs text-muted-foreground truncate">
                          {exp.categories.map((c) => EXPORT_CATEGORIES.find((x) => x.id === c)?.label || c).join(", ")}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {formatDate(new Date(exp.created_at), "dd MMM yyyy HH:mm", { locale: ru })}
                        {exp.file_size ? ` • ${(exp.file_size / 1024).toFixed(1)} КБ` : ""}
                        {isExpired && exp.status === "ready" ? " • Истёк" : ""}
                      </p>
                      {exp.error && <p className="text-[11px] text-destructive mt-0.5">{exp.error}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {exp.status === "ready" && !isExpired && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(exp)}>
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => handleDelete(exp.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Placeholder for email notification */}
      {exports.some((e) => e.status === "ready" && !e.downloaded_at) && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-info/10 border border-info/20">
          <Info className="h-3.5 w-3.5 text-info shrink-0" />
          <p className="text-xs text-info">Ссылка на скачивание также отправлена на вашу почту (заглушка).</p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════
   IMPORT TAB
   ═══════════════════════════════════════ */
function ImportTab({ userId }: { userId?: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "preview" | "confirm" | "result">("upload");
  const [format, setFormat] = useState("json");
  const [conflictStrategy, setConflictStrategy] = useState("merge");
  const [parsedData, setParsedData] = useState<any>(null);
  const [preview, setPreview] = useState<{ categories: string[]; counts: Record<string, number>; sample: any } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Максимальный размер — 10 МБ"); return; }

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        if (format === "json") {
          const data = JSON.parse(text);
          if (!data.version) {
            toast.error("Неподдерживаемая схема: отсутствует поле version. См. вкладку «Схема».");
            return;
          }
          if (data.version !== "1.0.0") {
            toast.error(`Неподдерживаемая версия схемы: ${data.version}. Поддерживается: 1.0.0`);
            return;
          }
          setParsedData(data);
          // Build preview
          const categories: string[] = [];
          const counts: Record<string, number> = {};
          if (data.subscriptions?.length) { categories.push("subscriptions"); counts.subscriptions = data.subscriptions.length; }
          if (data.playlists?.length) { categories.push("playlists"); counts.playlists = data.playlists.length; }
          if (data.bookmarks?.length) { categories.push("bookmarks"); counts.bookmarks = data.bookmarks.length; }
          if (data.templates?.length) { categories.push("templates"); counts.templates = data.templates.length; }
          if (data.projects?.length) { categories.push("projects"); counts.projects = data.projects.length; }
          setPreview({ categories, counts, sample: data });
          setStep("preview");
        } else {
          toast.error("Импорт поддерживается только для формата JSON.");
        }
      } catch {
        toast.error("Ошибка парсинга файла. Проверьте формат.");
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    if (!userId || !parsedData) return;
    setImporting(true);
    setConfirmOpen(false);
    setStep("result");

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    try {
      // Import subscriptions
      if (parsedData.subscriptions?.length) {
        const { data: existing } = await supabase.from("subscriptions").select("creator_id").eq("user_id", userId);
        const existingIds = new Set((existing || []).map((s: any) => s.creator_id));
        const toInsert = parsedData.subscriptions.filter((s: any) => !existingIds.has(s.creator_id));
        if (toInsert.length > 0) {
          const { error } = await supabase.from("subscriptions").insert(
            toInsert.map((s: any) => ({ user_id: userId, creator_id: s.creator_id }))
          );
          if (error) errors.push(`Подписки: ${error.message}`);
          else imported += toInsert.length;
        }
        skipped += parsedData.subscriptions.length - toInsert.length;
      }

      // Import playlists
      if (parsedData.playlists?.length) {
        const { data: existingPl } = await supabase.from("playlists").select("id, title").eq("user_id", userId);
        const existingNames = new Map((existingPl || []).map((p: any) => [p.title, p.id]));

        for (const pl of parsedData.playlists) {
          if (conflictStrategy === "merge" && existingNames.has(pl.title)) {
            // Merge items into existing
            const existingId = existingNames.get(pl.title);
            if (existingId && pl.items?.length) {
              const { data: existingItems } = await supabase.from("playlist_items").select("content_id").eq("playlist_id", existingId);
              const existingContentIds = new Set((existingItems || []).map((i: any) => i.content_id));
              const newItems = (pl.items || []).filter((i: any) => !existingContentIds.has(i.content_id));
              if (newItems.length > 0) {
                await supabase.from("playlist_items").insert(
                  newItems.map((i: any) => ({ playlist_id: existingId, content_id: i.content_id, sort_order: i.sort_order || 0 }))
                );
                imported += newItems.length;
              }
              skipped += (pl.items?.length || 0) - newItems.length;
            }
          } else {
            // Create new
            const { data: newPl, error: plErr } = await supabase.from("playlists")
              .insert({ user_id: userId, title: pl.title, description: pl.description || "", is_public: pl.is_public ?? true })
              .select("id")
              .single();
            if (plErr) { errors.push(`Плейлист "${pl.title}": ${plErr.message}`); continue; }
            imported++;
            if (newPl && pl.items?.length) {
              await supabase.from("playlist_items").insert(
                pl.items.map((i: any) => ({ playlist_id: (newPl as any).id, content_id: i.content_id, sort_order: i.sort_order || 0 }))
              );
              imported += pl.items.length;
            }
          }
        }
      }

      // Import bookmarks
      if (parsedData.bookmarks?.length) {
        const { data: existing } = await supabase.from("bookmarks").select("content_id").eq("user_id", userId);
        const existingIds = new Set((existing || []).map((b: any) => b.content_id));
        const toInsert = parsedData.bookmarks.filter((b: any) => !existingIds.has(b.content_id));
        if (toInsert.length > 0) {
          const { error } = await supabase.from("bookmarks").insert(
            toInsert.map((b: any) => ({ user_id: userId, content_id: b.content_id }))
          );
          if (error) errors.push(`Закладки: ${error.message}`);
          else imported += toInsert.length;
        }
        skipped += parsedData.bookmarks.length - toInsert.length;
      }

      // Log import
      await supabase.from("data_imports").insert({
        user_id: userId,
        status: errors.length > 0 ? "partial" : "completed",
        categories: preview?.categories || [],
        format,
        preview_data: preview?.counts || {},
        result_data: { imported, skipped, errors },
        conflict_strategy: conflictStrategy,
        confirmed_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
      } as any);

    } catch (err: any) {
      errors.push(err.message);
    }

    setImportResult({ imported, skipped, errors });
    setImporting(false);
  };

  const reset = () => {
    setStep("upload");
    setParsedData(null);
    setPreview(null);
    setImportResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const categoryLabel = (id: string) =>
    EXPORT_CATEGORIES.find((c) => c.id === id)?.label || id;

  return (
    <div className="space-y-4 mt-4">
      {step === "upload" && (
        <>
          <div>
            <p className="text-sm font-medium mb-2">Формат файла</p>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="json">JSON (рекомендуется)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors"
          >
            <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium">Нажмите для загрузки файла</p>
            <p className="text-xs text-muted-foreground mt-1">JSON до 10 МБ</p>
          </div>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFileUpload} />
        </>
      )}

      {step === "preview" && preview && (
        <>
          <div className="flex items-center gap-2 mb-2">
            <Eye className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium">Предпросмотр и валидация</p>
          </div>
          <div className="space-y-2">
            {preview.categories.map((cat) => (
              <div key={cat} className="flex items-center justify-between p-2.5 rounded-lg border border-border">
                <span className="text-sm">{categoryLabel(cat)}</span>
                <Badge variant="secondary">{preview.counts[cat]} шт.</Badge>
              </div>
            ))}
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Стратегия конфликтов</p>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-2 rounded-lg border border-border cursor-pointer">
                <input type="radio" name="conflict" checked={conflictStrategy === "merge"} onChange={() => setConflictStrategy("merge")} className="accent-primary" />
                <div>
                  <p className="text-sm font-medium">Слияние</p>
                  <p className="text-xs text-muted-foreground">Добавить элементы в существующие списки с тем же именем</p>
                </div>
              </label>
              <label className="flex items-center gap-3 p-2 rounded-lg border border-border cursor-pointer">
                <input type="radio" name="conflict" checked={conflictStrategy === "create_new"} onChange={() => setConflictStrategy("create_new")} className="accent-primary" />
                <div>
                  <p className="text-sm font-medium">Создать новые</p>
                  <p className="text-xs text-muted-foreground">Создать отдельные списки при совпадении имён</p>
                </div>
              </label>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={reset} className="flex-1">Назад</Button>
            <Button onClick={() => setConfirmOpen(true)} className="flex-1">
              Подтвердить импорт
            </Button>
          </div>

          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" />Подтверждение импорта</DialogTitle>
                <DialogDescription>
                  Будет импортировано данных из {preview.categories.length} категорий.
                  Стратегия: {conflictStrategy === "merge" ? "слияние" : "создание новых"}.
                  Это действие может изменить ваши данные.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmOpen(false)}>Отмена</Button>
                <Button onClick={handleConfirmImport} disabled={importing}>
                  {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Импортировать
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {step === "result" && (
        <div className="space-y-3">
          {importing ? (
            <div className="text-center py-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
              <p className="text-sm font-medium">Импорт данных…</p>
            </div>
          ) : importResult ? (
            <>
              <div className="flex items-center gap-2">
                {importResult.errors.length === 0 ? (
                  <CheckCircle2 className="h-5 w-5 text-success" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-warning" />
                )}
                <p className="text-sm font-medium">
                  {importResult.errors.length === 0 ? "Импорт завершён" : "Импорт завершён с ошибками"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-lg border border-border text-center">
                  <p className="text-2xl font-bold text-primary">{importResult.imported}</p>
                  <p className="text-xs text-muted-foreground">Импортировано</p>
                </div>
                <div className="p-3 rounded-lg border border-border text-center">
                  <p className="text-2xl font-bold text-muted-foreground">{importResult.skipped}</p>
                  <p className="text-xs text-muted-foreground">Пропущено (дубли)</p>
                </div>
              </div>
              {importResult.errors.length > 0 && (
                <div className="p-2 rounded-md bg-destructive/10 border border-destructive/20">
                  <p className="text-xs font-medium text-destructive mb-1">Ошибки:</p>
                  {importResult.errors.map((err, i) => (
                    <p key={i} className="text-xs text-destructive/80">• {err}</p>
                  ))}
                </div>
              )}
              <Button variant="outline" onClick={reset} className="w-full">Новый импорт</Button>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════
   SCHEMA TAB
   ═══════════════════════════════════════ */
function SchemaTab() {
  return (
    <div className="space-y-4 mt-4 text-sm">
      <div>
        <p className="font-medium mb-1">Версия схемы: 1.0.0</p>
        <p className="text-xs text-muted-foreground">Последнее обновление: Февраль 2026</p>
      </div>

      <div className="space-y-3">
        <div className="p-3 rounded-lg border border-border">
          <p className="font-medium mb-1">Формат JSON</p>
          <pre className="text-xs text-muted-foreground bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre">{`{
  "version": "1.0.0",
  "exported_at": "ISO-8601",
  "format": "json",
  "user_id": "uuid",
  "subscriptions": [{
    "creator_id": "uuid",
    "creator_name": "string",
    "subscribed_at": "ISO-8601"
  }],
  "playlists": [{
    "id": "uuid",
    "title": "string",
    "description": "string",
    "is_public": true,
    "items": [{
      "content_id": "uuid",
      "sort_order": 0,
      "added_at": "ISO-8601"
    }]
  }],
  "bookmarks": [{
    "content_id": "uuid",
    "content_title": "string",
    "saved_at": "ISO-8601"
  }],
  "templates": [{
    "id": "uuid",
    "title": "string",
    "description": "string",
    "tags": ["string"],
    "status": "string",
    "created_at": "ISO-8601"
  }],
  "projects": [{
    "id": "uuid",
    "title": "string",
    "description": "string",
    "goal": "string",
    "audience": "string",
    "status": "string",
    "created_at": "ISO-8601"
  }]
}`}</pre>
        </div>

        <div className="p-3 rounded-lg border border-border">
          <p className="font-medium mb-1">Формат OPML</p>
          <p className="text-xs text-muted-foreground mb-2">
            Экспортирует только подписки. OPML предназначен для RSS-подобных источников; 
            так как наша модель подписок не содержит URL фидов, OPML используется частично —
            атрибуты xmlUrl и htmlUrl остаются пустыми. Для полного экспорта используйте JSON.
          </p>
        </div>

        <div className="p-3 rounded-lg border border-border">
          <p className="font-medium mb-1">Формат CSV</p>
          <p className="text-xs text-muted-foreground">
            Табличный формат для плейлистов, закладок и подписок. 
            Столбцы: category, title/name, content_id/creator_id, date.
            Не рекомендуется для шаблонов и проектов из-за вложенных данных.
          </p>
        </div>

        <div className="p-3 rounded-lg border border-border bg-muted/30">
          <p className="font-medium mb-1 flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Что исключено
          </p>
          <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
            <li>Приватные сообщения и чаты</li>
            <li>Платёжная информация и транзакции</li>
            <li>Персональные идентификаторы (пароли, токены, email-адреса третьих лиц)</li>
            <li>Приватные файлы проектов (экспортируются только метаданные)</li>
            <li>Файлы шаблонов (экспортируются только метаданные)</li>
            <li>Контент других пользователей (только ссылки через ID)</li>
          </ul>
        </div>
      </div>

      <div className="p-3 rounded-lg border border-border">
        <p className="font-medium mb-1">Журнал изменений</p>
        <div className="text-xs text-muted-foreground">
          <p><strong>v1.0.0</strong> (Февраль 2026) — Первоначальная версия. Подписки, плейлисты, закладки, шаблоны (метаданные), проекты (метаданные).</p>
        </div>
      </div>
    </div>
  );
}
