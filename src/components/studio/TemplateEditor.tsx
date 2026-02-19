import { useState, useRef, useCallback, useEffect } from "react";
import {
  X, Plus, Layout, ImageIcon,
  Save, Send, CheckCircle, Loader2,
  DollarSign, Shield, Calendar, Tag, Globe,
  FileText, Upload, Layers, Package,
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

interface TemplateFormData {
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
  category: string;
  format: string;
  software: string;
}

interface TemplateEditorProps {
  editItem?: any;
  onClose: () => void;
  onSaved: () => void;
}

const LANGUAGES = [
  { value: "ru", label: "Русский" }, { value: "en", label: "English" },
  { value: "es", label: "Español" }, { value: "de", label: "Deutsch" },
  { value: "fr", label: "Français" }, { value: "zh", label: "中文" },
];

const CATEGORIES = [
  "Презентации", "Дизайн", "Документы", "Социальные сети", "Email-рассылки",
  "Резюме", "Инфографика", "Баннеры", "Логотипы", "Мокапы",
  "UI/UX", "3D", "Видео шаблоны", "Аудио", "Другое",
];

const FORMATS = [
  "PSD", "AI", "Figma", "Sketch", "XD", "PPTX", "DOCX",
  "ZIP", "PDF", "SVG", "PNG", "Canva", "Другое",
];

const SOFTWARE = [
  "Photoshop", "Illustrator", "Figma", "Sketch", "Adobe XD",
  "Canva", "PowerPoint", "Google Slides", "After Effects",
  "Premiere Pro", "Blender", "Другое",
];

type EditorTab = "files" | "info" | "monetization" | "audience" | "publish";

const EDITOR_TABS: { id: EditorTab; label: string; icon: React.ElementType }[] = [
  { id: "files", label: "Файлы и превью", icon: Package },
  { id: "info", label: "Информация", icon: FileText },
  { id: "monetization", label: "Монетизация", icon: DollarSign },
  { id: "audience", label: "Аудитория", icon: Shield },
  { id: "publish", label: "Публикация", icon: Calendar },
];

export function TemplateEditor({ editItem, onClose, onSaved }: TemplateEditorProps) {
  const { user, profile } = useAuth();
  const templateFileInputRef = useRef<HTMLInputElement>(null);
  const previewInputRef = useRef<HTMLInputElement>(null);
  const isEditing = !!editItem;

  const [form, setForm] = useState<TemplateFormData>(() => ({
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
    category: "", format: "", software: "",
  }));

  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templateFileName, setTemplateFileName] = useState("");
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState(editItem?.thumbnail || "");
  const [tagInput, setTagInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isDraggingPreview, setIsDraggingPreview] = useState(false);
  const [activeTab, setActiveTab] = useState<EditorTab>("files");

  const STORAGE_KEY = editItem ? `template-editor-${editItem.id}` : "template-editor-new";
  useEffect(() => { if (!editItem) { try { const s = localStorage.getItem(STORAGE_KEY); if (s) setForm(JSON.parse(s)); } catch {} } }, []);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(form)); }, [form, STORAGE_KEY]);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDraggingFile(false);
    const file = e.dataTransfer.files[0];
    if (file) { setTemplateFile(file); setTemplateFileName(file.name); }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setTemplateFile(file); setTemplateFileName(file.name); }
  };

  const handlePreviewDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDraggingPreview(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) { setPreviewFile(file); setPreviewUrl(URL.createObjectURL(file)); }
    else toast.error("Поддерживаются только изображения");
  }, []);

  const handlePreviewSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setPreviewFile(file); setPreviewUrl(URL.createObjectURL(file)); }
  };

  const addTag = () => { const t = tagInput.trim(); if (t && !form.tags.includes(t) && form.tags.length < 15) { setForm(p => ({ ...p, tags: [...p.tags, t] })); setTagInput(""); } };
  const removeTag = (tag: string) => setForm(p => ({ ...p, tags: p.tags.filter(t => t !== tag) }));

  const uploadFileToStorage = async (file: File, path: string) => {
    const { data, error } = await supabase.storage.from("content-media").upload(path, file, { upsert: true });
    if (error) throw error;
    return supabase.storage.from("content-media").getPublicUrl(data.path).data.publicUrl;
  };

  const handleSave = async (publishStatus?: string) => {
    if (!form.title.trim()) { toast.error("Введите название шаблона"); return; }
    if (!user?.id) { toast.error("Необходимо авторизоваться"); return; }

    setSaving(true); setUploading(true); setUploadProgress(10);
    try {
      let fileUrl = editItem?.video_url || "";
      let thumbnailUrl = editItem?.thumbnail || "";
      if (templateFile) { setUploadProgress(30); fileUrl = await uploadFileToStorage(templateFile, `${user.id}/templates/${Date.now()}_${templateFile.name}`); setUploadProgress(60); }
      if (previewFile) { thumbnailUrl = await uploadFileToStorage(previewFile, `${user.id}/templates/previews/${Date.now()}_${previewFile.name}`); setUploadProgress(80); }
      setUploadProgress(90);

      let scheduledAtUtc: string | null = null;
      if (form.status === "scheduled" && form.scheduled_at) scheduledAtUtc = new Date(form.scheduled_at).toISOString();

      const record: Record<string, any> = {
        title: form.title.trim(), description: form.description, tags: form.tags,
        type: "template", thumbnail: thumbnailUrl, video_url: fileUrl,
        age_restricted: form.age_restricted, language: form.language, geo: form.geo,
        monetization_type: form.monetization_type,
        price: form.monetization_type === "paid" ? form.price : null,
        price_min: form.monetization_type === "pay_what_you_want" ? form.price_min : null,
        status: publishStatus || form.status, scheduled_at: scheduledAtUtc,
        creator_id: user.id, creator_name: profile?.display_name || "",
        creator_avatar: profile?.avatar_url || "",
      };

      let error;
      if (isEditing) { ({ error } = await supabase.from("content_items").update(record).eq("id", editItem.id)); }
      else { ({ error } = await supabase.from("content_items").insert(record as any)); }
      setUploadProgress(100);
      if (error) throw error;
      toast.success(publishStatus === "published" ? "Шаблон опубликован!" : "Сохранено как черновик");
      localStorage.removeItem(STORAGE_KEY); onSaved();
    } catch (e: any) { toast.error(`Ошибка: ${e.message}`); }
    finally { setSaving(false); setUploading(false); setUploadProgress(0); }
  };

  const checklist = [
    { done: !!templateFile || !!editItem?.video_url, label: "Файл шаблона" },
    { done: !!previewUrl, label: "Превью" },
    { done: !!form.title.trim(), label: "Название" },
    { done: !!form.description.trim(), label: "Описание" },
    { done: form.tags.length > 0, label: "Теги" },
  ];
  const completedCount = checklist.filter(c => c.done).length;

  return (
    <div className="space-y-0">
      <div className="flex items-center justify-between gap-4 flex-wrap sticky top-0 z-10 bg-background/95 backdrop-blur py-3 border-b border-border px-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onClose}>← Назад</Button>
          <Separator orientation="vertical" className="h-6" />
          <Layout className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">{isEditing ? "Редактирование шаблона" : "Новый шаблон"}</h2>
          <Badge variant={form.status === "published" ? "default" : "secondary"} className="text-[10px]">
            {form.status === "published" ? "Опубликовано" : form.status === "scheduled" ? "Запланировано" : "Черновик"}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleSave("draft")} disabled={saving}><Save className="h-3.5 w-3.5 mr-1.5" /> Черновик</Button>
          <Button size="sm" onClick={() => handleSave("published")} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Опубликовать
          </Button>
        </div>
      </div>

      {uploading && (
        <div className="px-6 pt-3 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> Загрузка...</span><span>{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} className="h-2" />
        </div>
      )}

      <div className="flex h-[calc(100vh-7.5rem)]">
        <aside className="w-56 shrink-0 border-r border-border bg-card/50 flex flex-col overflow-y-auto">
          <nav className="py-2 px-2 space-y-0.5 flex-1">
            {EDITOR_TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={cn("flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm transition-all text-left",
                  activeTab === tab.id ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}>
                <tab.icon className="h-4 w-4 shrink-0" /><span>{tab.label}</span>
              </button>
            ))}
          </nav>
          <div className="p-3 border-t border-border space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Готовность</p>
              <span className="text-[10px] font-bold text-primary">{completedCount}/{checklist.length}</span>
            </div>
            <Progress value={(completedCount / checklist.length) * 100} className="h-1.5" />
            {checklist.map(c => (
              <div key={c.label} className="flex items-center gap-2 text-sm">
                {c.done ? <CheckCircle className="h-3.5 w-3.5 text-success" /> : <div className="h-3.5 w-3.5 rounded-full border border-border" />}
                <span className={cn("text-xs", c.done ? "text-foreground" : "text-muted-foreground")}>{c.label}</span>
              </div>
            ))}
          </div>
        </aside>

        <div className="flex-1 min-w-0 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}
              className="px-6 py-5 max-w-3xl mx-auto space-y-6">

              {activeTab === "files" && (
                <>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-foreground">Файлы шаблона и превью</h3>
                    <p className="text-sm text-muted-foreground">Загрузите файл шаблона и изображение для превью</p>
                  </div>

                  {/* Template file */}
                  <div className="space-y-2">
                    <Label>Файл шаблона</Label>
                    <div onDragOver={e => { e.preventDefault(); setIsDraggingFile(true); }} onDragLeave={() => setIsDraggingFile(false)} onDrop={handleFileDrop}
                      onClick={() => templateFileInputRef.current?.click()}
                      className={cn("relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all",
                        isDraggingFile ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/30")}>
                      {templateFileName ? (
                        <div className="space-y-2">
                          <Package className="h-8 w-8 text-primary mx-auto" />
                          <p className="text-sm font-medium text-foreground">{templateFileName}</p>
                          <p className="text-xs text-muted-foreground">Нажмите, чтобы заменить</p>
                        </div>
                      ) : (
                        <>
                          <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">Перетащите файл шаблона или нажмите для выбора</p>
                          <p className="text-[10px] text-muted-foreground/60 mt-1">PSD, AI, Figma, ZIP, PPTX и другие</p>
                        </>
                      )}
                    </div>
                    <input ref={templateFileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
                  </div>

                  {/* Preview image */}
                  <div className="space-y-2">
                    <Label>Превью изображение</Label>
                    <div onDragOver={e => { e.preventDefault(); setIsDraggingPreview(true); }} onDragLeave={() => setIsDraggingPreview(false)} onDrop={handlePreviewDrop}
                      onClick={() => previewInputRef.current?.click()}
                      className={cn("relative cursor-pointer rounded-xl border-2 border-dashed transition-all overflow-hidden",
                        previewUrl ? "p-0" : "p-8 text-center",
                        isDraggingPreview ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/30")}>
                      {previewUrl ? (
                        <div className="relative">
                          <img src={previewUrl} alt="Превью" className="w-full max-h-64 object-cover" />
                          <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center">
                            <span className="text-white text-sm font-medium opacity-0 hover:opacity-100 transition-opacity">Заменить</span>
                          </div>
                        </div>
                      ) : (
                        <>
                          <ImageIcon className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">Превью для каталога и карточки</p>
                          <p className="text-[10px] text-muted-foreground/60 mt-1">JPG, PNG · 16:9</p>
                        </>
                      )}
                    </div>
                    <input ref={previewInputRef} type="file" accept="image/*" className="hidden" onChange={handlePreviewSelect} />
                  </div>
                </>
              )}

              {activeTab === "info" && (
                <>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-foreground">Информация о шаблоне</h3>
                    <p className="text-sm text-muted-foreground">Название, описание и характеристики</p>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Название шаблона *</Label>
                      <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Название вашего шаблона" maxLength={100} />
                    </div>
                    <div className="space-y-2">
                      <Label>Описание</Label>
                      <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Подробное описание шаблона, что включено, как использовать..." rows={5} maxLength={3000} />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Категория</Label>
                        <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                          <SelectTrigger><SelectValue placeholder="Выбрать" /></SelectTrigger>
                          <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Формат файла</Label>
                        <Select value={form.format} onValueChange={v => setForm(p => ({ ...p, format: v }))}>
                          <SelectTrigger><SelectValue placeholder="Выбрать" /></SelectTrigger>
                          <SelectContent>{FORMATS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Программа</Label>
                        <Select value={form.software} onValueChange={v => setForm(p => ({ ...p, software: v }))}>
                          <SelectTrigger><SelectValue placeholder="Выбрать" /></SelectTrigger>
                          <SelectContent>{SOFTWARE.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Теги <span className="text-muted-foreground text-xs">({form.tags.length}/15)</span></Label>
                      <div className="flex gap-2">
                        <Input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTag())} placeholder="Добавить тег" className="flex-1" />
                        <Button variant="outline" size="sm" onClick={addTag}><Plus className="h-3.5 w-3.5" /></Button>
                      </div>
                      {form.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {form.tags.map(t => (<Badge key={t} variant="secondary" className="text-xs gap-1 pr-1">{t}<button onClick={() => removeTag(t)}><X className="h-3 w-3" /></button></Badge>))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {activeTab === "monetization" && (
                <>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-foreground">Монетизация</h3>
                    <p className="text-sm text-muted-foreground">Как зарабатывать на шаблоне</p>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Модель монетизации</Label>
                      <Select value={form.monetization_type} onValueChange={v => setForm(p => ({ ...p, monetization_type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free">Бесплатно</SelectItem>
                          <SelectItem value="paid">Платный доступ</SelectItem>
                          <SelectItem value="subscription">Для подписчиков</SelectItem>
                          <SelectItem value="pay_what_you_want">Свободная цена</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {form.monetization_type === "paid" && (
                      <div className="space-y-2"><Label>Цена (₽)</Label>
                        <Input type="number" value={form.price ?? ""} onChange={e => setForm(p => ({ ...p, price: Number(e.target.value) || null }))} placeholder="499" min={1} /></div>
                    )}
                    {form.monetization_type === "pay_what_you_want" && (
                      <div className="space-y-2"><Label>Минимальная цена (₽)</Label>
                        <Input type="number" value={form.price_min ?? ""} onChange={e => setForm(p => ({ ...p, price_min: Number(e.target.value) || null }))} placeholder="0" min={0} /></div>
                    )}
                  </div>
                </>
              )}

              {activeTab === "audience" && (
                <>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-foreground">Аудитория</h3>
                    <p className="text-sm text-muted-foreground">Язык и регион</p>
                  </div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Язык</Label>
                        <Select value={form.language} onValueChange={v => setForm(p => ({ ...p, language: v }))}><SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{LANGUAGES.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent></Select>
                      </div>
                      <div className="space-y-2"><Label>Регион</Label>
                        <Input value={form.geo} onChange={e => setForm(p => ({ ...p, geo: e.target.value }))} placeholder="Весь мир" /></div>
                    </div>
                  </div>
                </>
              )}

              {activeTab === "publish" && (
                <>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-foreground">Публикация</h3>
                    <p className="text-sm text-muted-foreground">Когда и как опубликовать</p>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2"><Label>Статус</Label>
                      <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}><SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Черновик</SelectItem>
                          <SelectItem value="published">Опубликовать сейчас</SelectItem>
                          <SelectItem value="scheduled">Запланировать</SelectItem>
                        </SelectContent></Select>
                    </div>
                    {form.status === "scheduled" && (
                      <div className="space-y-2"><Label>Дата и время публикации</Label>
                        <Input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(p => ({ ...p, scheduled_at: e.target.value }))} /></div>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
