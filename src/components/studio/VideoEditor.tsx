import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import {
  Upload, X, Plus, Trash2, GripVertical, Image as ImageIcon,
  Play, Pause, Clock, Tag, Globe, Shield, DollarSign, Calendar,
  Save, Send, Eye, ChevronDown, ChevronUp, Film, FileText,
  AlertCircle, CheckCircle, Loader2, Music,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
interface Chapter {
  id: string;
  time: string;
  title: string;
}

interface VideoFormData {
  title: string;
  description: string;
  tags: string[];
  type: string;
  monetization_type: string;
  price: number | null;
  price_min: number | null;
  age_restricted: boolean;
  language: string;
  geo: string;
  status: string;
  scheduled_at: string;
  pinned_comment: string;
  chapters: Chapter[];
}

interface VideoEditorProps {
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

const CATEGORIES = [
  "Образование", "Развлечения", "Музыка", "Игры", "Спорт",
  "Технологии", "Путешествия", "Кулинария", "Мода", "Наука",
  "Бизнес", "Искусство", "Здоровье", "Новости", "Авто",
];

export function VideoEditor({ editItem, onClose, onSaved }: VideoEditorProps) {
  const { user, profile } = useAuth();
  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const subtitleInputRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  const isEditing = !!editItem;

  /* ── State ── */
  const [form, setForm] = useState<VideoFormData>(() => ({
    title: editItem?.title || "",
    description: editItem?.description || "",
    tags: editItem?.tags || [],
    type: "video",
    monetization_type: editItem?.monetization_type || "free",
    price: editItem?.price || null,
    price_min: editItem?.price_min || null,
    age_restricted: editItem?.age_restricted || false,
    language: editItem?.language || "ru",
    geo: editItem?.geo || "",
    status: editItem?.status || "draft",
    scheduled_at: editItem?.scheduled_at || "",
    pinned_comment: editItem?.pinned_comment || "",
    chapters: editItem?.chapters || [],
  }));

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string>(editItem?.video_url || "");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string>(editItem?.thumbnail || "");
  const [subtitleFile, setSubtitleFile] = useState<File | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDraggingVideo, setIsDraggingVideo] = useState(false);
  const [isDraggingThumb, setIsDraggingThumb] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    basic: true, media: true, chapters: false, monetization: false, audience: false, schedule: false,
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [saving, setSaving] = useState(false);

  const toggleSection = (key: string) => setExpandedSections((p) => ({ ...p, [key]: !p[key] }));

  /* ── Video drag & drop ── */
  const handleVideoDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingVideo(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("video/")) {
      setVideoFile(file);
      setVideoPreviewUrl(URL.createObjectURL(file));
    } else {
      toast.error("Поддерживаются только видео-файлы");
    }
  }, []);

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      setVideoPreviewUrl(URL.createObjectURL(file));
    }
  };

  /* ── Thumbnail ── */
  const handleThumbnailDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingThumb(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      setThumbnailFile(file);
      setThumbnailPreviewUrl(URL.createObjectURL(file));
    }
  }, []);

  const handleThumbnailSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setThumbnailFile(file);
      setThumbnailPreviewUrl(URL.createObjectURL(file));
    }
  };

  const captureFrame = () => {
    const video = videoPreviewRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], "thumbnail.jpg", { type: "image/jpeg" });
        setThumbnailFile(file);
        setThumbnailPreviewUrl(URL.createObjectURL(blob));
        toast.success("Обложка захвачена из кадра!");
      }
    }, "image/jpeg", 0.9);
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
      chapters: [...p.chapters, { id: crypto.randomUUID(), time: "00:00", title: "" }],
    }));
  };

  const updateChapter = (id: string, field: keyof Chapter, value: string) => {
    setForm((p) => ({
      ...p,
      chapters: p.chapters.map((c) => (c.id === id ? { ...c, [field]: value } : c)),
    }));
  };

  const removeChapter = (id: string) => {
    setForm((p) => ({ ...p, chapters: p.chapters.filter((c) => c.id !== id) }));
  };

  /* ── Toggle play ── */
  const togglePlay = () => {
    const v = videoPreviewRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setIsPlaying(true); }
    else { v.pause(); setIsPlaying(false); }
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
    if (!form.title.trim()) { toast.error("Введите название"); return; }
    if (!user?.id) { toast.error("Необходимо авторизоваться"); return; }

    setSaving(true);
    setUploading(true);
    setUploadProgress(10);

    try {
      let videoUrl = editItem?.video_url || "";
      let thumbnailUrl = editItem?.thumbnail || "";
      let subtitlesUrl = editItem?.subtitles_url || "";

      // Upload video
      if (videoFile) {
        setUploadProgress(20);
        videoUrl = await uploadFile(videoFile, `${user.id}/videos/${Date.now()}_${videoFile.name}`);
        setUploadProgress(60);
      }

      // Upload thumbnail
      if (thumbnailFile) {
        thumbnailUrl = await uploadFile(thumbnailFile, `${user.id}/thumbnails/${Date.now()}_${thumbnailFile.name}`);
        setUploadProgress(75);
      }

      // Upload subtitles
      if (subtitleFile) {
        subtitlesUrl = await uploadFile(subtitleFile, `${user.id}/subtitles/${Date.now()}_${subtitleFile.name}`);
      }

      setUploadProgress(85);

      const record: Record<string, any> = {
        title: form.title.trim(),
        description: form.description,
        tags: form.tags,
        type: "video",
        thumbnail: thumbnailUrl,
        video_url: videoUrl,
        chapters: form.chapters,
        subtitles_url: subtitlesUrl,
        pinned_comment: form.pinned_comment,
        age_restricted: form.age_restricted,
        language: form.language,
        geo: form.geo,
        monetization_type: form.monetization_type,
        price: form.monetization_type === "paid" ? form.price : null,
        price_min: form.monetization_type === "pay_what_you_want" ? form.price_min : null,
        status: publishStatus || form.status,
        scheduled_at: form.status === "scheduled" ? form.scheduled_at || null : null,
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

      toast.success(publishStatus === "published" ? "Видео опубликовано!" : "Сохранено как черновик");
      onSaved();
    } catch (e: any) {
      toast.error(`Ошибка: ${e.message}`);
    } finally {
      setSaving(false);
      setUploading(false);
      setUploadProgress(0);
    }
  };

  /* ── Section renderer ── */
  const Section = ({ id, icon: Icon, title, children, badge }: {
    id: string; icon: React.ElementType; title: string; children: React.ReactNode; badge?: string;
  }) => (
    <Card className="overflow-hidden">
      <button
        onClick={() => toggleSection(id)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <Icon className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {badge && <Badge variant="secondary" className="text-[10px]">{badge}</Badge>}
        </div>
        {expandedSections[id] ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      <AnimatePresence>
        {expandedSections[id] && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
            <CardContent className="px-5 pb-5 pt-0 space-y-4">
              {children}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );

  /* ════════════ RENDER ════════════ */
  return (
    <div className="space-y-6">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap sticky top-0 z-10 bg-background/95 backdrop-blur py-3 -mt-3 border-b border-border -mx-6 lg:-mx-8 px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onClose}>← Назад</Button>
          <Separator orientation="vertical" className="h-6" />
          <h2 className="text-lg font-bold text-foreground">{isEditing ? "Редактирование видео" : "Новое видео"}</h2>
          <Badge variant={form.status === "published" ? "default" : "secondary"} className="text-[10px]">
            {form.status === "published" ? "Опубликовано" : form.status === "scheduled" ? "Запланировано" : "Черновик"}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleSave("draft")} disabled={saving}>
            <Save className="h-3.5 w-3.5 mr-1.5" /> Черновик
          </Button>
          <Button size="sm" onClick={() => handleSave("published")} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
            Опубликовать
          </Button>
        </div>
      </div>

      {/* Upload progress */}
      {uploading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> Загрузка...</span>
            <span>{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} className="h-2" />
        </motion.div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ── LEFT: Main form ── */}
        <div className="xl:col-span-2 space-y-4">

          {/* Video Upload */}
          <Section id="media" icon={Film} title="Видео">
            {!videoPreviewUrl ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDraggingVideo(true); }}
                onDragLeave={() => setIsDraggingVideo(false)}
                onDrop={handleVideoDrop}
                onClick={() => videoInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all",
                  isDraggingVideo ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/30"
                )}
              >
                <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground">Перетащите видео сюда</p>
                <p className="text-xs text-muted-foreground mt-1">или нажмите для выбора файла</p>
                <p className="text-[11px] text-muted-foreground/60 mt-2">MP4, WebM, MOV · до 2 ГБ</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                  <video ref={videoPreviewRef} src={videoPreviewUrl} className="w-full h-full object-contain" />
                  <div className="absolute bottom-3 left-3 flex items-center gap-2">
                    <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full bg-black/60 hover:bg-black/80 text-white" onClick={togglePlay}>
                      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button size="sm" variant="secondary" className="h-8 rounded-full bg-black/60 hover:bg-black/80 text-white text-xs" onClick={captureFrame}>
                      <ImageIcon className="h-3 w-3 mr-1" /> Захватить кадр
                    </Button>
                  </div>
                  <Button size="icon" variant="secondary" className="absolute top-3 right-3 h-8 w-8 rounded-full bg-black/60 hover:bg-black/80 text-white"
                    onClick={() => { setVideoFile(null); setVideoPreviewUrl(""); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {videoFile && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Film className="h-3 w-3" />
                    <span>{videoFile.name}</span>
                    <span className="text-muted-foreground/50">·</span>
                    <span>{(videoFile.size / 1024 / 1024).toFixed(1)} МБ</span>
                  </div>
                )}
              </div>
            )}
            <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoSelect} />
          </Section>

          {/* Basic Info */}
          <Section id="basic" icon={FileText} title="Основная информация">
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-medium mb-1.5 block">Название *</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Введите название видео"
                  className="text-sm"
                  maxLength={100}
                />
                <p className="text-[11px] text-muted-foreground mt-1">{form.title.length}/100</p>
              </div>

              <div>
                <Label className="text-xs font-medium mb-1.5 block">Описание</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Расскажите о видео…"
                  className="min-h-[140px] text-sm resize-y"
                  maxLength={5000}
                />
                <p className="text-[11px] text-muted-foreground mt-1">{form.description.length}/5000</p>
              </div>

              {/* Tags */}
              <div>
                <Label className="text-xs font-medium mb-1.5 block">Теги</Label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {form.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs gap-1 pr-1">
                      {tag}
                      <button onClick={() => removeTag(tag)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                    placeholder="Добавить тег…"
                    className="text-sm flex-1"
                  />
                  <Button variant="outline" size="sm" onClick={addTag} disabled={!tagInput.trim()}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                {/* Quick category tags */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {CATEGORIES.filter((c) => !form.tags.includes(c)).slice(0, 8).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setForm((p) => ({ ...p, tags: [...p.tags, cat] }))}
                      className="text-[11px] px-2 py-0.5 rounded-full border border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                    >
                      + {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* Chapters */}
          <Section id="chapters" icon={Clock} title="Таймкоды / Главы" badge={form.chapters.length > 0 ? String(form.chapters.length) : undefined}>
            <p className="text-xs text-muted-foreground">Добавьте главы для навигации по видео</p>
            <div className="space-y-2">
              {form.chapters.map((ch, i) => (
                <div key={ch.id} className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0 cursor-grab" />
                  <Input
                    value={ch.time}
                    onChange={(e) => updateChapter(ch.id, "time", e.target.value)}
                    placeholder="00:00"
                    className="w-20 text-sm text-center font-mono"
                  />
                  <Input
                    value={ch.title}
                    onChange={(e) => updateChapter(ch.id, "title", e.target.value)}
                    placeholder={`Глава ${i + 1}`}
                    className="text-sm flex-1"
                  />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeChapter(ch.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={addChapter}>
              <Plus className="h-3 w-3 mr-1.5" /> Добавить главу
            </Button>
          </Section>

          {/* Monetization */}
          <Section id="monetization" icon={DollarSign} title="Монетизация">
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-medium mb-1.5 block">Модель доступа</Label>
                <Select value={form.monetization_type} onValueChange={(v) => setForm((p) => ({ ...p, monetization_type: v }))}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Бесплатно</SelectItem>
                    <SelectItem value="paid">Разовая покупка</SelectItem>
                    <SelectItem value="subscription">По подписке</SelectItem>
                    <SelectItem value="pay_what_you_want">Pay-what-you-want</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.monetization_type === "paid" && (
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">Цена (₽)</Label>
                  <Input
                    type="number"
                    value={form.price || ""}
                    onChange={(e) => setForm((p) => ({ ...p, price: Number(e.target.value) || null }))}
                    placeholder="299"
                    className="text-sm w-40"
                    min={1}
                  />
                </div>
              )}

              {form.monetization_type === "pay_what_you_want" && (
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">Минимальная цена (₽)</Label>
                  <Input
                    type="number"
                    value={form.price_min || ""}
                    onChange={(e) => setForm((p) => ({ ...p, price_min: Number(e.target.value) || null }))}
                    placeholder="100"
                    className="text-sm w-40"
                    min={0}
                  />
                </div>
              )}

              {form.monetization_type === "subscription" && (
                <div className="rounded-lg bg-muted/50 border border-border p-3 text-xs text-muted-foreground">
                  <AlertCircle className="h-3.5 w-3.5 inline mr-1" />
                  Видео будет доступно только вашим подписчикам
                </div>
              )}
            </div>
          </Section>

          {/* Audience */}
          <Section id="audience" icon={Shield} title="Аудитория и настройки">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Возрастное ограничение (18+)</p>
                  <p className="text-xs text-muted-foreground">Контент для взрослой аудитории</p>
                </div>
                <Switch checked={form.age_restricted} onCheckedChange={(v) => setForm((p) => ({ ...p, age_restricted: v }))} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">Язык</Label>
                  <Select value={form.language} onValueChange={(v) => setForm((p) => ({ ...p, language: v }))}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-medium mb-1.5 block">Геолокация</Label>
                  <Input
                    value={form.geo}
                    onChange={(e) => setForm((p) => ({ ...p, geo: e.target.value }))}
                    placeholder="Россия"
                    className="text-sm"
                  />
                </div>
              </div>

              {/* Subtitles */}
              <div>
                <Label className="text-xs font-medium mb-1.5 block">Субтитры</Label>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => subtitleInputRef.current?.click()}>
                    <Upload className="h-3 w-3 mr-1.5" /> Загрузить .srt / .vtt
                  </Button>
                  {subtitleFile && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <CheckCircle className="h-3 w-3 text-success" /> {subtitleFile.name}
                    </span>
                  )}
                </div>
                <input ref={subtitleInputRef} type="file" accept=".srt,.vtt" className="hidden"
                  onChange={(e) => { if (e.target.files?.[0]) setSubtitleFile(e.target.files[0]); }} />
              </div>

              {/* Pinned comment */}
              <div>
                <Label className="text-xs font-medium mb-1.5 block">Закреплённый комментарий</Label>
                <Textarea
                  value={form.pinned_comment}
                  onChange={(e) => setForm((p) => ({ ...p, pinned_comment: e.target.value }))}
                  placeholder="Этот комментарий будет закреплён сверху…"
                  className="min-h-[60px] text-sm resize-y"
                  maxLength={500}
                />
              </div>
            </div>
          </Section>

          {/* Schedule */}
          <Section id="schedule" icon={Calendar} title="Публикация">
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-medium mb-1.5 block">Статус</Label>
                <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Черновик</SelectItem>
                    <SelectItem value="scheduled">Запланировано</SelectItem>
                    <SelectItem value="published">Опубликовано</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.status === "scheduled" && (
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">Дата и время публикации</Label>
                  <Input
                    type="datetime-local"
                    value={form.scheduled_at}
                    onChange={(e) => setForm((p) => ({ ...p, scheduled_at: e.target.value }))}
                    className="text-sm w-64"
                  />
                </div>
              )}
            </div>
          </Section>
        </div>

        {/* ── RIGHT: Preview & Thumbnail ── */}
        <div className="space-y-4">
          {/* Thumbnail */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-primary" /> Обложка
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {thumbnailPreviewUrl ? (
                <div className="relative rounded-lg overflow-hidden aspect-video mb-3">
                  <img src={thumbnailPreviewUrl} alt="Обложка" className="w-full h-full object-cover" />
                  <Button size="icon" variant="secondary" className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 hover:bg-black/80 text-white"
                    onClick={() => { setThumbnailFile(null); setThumbnailPreviewUrl(""); }}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDraggingThumb(true); }}
                  onDragLeave={() => setIsDraggingThumb(false)}
                  onDrop={handleThumbnailDrop}
                  onClick={() => thumbnailInputRef.current?.click()}
                  className={cn(
                    "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all aspect-video flex flex-col items-center justify-center",
                    isDraggingThumb ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                  )}
                >
                  <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground">Загрузите или перетащите</p>
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5">JPG, PNG · 16:9</p>
                </div>
              )}
              <input ref={thumbnailInputRef} type="file" accept="image/*" className="hidden" onChange={handleThumbnailSelect} />
              {videoPreviewUrl && (
                <Button variant="outline" size="sm" className="w-full text-xs" onClick={captureFrame}>
                  <Film className="h-3 w-3 mr-1.5" /> Захватить из видео
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Preview Card */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" /> Предпросмотр карточки
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="aspect-video bg-muted relative">
                  {thumbnailPreviewUrl ? (
                    <img src={thumbnailPreviewUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <Film className="h-8 w-8" />
                    </div>
                  )}
                  {form.age_restricted && (
                    <Badge variant="destructive" className="absolute top-2 left-2 text-[9px]">18+</Badge>
                  )}
                  {form.monetization_type !== "free" && (
                    <Badge className="absolute top-2 right-2 text-[9px] bg-success text-white">
                      {form.monetization_type === "paid" ? `₽${form.price || 0}` :
                       form.monetization_type === "subscription" ? "Подписка" : "PWYW"}
                    </Badge>
                  )}
                </div>
                <div className="p-3 space-y-1">
                  <p className="text-sm font-semibold text-foreground line-clamp-2">{form.title || "Название видео"}</p>
                  <p className="text-xs text-muted-foreground">{profile?.display_name || "Автор"}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {form.tags.slice(0, 3).map((t) => (
                      <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                    ))}
                    {form.tags.length > 3 && <Badge variant="secondary" className="text-[10px]">+{form.tags.length - 3}</Badge>}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick stats */}
          <Card>
            <CardContent className="p-4 space-y-2.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Чеклист</p>
              {[
                { done: !!videoPreviewUrl, label: "Видео загружено" },
                { done: !!form.title.trim(), label: "Название заполнено" },
                { done: !!form.description.trim(), label: "Описание добавлено" },
                { done: !!thumbnailPreviewUrl, label: "Обложка загружена" },
                { done: form.tags.length > 0, label: "Теги добавлены" },
              ].map((c) => (
                <div key={c.label} className="flex items-center gap-2 text-xs">
                  {c.done ? <CheckCircle className="h-3.5 w-3.5 text-success" /> : <div className="h-3.5 w-3.5 rounded-full border border-border" />}
                  <span className={cn(c.done ? "text-foreground" : "text-muted-foreground")}>{c.label}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
