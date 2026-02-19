import { useState, useRef, useCallback } from "react";
import {
  Upload, X, Plus, Trash2, GripVertical, BookOpen,
  Save, Send, Eye, ChevronDown, ChevronUp,
  FileText, AlertCircle, CheckCircle, Loader2,
  DollarSign, Shield, Calendar, Clock, Tag, Globe,
  BookMarked, Layers, Type, Hash, ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

/* ── Types ── */
interface BookChapter {
  id: string;
  title: string;
  pageNumber: string;
}

interface BookFormData {
  title: string;
  description: string;
  tags: string[];
  monetization_type: string;
  price: number | null;
  price_min: number | null;
  age_restricted: boolean;
  language: string;
  geo: string;
  status: string;
  scheduled_at: string;
  chapters: BookChapter[];
  genre: string;
  pageCount: string;
  isbn: string;
}

interface BookEditorProps {
  editItem?: any;
  onClose: () => void;
  onSaved: () => void;
}

const LANGUAGES = [
  { value: "ru", label: "Русский" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Français" },
  { value: "zh", label: "中文" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
];

const GENRES = [
  "Бизнес и финансы", "Саморазвитие", "Программирование", "Дизайн",
  "Маркетинг", "Психология", "Фантастика", "Детективы",
  "Учебная литература", "Наука", "Здоровье", "Кулинария",
  "Путешествия", "Искусство", "Философия", "Другое",
];

type EditorTab = "cover" | "info" | "contents" | "monetization" | "audience" | "publish";

const EDITOR_TABS: { id: EditorTab; label: string; icon: React.ElementType }[] = [
  { id: "cover", label: "Обложка и файл", icon: BookOpen },
  { id: "info", label: "Информация", icon: FileText },
  { id: "contents", label: "Оглавление", icon: Layers },
  { id: "monetization", label: "Монетизация", icon: DollarSign },
  { id: "audience", label: "Аудитория", icon: Shield },
  { id: "publish", label: "Публикация", icon: Calendar },
];

export function BookEditor({ editItem, onClose, onSaved }: BookEditorProps) {
  const { user, profile } = useAuth();
  const coverInputRef = useRef<HTMLInputElement>(null);
  const bookFileInputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!editItem;

  const [form, setForm] = useState<BookFormData>(() => ({
    title: editItem?.title || "",
    description: editItem?.description || "",
    tags: editItem?.tags || [],
    monetization_type: editItem?.monetization_type || "free",
    price: editItem?.price || null,
    price_min: editItem?.price_min || null,
    age_restricted: editItem?.age_restricted || false,
    language: editItem?.language || "ru",
    geo: editItem?.geo || "",
    status: editItem?.status || "draft",
    scheduled_at: editItem?.scheduled_at || "",
    chapters: editItem?.chapters || [],
    genre: "",
    pageCount: "",
    isbn: "",
  }));

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string>(editItem?.thumbnail || "");
  const [bookFile, setBookFile] = useState<File | null>(null);
  const [bookFileName, setBookFileName] = useState<string>("");
  const [tagInput, setTagInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [isDraggingCover, setIsDraggingCover] = useState(false);
  const [isDraggingBook, setIsDraggingBook] = useState(false);
  const [activeTab, setActiveTab] = useState<EditorTab>("cover");

  /* ── Cover drag & drop ── */
  const handleCoverDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingCover(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      setCoverFile(file);
      setCoverPreviewUrl(URL.createObjectURL(file));
    } else {
      toast.error("Поддерживаются только изображения");
    }
  }, []);

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      setCoverPreviewUrl(URL.createObjectURL(file));
    }
  };

  /* ── Book file ── */
  const handleBookFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingBook(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (["pdf", "epub", "fb2", "docx"].includes(ext || "")) {
        setBookFile(file);
        setBookFileName(file.name);
      } else {
        toast.error("Поддерживаются форматы: PDF, EPUB, FB2, DOCX");
      }
    }
  }, []);

  const handleBookFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBookFile(file);
      setBookFileName(file.name);
    }
  };

  /* ── Tags ── */
  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !form.tags.includes(tag) && form.tags.length < 15) {
      setForm((p) => ({ ...p, tags: [...p.tags, tag] }));
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setForm((p) => ({ ...p, tags: p.tags.filter((t) => t !== tag) }));
  };

  /* ── Chapters ── */
  const addChapter = () => {
    setForm((p) => ({
      ...p,
      chapters: [...p.chapters, { id: crypto.randomUUID(), title: "", pageNumber: "" }],
    }));
  };

  const updateChapter = (id: string, field: keyof BookChapter, value: string) => {
    setForm((p) => ({
      ...p,
      chapters: p.chapters.map((c) => (c.id === id ? { ...c, [field]: value } : c)),
    }));
  };

  const removeChapter = (id: string) => {
    setForm((p) => ({ ...p, chapters: p.chapters.filter((c) => c.id !== id) }));
  };

  /* ── Upload helper ── */
  const uploadFile = async (file: File, path: string) => {
    const { data, error } = await supabase.storage.from("content-media").upload(path, file, { upsert: true });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from("content-media").getPublicUrl(data.path);
    return urlData.publicUrl;
  };

  /* ── Save ── */
  const handleSave = async (publishStatus?: string) => {
    if (!form.title.trim()) { toast.error("Введите название книги"); return; }
    if (!user?.id) { toast.error("Необходимо авторизоваться"); return; }

    setSaving(true);
    setUploading(true);
    setUploadProgress(10);

    try {
      let thumbnailUrl = editItem?.thumbnail || "";
      let bookUrl = editItem?.video_url || ""; // reuse video_url for book file

      if (coverFile) {
        setUploadProgress(30);
        thumbnailUrl = await uploadFile(coverFile, `${user.id}/books/covers/${Date.now()}_${coverFile.name}`);
        setUploadProgress(50);
      }

      if (bookFile) {
        setUploadProgress(60);
        bookUrl = await uploadFile(bookFile, `${user.id}/books/files/${Date.now()}_${bookFile.name}`);
        setUploadProgress(85);
      }

      setUploadProgress(90);

      let scheduledAtUtc: string | null = null;
      if (form.status === "scheduled" && form.scheduled_at) {
        scheduledAtUtc = new Date(form.scheduled_at).toISOString();
      }

      const record: Record<string, any> = {
        title: form.title.trim(),
        description: form.description,
        tags: form.tags,
        type: "book",
        thumbnail: thumbnailUrl,
        video_url: bookUrl, // store book file URL here
        chapters: form.chapters,
        age_restricted: form.age_restricted,
        language: form.language,
        geo: form.geo,
        monetization_type: form.monetization_type,
        price: form.monetization_type === "paid" ? form.price : null,
        price_min: form.monetization_type === "pay_what_you_want" ? form.price_min : null,
        status: publishStatus || form.status,
        scheduled_at: scheduledAtUtc,
        creator_id: user.id,
        creator_name: profile?.display_name || "",
        creator_avatar: profile?.avatar_url || "",
      };

      let error;
      if (isEditing) {
        ({ error } = await supabase.from("content_items").update(record).eq("id", editItem.id));
      } else {
        ({ error } = await supabase.from("content_items").insert(record as any));
      }

      setUploadProgress(100);
      if (error) throw error;

      toast.success(publishStatus === "published" ? "Книга опубликована!" : "Сохранено как черновик");
      onSaved();
    } catch (e: any) {
      toast.error(`Ошибка: ${e.message}`);
    } finally {
      setSaving(false);
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const checklist = [
    { done: !!coverPreviewUrl, label: "Обложка" },
    { done: !!bookFile || !!editItem?.video_url, label: "Файл книги" },
    { done: !!form.title.trim(), label: "Название" },
    { done: !!form.description.trim(), label: "Описание" },
    { done: form.tags.length > 0, label: "Теги" },
  ];
  const completedCount = checklist.filter((c) => c.done).length;

  return (
    <div className="space-y-0">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap sticky top-0 z-10 bg-background/95 backdrop-blur py-3 border-b border-border px-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onClose}>← Назад</Button>
          <Separator orientation="vertical" className="h-6" />
          <BookOpen className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">{isEditing ? "Редактирование книги" : "Новая электронная книга"}</h2>
          <Badge variant={form.status === "published" ? "default" : "secondary"} className="text-[10px]">
            {form.status === "published" ? "Опубликовано" : form.status === "scheduled" ? "Запланировано" : "Черновик"}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleSave("draft")} disabled={saving}>
            <Save className="h-3.5 w-3.5 mr-1.5" /> Черновик
          </Button>
          <Button size="sm" onClick={() => handleSave("published")} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Опубликовать
          </Button>
        </div>
      </div>

      {/* Upload progress */}
      {uploading && (
        <div className="px-6 pt-3 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> Загрузка...</span>
            <span>{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} className="h-2" />
        </div>
      )}

      {/* ── Main layout ── */}
      <div className="flex h-[calc(100vh-7.5rem)]">
        {/* Left sidebar */}
        <aside className="w-56 shrink-0 border-r border-border bg-card/50 flex flex-col overflow-y-auto">
          <nav className="py-2 px-2 space-y-0.5 flex-1">
            {EDITOR_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm transition-all text-left",
                  activeTab === tab.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <tab.icon className="h-4 w-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>

          {/* Checklist */}
          <div className="p-3 border-t border-border space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Готовность</p>
              <span className="text-[10px] font-bold text-primary">{completedCount}/{checklist.length}</span>
            </div>
            <Progress value={(completedCount / checklist.length) * 100} className="h-1.5" />
            {checklist.map((c) => (
              <div key={c.label} className="flex items-center gap-2 text-sm">
                {c.done ? <CheckCircle className="h-3.5 w-3.5 text-success" /> : <div className="h-3.5 w-3.5 rounded-full border border-border" />}
                <span className={cn("text-xs", c.done ? "text-foreground" : "text-muted-foreground")}>{c.label}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* Center content */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="px-6 py-5 max-w-3xl mx-auto space-y-6"
            >
              {/* ═══ COVER & FILE ═══ */}
              {activeTab === "cover" && (
                <>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-foreground">Обложка и файл книги</h3>
                    <p className="text-sm text-muted-foreground">Загрузите привлекательную обложку и файл книги</p>
                  </div>

                  {/* Cover upload */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Обложка книги</Label>
                    <div className="flex gap-6 items-start">
                      <div
                        onDragOver={(e) => { e.preventDefault(); setIsDraggingCover(true); }}
                        onDragLeave={() => setIsDraggingCover(false)}
                        onDrop={handleCoverDrop}
                        onClick={() => coverInputRef.current?.click()}
                        className={cn(
                          "relative w-48 cursor-pointer rounded-xl overflow-hidden transition-all border-2 border-dashed",
                          "aspect-[2/3] flex flex-col items-center justify-center",
                          isDraggingCover ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/30"
                        )}
                      >
                        {coverPreviewUrl ? (
                          <>
                            <img src={coverPreviewUrl} alt="Обложка" className="absolute inset-0 w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors flex items-center justify-center">
                              <span className="text-white text-xs font-medium opacity-0 hover:opacity-100 transition-opacity">Заменить</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <BookMarked className="h-8 w-8 text-muted-foreground mb-2" />
                            <p className="text-xs text-muted-foreground text-center px-2">Перетащите или нажмите</p>
                            <p className="text-[10px] text-muted-foreground/60 mt-1">JPG, PNG · 2:3</p>
                          </>
                        )}
                      </div>
                      <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverSelect} />
                      <div className="flex-1 space-y-3 pt-1">
                        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
                          <p className="text-xs font-medium text-foreground">💡 Рекомендации для обложки</p>
                          <ul className="text-[11px] text-muted-foreground space-y-1 list-disc list-inside">
                            <li>Используйте соотношение сторон 2:3 (например 800×1200)</li>
                            <li>Яркий контрастный заголовок</li>
                            <li>Минимум текста — название и имя автора</li>
                            <li>Формат JPG или PNG, до 5 МБ</li>
                          </ul>
                        </div>
                        {coverPreviewUrl && (
                          <Button variant="outline" size="sm" onClick={() => { setCoverFile(null); setCoverPreviewUrl(""); }}>
                            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Удалить обложку
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Book file upload */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Файл книги</Label>
                    {!bookFileName && !editItem?.video_url ? (
                      <div
                        onDragOver={(e) => { e.preventDefault(); setIsDraggingBook(true); }}
                        onDragLeave={() => setIsDraggingBook(false)}
                        onDrop={handleBookFileDrop}
                        onClick={() => bookFileInputRef.current?.click()}
                        className={cn(
                          "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
                          isDraggingBook ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/30"
                        )}
                      >
                        <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                        <p className="text-sm font-medium text-foreground">Перетащите файл книги сюда</p>
                        <p className="text-xs text-muted-foreground mt-1">или нажмите для выбора</p>
                        <p className="text-[11px] text-muted-foreground/60 mt-2">PDF, EPUB, FB2, DOCX · до 100 МБ</p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card">
                        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <FileText className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{bookFileName || "Файл загружен"}</p>
                          <p className="text-xs text-muted-foreground">
                            {bookFile ? `${(bookFile.size / 1024 / 1024).toFixed(1)} МБ` : "Ранее загружено"}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => { setBookFile(null); setBookFileName(""); }}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    <input ref={bookFileInputRef} type="file" accept=".pdf,.epub,.fb2,.docx" className="hidden" onChange={handleBookFileSelect} />
                  </div>
                </>
              )}

              {/* ═══ INFO ═══ */}
              {activeTab === "info" && (
                <>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-foreground">Информация о книге</h3>
                    <p className="text-sm text-muted-foreground">Название, описание и метаданные</p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="book-title">Название книги *</Label>
                      <Input
                        id="book-title"
                        value={form.title}
                        onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                        placeholder="Введите название книги"
                        className="text-base"
                        maxLength={120}
                      />
                      <p className="text-[11px] text-muted-foreground text-right">{form.title.length}/120</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="book-desc">Описание / Аннотация</Label>
                      <Textarea
                        id="book-desc"
                        value={form.description}
                        onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                        placeholder="Напишите интригующую аннотацию, которая привлечёт читателей..."
                        rows={6}
                        maxLength={2000}
                        className="resize-none"
                      />
                      <p className="text-[11px] text-muted-foreground text-right">{form.description.length}/2000</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Жанр</Label>
                        <Select value={form.genre} onValueChange={(v) => setForm((p) => ({ ...p, genre: v }))}>
                          <SelectTrigger><SelectValue placeholder="Выберите жанр" /></SelectTrigger>
                          <SelectContent>
                            {GENRES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Язык</Label>
                        <Select value={form.language} onValueChange={(v) => setForm((p) => ({ ...p, language: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="page-count">Количество страниц</Label>
                        <Input
                          id="page-count"
                          type="number"
                          value={form.pageCount}
                          onChange={(e) => setForm((p) => ({ ...p, pageCount: e.target.value }))}
                          placeholder="320"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="isbn">ISBN (необязательно)</Label>
                        <Input
                          id="isbn"
                          value={form.isbn}
                          onChange={(e) => setForm((p) => ({ ...p, isbn: e.target.value }))}
                          placeholder="978-3-16-148410-0"
                        />
                      </div>
                    </div>

                    <Separator />

                    {/* Tags */}
                    <div className="space-y-2">
                      <Label>Теги</Label>
                      <div className="flex gap-2">
                        <Input
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                          placeholder="Добавить тег..."
                          className="flex-1"
                        />
                        <Button variant="outline" size="sm" onClick={addTag} disabled={!tagInput.trim()}>
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      {form.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {form.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs gap-1 pr-1">
                              {tag}
                              <button onClick={() => removeTag(tag)} className="ml-0.5 hover:text-destructive transition-colors">
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                      <p className="text-[11px] text-muted-foreground">{form.tags.length}/15 тегов</p>
                    </div>
                  </div>
                </>
              )}

              {/* ═══ CONTENTS ═══ */}
              {activeTab === "contents" && (
                <>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-foreground">Оглавление</h3>
                    <p className="text-sm text-muted-foreground">Добавьте главы книги для удобной навигации</p>
                  </div>

                  <div className="space-y-3">
                    {form.chapters.length === 0 && (
                      <div className="rounded-xl border border-dashed border-border p-8 text-center">
                        <Layers className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">Оглавление пока пустое</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">Добавьте главы для удобства читателей</p>
                      </div>
                    )}

                    {form.chapters.map((ch, i) => (
                      <motion.div
                        key={ch.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card group hover:border-primary/20 transition-colors"
                      >
                        <div className="text-xs text-muted-foreground font-mono w-6 text-center shrink-0">{i + 1}</div>
                        <Input
                          value={ch.title}
                          onChange={(e) => updateChapter(ch.id, "title", e.target.value)}
                          placeholder="Название главы"
                          className="flex-1"
                        />
                        <Input
                          value={ch.pageNumber}
                          onChange={(e) => updateChapter(ch.id, "pageNumber", e.target.value)}
                          placeholder="Стр."
                          className="w-20"
                          type="number"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeChapter(ch.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </motion.div>
                    ))}

                    <Button variant="outline" size="sm" onClick={addChapter} className="w-full gap-1.5">
                      <Plus className="h-3.5 w-3.5" /> Добавить главу
                    </Button>
                  </div>
                </>
              )}

              {/* ═══ MONETIZATION ═══ */}
              {activeTab === "monetization" && (
                <>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-foreground">Монетизация</h3>
                    <p className="text-sm text-muted-foreground">Настройте модель монетизации книги</p>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { id: "free", label: "Бесплатно", desc: "Свободный доступ", icon: "🎁" },
                        { id: "paid", label: "Платная", desc: "Фиксированная цена", icon: "💰" },
                        { id: "pay_what_you_want", label: "Свободная цена", desc: "Читатель выбирает", icon: "🤝" },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => setForm((p) => ({ ...p, monetization_type: opt.id }))}
                          className={cn(
                            "p-4 rounded-xl border-2 text-left transition-all",
                            form.monetization_type === opt.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/30"
                          )}
                        >
                          <span className="text-xl">{opt.icon}</span>
                          <p className="text-sm font-semibold text-foreground mt-2">{opt.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                        </button>
                      ))}
                    </div>

                    {form.monetization_type === "paid" && (
                      <div className="space-y-2">
                        <Label>Цена (₽)</Label>
                        <Input
                          type="number"
                          value={form.price ?? ""}
                          onChange={(e) => setForm((p) => ({ ...p, price: e.target.value ? Number(e.target.value) : null }))}
                          placeholder="499"
                        />
                      </div>
                    )}

                    {form.monetization_type === "pay_what_you_want" && (
                      <div className="space-y-2">
                        <Label>Минимальная цена (₽)</Label>
                        <Input
                          type="number"
                          value={form.price_min ?? ""}
                          onChange={(e) => setForm((p) => ({ ...p, price_min: e.target.value ? Number(e.target.value) : null }))}
                          placeholder="100"
                        />
                        <p className="text-[11px] text-muted-foreground">Читатель сможет заплатить больше, если захочет</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ═══ AUDIENCE ═══ */}
              {activeTab === "audience" && (
                <>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-foreground">Настройки аудитории</h3>
                    <p className="text-sm text-muted-foreground">Доступность и ограничения</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-xl border border-border">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium text-foreground">Возрастное ограничение (18+)</p>
                        <p className="text-xs text-muted-foreground">Контент только для совершеннолетних</p>
                      </div>
                      <Switch
                        checked={form.age_restricted}
                        onCheckedChange={(v) => setForm((p) => ({ ...p, age_restricted: v }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Регион (необязательно)</Label>
                      <Input
                        value={form.geo}
                        onChange={(e) => setForm((p) => ({ ...p, geo: e.target.value }))}
                        placeholder="Например: RU, KZ, BY"
                      />
                      <p className="text-[11px] text-muted-foreground">Оставьте пустым для глобальной доступности</p>
                    </div>
                  </div>
                </>
              )}

              {/* ═══ PUBLISH ═══ */}
              {activeTab === "publish" && (
                <>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-foreground">Публикация</h3>
                    <p className="text-sm text-muted-foreground">Выберите время и способ публикации</p>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { id: "draft", label: "Черновик", desc: "Сохранить без публикации", icon: FileText },
                        { id: "published", label: "Сейчас", desc: "Опубликовать немедленно", icon: Send },
                        { id: "scheduled", label: "По расписанию", desc: "Запланировать дату", icon: Calendar },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => setForm((p) => ({ ...p, status: opt.id }))}
                          className={cn(
                            "p-4 rounded-xl border-2 text-left transition-all",
                            form.status === opt.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/30"
                          )}
                        >
                          <opt.icon className={cn("h-5 w-5", form.status === opt.id ? "text-primary" : "text-muted-foreground")} />
                          <p className="text-sm font-semibold text-foreground mt-2">{opt.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                        </button>
                      ))}
                    </div>

                    {form.status === "scheduled" && (
                      <div className="space-y-2">
                        <Label>Дата и время публикации</Label>
                        <Input
                          type="datetime-local"
                          value={form.scheduled_at}
                          onChange={(e) => setForm((p) => ({ ...p, scheduled_at: e.target.value }))}
                        />
                      </div>
                    )}

                    {/* Summary card */}
                    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                      <p className="text-sm font-semibold text-foreground">📋 Сводка перед публикацией</p>
                      <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                        <span className="text-muted-foreground">Название</span>
                        <span className="text-foreground font-medium truncate">{form.title || "—"}</span>
                        <span className="text-muted-foreground">Жанр</span>
                        <span className="text-foreground">{form.genre || "—"}</span>
                        <span className="text-muted-foreground">Монетизация</span>
                        <span className="text-foreground">
                          {form.monetization_type === "free" ? "Бесплатно" : form.monetization_type === "paid" ? `${form.price} ₽` : "Свободная цена"}
                        </span>
                        <span className="text-muted-foreground">Обложка</span>
                        <span className={coverPreviewUrl ? "text-success" : "text-destructive"}>{coverPreviewUrl ? "✓ Загружена" : "✗ Не загружена"}</span>
                        <span className="text-muted-foreground">Файл</span>
                        <span className={bookFileName || editItem?.video_url ? "text-success" : "text-destructive"}>
                          {bookFileName || editItem?.video_url ? "✓ Загружен" : "✗ Не загружен"}
                        </span>
                        <span className="text-muted-foreground">Теги</span>
                        <span className="text-foreground">{form.tags.length > 0 ? form.tags.join(", ") : "—"}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Right preview panel */}
        <aside className="w-72 shrink-0 border-l border-border bg-card/30 p-5 overflow-y-auto hidden xl:block">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Предпросмотр</p>
          <div className="space-y-4">
            {/* Cover preview */}
            <div className="rounded-xl overflow-hidden border border-border aspect-[2/3] bg-muted flex items-center justify-center">
              {coverPreviewUrl ? (
                <img src={coverPreviewUrl} alt="Обложка" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center p-4">
                  <BookOpen className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Обложка не загружена</p>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-foreground line-clamp-2">{form.title || "Без названия"}</p>
              <p className="text-xs text-muted-foreground">{profile?.display_name || "Автор"}</p>
              {form.genre && <Badge variant="secondary" className="text-[10px]">{form.genre}</Badge>}
              {form.monetization_type === "paid" && form.price && (
                <p className="text-sm font-bold text-primary">{form.price} ₽</p>
              )}
              {form.monetization_type === "free" && (
                <Badge className="bg-success/10 text-success border-0 text-[10px]">Бесплатно</Badge>
              )}
            </div>
            {form.description && (
              <p className="text-xs text-muted-foreground line-clamp-4">{form.description}</p>
            )}
            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {form.tags.slice(0, 5).map((t) => (
                  <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
