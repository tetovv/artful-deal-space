import { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload, X, Plus, Trash2, Mic,
  Save, Send, Eye, ChevronDown, ChevronUp,
  FileText, AlertCircle, CheckCircle, Loader2,
  DollarSign, Shield, Calendar, Clock, Tag, Globe,
  Headphones, Hash, ImageIcon, Layers, Radio,
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

interface PodcastFormData {
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
  showName: string;
  season: string;
  episodeNumber: string;
  guests: string;
}

interface PodcastEditorProps {
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
  "Бизнес", "Технологии", "Образование", "Наука", "Общество",
  "Здоровье", "Развлечения", "Спорт", "Культура", "Политика",
  "Психология", "Истории", "Новости", "Интервью", "Другое",
];

type EditorTab = "media" | "info" | "episode" | "monetization" | "audience" | "publish";

const EDITOR_TABS: { id: EditorTab; label: string; icon: React.ElementType }[] = [
  { id: "media", label: "Аудио и обложка", icon: Mic },
  { id: "info", label: "Описание", icon: FileText },
  { id: "episode", label: "Эпизод", icon: Radio },
  { id: "monetization", label: "Монетизация", icon: DollarSign },
  { id: "audience", label: "Аудитория", icon: Shield },
  { id: "publish", label: "Публикация", icon: Calendar },
];

export function PodcastEditor({ editItem, onClose, onSaved }: PodcastEditorProps) {
  const { user, profile } = useAuth();
  const audioInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const isEditing = !!editItem;

  const [form, setForm] = useState<PodcastFormData>(() => ({
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
    showName: "", season: "1", episodeNumber: "", guests: "",
  }));

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioFileName, setAudioFileName] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState(editItem?.thumbnail || "");
  const [tagInput, setTagInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [isDraggingAudio, setIsDraggingAudio] = useState(false);
  const [isDraggingCover, setIsDraggingCover] = useState(false);
  const [activeTab, setActiveTab] = useState<EditorTab>("media");
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);

  const STORAGE_KEY = editItem ? `podcast-editor-${editItem.id}` : "podcast-editor-new";
  useEffect(() => { if (!editItem) { try { const s = localStorage.getItem(STORAGE_KEY); if (s) setForm(JSON.parse(s)); } catch {} } }, []);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(form)); }, [form, STORAGE_KEY]);

  const handleAudioDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDraggingAudio(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("audio/")) { setAudioFile(file); setAudioFileName(file.name); extractDuration(file); }
    else toast.error("Поддерживаются только аудио-файлы");
  }, []);

  const extractDuration = (file: File) => {
    const url = URL.createObjectURL(file);
    const a = new Audio(); a.src = url;
    a.onloadedmetadata = () => { setAudioDuration(a.duration); URL.revokeObjectURL(url); };
  };

  const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setAudioFile(file); setAudioFileName(file.name); extractDuration(file); }
  };

  const handleCoverDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDraggingCover(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) { setCoverFile(file); setCoverPreviewUrl(URL.createObjectURL(file)); }
    else toast.error("Поддерживаются только изображения");
  }, []);

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setCoverFile(file); setCoverPreviewUrl(URL.createObjectURL(file)); }
  };

  const addTag = () => { const t = tagInput.trim(); if (t && !form.tags.includes(t) && form.tags.length < 15) { setForm(p => ({ ...p, tags: [...p.tags, t] })); setTagInput(""); } };
  const removeTag = (tag: string) => setForm(p => ({ ...p, tags: p.tags.filter(t => t !== tag) }));

  const uploadFileToStorage = async (file: File, path: string) => {
    const { data, error } = await supabase.storage.from("content-media").upload(path, file, { upsert: true });
    if (error) throw error;
    return supabase.storage.from("content-media").getPublicUrl(data.path).data.publicUrl;
  };

  const handleSave = async (publishStatus?: string) => {
    if (!form.title.trim()) { toast.error("Введите название эпизода"); return; }
    if (!user?.id) { toast.error("Необходимо авторизоваться"); return; }

    setSaving(true); setUploading(true); setUploadProgress(10);
    try {
      let audioUrl = editItem?.video_url || "";
      let thumbnailUrl = editItem?.thumbnail || "";
      if (audioFile) { setUploadProgress(30); audioUrl = await uploadFileToStorage(audioFile, `${user.id}/podcasts/${Date.now()}_${audioFile.name}`); setUploadProgress(60); }
      if (coverFile) { thumbnailUrl = await uploadFileToStorage(coverFile, `${user.id}/podcasts/covers/${Date.now()}_${coverFile.name}`); setUploadProgress(80); }
      setUploadProgress(90);

      let scheduledAtUtc: string | null = null;
      if (form.status === "scheduled" && form.scheduled_at) scheduledAtUtc = new Date(form.scheduled_at).toISOString();

      const record: Record<string, any> = {
        title: form.title.trim(), description: form.description, tags: form.tags,
        type: "podcast", thumbnail: thumbnailUrl, video_url: audioUrl,
        age_restricted: form.age_restricted, language: form.language, geo: form.geo,
        monetization_type: form.monetization_type,
        price: form.monetization_type === "paid" ? form.price : null,
        price_min: form.monetization_type === "pay_what_you_want" ? form.price_min : null,
        status: publishStatus || form.status, scheduled_at: scheduledAtUtc,
        creator_id: user.id, creator_name: profile?.display_name || "",
        creator_avatar: profile?.avatar_url || "",
        duration: audioDuration > 0 ? Math.round(audioDuration) : null,
      };

      let error;
      if (isEditing) { ({ error } = await supabase.from("content_items").update(record).eq("id", editItem.id)); }
      else { ({ error } = await supabase.from("content_items").insert(record as any)); }
      setUploadProgress(100);
      if (error) throw error;
      toast.success(publishStatus === "published" ? "Подкаст опубликован!" : "Сохранено как черновик");
      localStorage.removeItem(STORAGE_KEY); onSaved();
    } catch (e: any) { toast.error(`Ошибка: ${e.message}`); }
    finally { setSaving(false); setUploading(false); setUploadProgress(0); }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

  const checklist = [
    { done: !!audioFile || !!editItem?.video_url, label: "Аудиозапись" },
    { done: !!coverPreviewUrl, label: "Обложка" },
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
          <Mic className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">{isEditing ? "Редактирование подкаста" : "Новый эпизод подкаста"}</h2>
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
            <span className="flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> Загрузка...</span>
            <span>{uploadProgress}%</span>
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

              {activeTab === "media" && (
                <>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-foreground">Аудиозапись и обложка</h3>
                    <p className="text-sm text-muted-foreground">Загрузите запись эпизода и обложку подкаста</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Аудиозапись эпизода</Label>
                    <div onDragOver={e => { e.preventDefault(); setIsDraggingAudio(true); }} onDragLeave={() => setIsDraggingAudio(false)} onDrop={handleAudioDrop}
                      onClick={() => audioInputRef.current?.click()}
                      className={cn("relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all",
                        isDraggingAudio ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/30")}>
                      {audioFileName ? (
                        <div className="space-y-2">
                          <Headphones className="h-8 w-8 text-primary mx-auto" />
                          <p className="text-sm font-medium text-foreground">{audioFileName}</p>
                          {audioDuration > 0 && <p className="text-xs text-muted-foreground">Длительность: {formatTime(audioDuration)}</p>}
                        </div>
                      ) : (
                        <>
                          <Mic className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">Перетащите аудиофайл или нажмите для выбора</p>
                          <p className="text-[10px] text-muted-foreground/60 mt-1">MP3, WAV, M4A, OGG</p>
                        </>
                      )}
                    </div>
                    <input ref={audioInputRef} type="file" accept="audio/*" className="hidden" onChange={handleAudioSelect} />
                  </div>
                  <div className="space-y-2">
                    <Label>Обложка подкаста</Label>
                    <div className="flex gap-6 items-start">
                      <div onDragOver={e => { e.preventDefault(); setIsDraggingCover(true); }} onDragLeave={() => setIsDraggingCover(false)} onDrop={handleCoverDrop}
                        onClick={() => coverInputRef.current?.click()}
                        className={cn("relative w-40 h-40 cursor-pointer rounded-xl overflow-hidden transition-all border-2 border-dashed flex items-center justify-center",
                          isDraggingCover ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/30")}>
                        {coverPreviewUrl ? <img src={coverPreviewUrl} alt="Обложка" className="absolute inset-0 w-full h-full object-cover" /> : (
                          <div className="text-center"><ImageIcon className="h-6 w-6 text-muted-foreground mx-auto mb-1" /><p className="text-[10px] text-muted-foreground">1:1</p></div>
                        )}
                      </div>
                      <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverSelect} />
                      <div className="flex-1 space-y-2 text-xs text-muted-foreground">
                        <p>Рекомендуемый размер: 3000×3000 px</p>
                        <p>Квадратная обложка для подкаст-платформ.</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {activeTab === "info" && (
                <>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-foreground">Описание эпизода</h3>
                    <p className="text-sm text-muted-foreground">Название и описание для слушателей</p>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Название эпизода *</Label>
                      <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Название эпизода" maxLength={150} />
                    </div>
                    <div className="space-y-2">
                      <Label>Описание</Label>
                      <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="О чём этот эпизод? Ключевые темы, таймкоды..." rows={6} maxLength={5000} />
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

              {activeTab === "episode" && (
                <>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-foreground">Информация об эпизоде</h3>
                    <p className="text-sm text-muted-foreground">Шоу, сезон и гости</p>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Название шоу</Label>
                      <Input value={form.showName} onChange={e => setForm(p => ({ ...p, showName: e.target.value }))} placeholder="Название подкаст-шоу" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Сезон</Label>
                        <Input type="number" value={form.season} onChange={e => setForm(p => ({ ...p, season: e.target.value }))} min={1} />
                      </div>
                      <div className="space-y-2">
                        <Label>Номер эпизода</Label>
                        <Input type="number" value={form.episodeNumber} onChange={e => setForm(p => ({ ...p, episodeNumber: e.target.value }))} placeholder="1" min={1} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Гости</Label>
                      <Input value={form.guests} onChange={e => setForm(p => ({ ...p, guests: e.target.value }))} placeholder="Имена гостей через запятую" />
                    </div>
                  </div>
                </>
              )}

              {activeTab === "monetization" && (
                <>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-foreground">Монетизация</h3>
                    <p className="text-sm text-muted-foreground">Как зарабатывать на подкасте</p>
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
                        <Input type="number" value={form.price ?? ""} onChange={e => setForm(p => ({ ...p, price: Number(e.target.value) || null }))} placeholder="199" min={1} />
                      </div>
                    )}
                    {form.monetization_type === "pay_what_you_want" && (
                      <div className="space-y-2"><Label>Минимальная цена (₽)</Label>
                        <Input type="number" value={form.price_min ?? ""} onChange={e => setForm(p => ({ ...p, price_min: Number(e.target.value) || null }))} placeholder="0" min={0} />
                      </div>
                    )}
                  </div>
                </>
              )}

              {activeTab === "audience" && (
                <>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-foreground">Аудитория</h3>
                    <p className="text-sm text-muted-foreground">Язык, регион и ограничения</p>
                  </div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Язык</Label>
                        <Select value={form.language} onValueChange={v => setForm(p => ({ ...p, language: v }))}><SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{LANGUAGES.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent></Select>
                      </div>
                      <div className="space-y-2"><Label>Регион</Label>
                        <Input value={form.geo} onChange={e => setForm(p => ({ ...p, geo: e.target.value }))} placeholder="Весь мир" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border p-4">
                      <div><Label>Возрастное ограничение (18+)</Label><p className="text-xs text-muted-foreground mt-0.5">Содержит ненормативную лексику</p></div>
                      <Switch checked={form.age_restricted} onCheckedChange={v => setForm(p => ({ ...p, age_restricted: v }))} />
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
