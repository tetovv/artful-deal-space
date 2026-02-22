import { useState, useMemo } from "react";
import {
  ListVideo, History, Download, Plus, Trash2, Bookmark,
  Search, FolderOpen, Globe, Lock, Play, Clock,
  Sparkles, RefreshCw, Video, Music, FileText, BookOpen, Layout,
  CheckCircle2, AlertTriangle, XCircle, ExternalLink, ChevronRight,
  Film, Scissors, SearchCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PageTransition } from "@/components/layout/PageTransition";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

const formatDate = (d: string) => {
  try { return format(new Date(d), "d MMM yyyy, HH:mm", { locale: ru }); } catch { return d; }
};

const VALIDATION_STATUS_META: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  VALID: { label: "Актуален", icon: CheckCircle2, className: "text-success" },
  STALE: { label: "Устарел", icon: AlertTriangle, className: "text-warning" },
  PARTIALLY_INACCESSIBLE: { label: "Частично недоступен", icon: AlertTriangle, className: "text-warning" },
  FAILED: { label: "Ошибка валидации", icon: XCircle, className: "text-destructive" },
};

const SOURCE_TYPE_FILTERS = [
  { value: "all", label: "Все" },
  { value: "video", label: "Видео" },
  { value: "audio", label: "Аудио" },
  { value: "post", label: "Посты" },
  { value: "book", label: "Книги" },
  { value: "template", label: "Шаблоны" },
];

const SOURCE_ICONS: Record<string, React.ElementType> = {
  video: Video, audio: Music, podcast: Music, post: FileText, book: BookOpen, template: Layout,
};

const CONFIDENCE_STYLES: Record<string, { label: string; className: string }> = {
  high: { label: "Высокая", className: "bg-success/10 text-success border-success/20" },
  medium: { label: "Средняя", className: "bg-warning/10 text-warning border-warning/20" },
  low: { label: "Низкая", className: "bg-destructive/10 text-destructive border-destructive/20" },
};

const Library = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("playlists");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newPlaylist, setNewPlaylist] = useState({ title: "", description: "", is_public: true });

  // Saved answers state
  const [savedSearch, setSavedSearch] = useState("");
  const [savedTypeFilter, setSavedTypeFilter] = useState("all");
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null);
  const [revalidating, setRevalidating] = useState(false);

  // Playlists
  const { data: playlists = [], isLoading: playlistsLoading } = useQuery({
    queryKey: ["my-playlists", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase.from("playlists").select("*").eq("user_id", user.id).order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: playlistCounts = {} } = useQuery({
    queryKey: ["playlist-counts", playlists.map((p: any) => p.id)],
    queryFn: async () => {
      const counts: Record<string, number> = {};
      for (const pl of playlists) {
        const { count } = await supabase.from("playlist_items").select("*", { count: "exact", head: true }).eq("playlist_id", pl.id);
        counts[pl.id] = count || 0;
      }
      return counts;
    },
    enabled: playlists.length > 0,
  });

  // Bookmarks
  const { data: bookmarks = [], isLoading: bookmarksLoading } = useQuery({
    queryKey: ["my-bookmarks", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase.from("bookmarks").select("*, content_items(*)").eq("user_id", user.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // View history
  const { data: viewHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: ["view-history", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase.from("view_history").select("*, content_items(*)").eq("user_id", user.id).order("viewed_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Download history
  const { data: downloadHistory = [], isLoading: downloadsLoading } = useQuery({
    queryKey: ["download-history", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase.from("download_history").select("*, content_items(*)").eq("user_id", user.id).order("downloaded_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Saved answers
  const { data: savedAnswers = [], isLoading: savedLoading } = useQuery({
    queryKey: ["saved-answers", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("saved_answers")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Saved searches (meaning video)
  const { data: savedSearches = [], isLoading: savedSearchesLoading } = useQuery({
    queryKey: ["saved-searches", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("saved_searches" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user?.id,
  });

  // Saved montages
  const { data: savedMontages = [], isLoading: savedMontagesLoading } = useQuery({
    queryKey: ["saved-montages", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("saved_montages" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user?.id,
  });

  // Moment bookmarks
  const { data: momentBookmarks = [], isLoading: momentBookmarksLoading } = useQuery({
    queryKey: ["moment-bookmarks", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("moment_bookmarks" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user?.id,
  });

  // Evidence for selected saved answer
  const { data: selectedEvidence = [] } = useQuery({
    queryKey: ["saved-answer-evidence", selectedSavedId],
    queryFn: async () => {
      if (!selectedSavedId) return [];
      const { data, error } = await supabase
        .from("saved_answer_evidence")
        .select("*")
        .eq("saved_answer_id", selectedSavedId)
        .order("captured_at");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedSavedId,
  });

  const selectedSaved = savedAnswers.find((s: any) => s.id === selectedSavedId);

  // Filter saved answers
  const filteredSaved = useMemo(() => {
    let items = savedAnswers;
    if (savedSearch) {
      const q = savedSearch.toLowerCase();
      items = items.filter((s: any) => s.question_text.toLowerCase().includes(q) || s.answer_text.toLowerCase().includes(q));
    }
    return items;
  }, [savedAnswers, savedSearch]);

  // Filter by source type (needs evidence data — filter on selected detail only)
  const filteredEvidence = useMemo(() => {
    if (savedTypeFilter === "all") return selectedEvidence;
    return selectedEvidence.filter((e: any) => e.source_type === savedTypeFilter);
  }, [selectedEvidence, savedTypeFilter]);

  const createPlaylistMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !newPlaylist.title.trim()) throw new Error("Введите название");
      const { error } = await supabase.from("playlists").insert({ user_id: user.id, title: newPlaylist.title.trim(), description: newPlaylist.description, is_public: newPlaylist.is_public });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["my-playlists"] }); setCreateOpen(false); setNewPlaylist({ title: "", description: "", is_public: true }); toast.success("Плейлист создан!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const deletePlaylistMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("playlists").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["my-playlists"] }); toast.success("Плейлист удалён"); },
  });

  const removeBookmarkMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("bookmarks").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["my-bookmarks"] }); toast.success("Закладка удалена"); },
  });

  const clearHistoryMutation = useMutation({
    mutationFn: async (type: "view" | "download") => {
      if (!user?.id) return;
      const table = type === "view" ? "view_history" : "download_history";
      const { error } = await supabase.from(table).delete().eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: (_, type) => { queryClient.invalidateQueries({ queryKey: [type === "view" ? "view-history" : "download-history"] }); toast.success("История очищена"); },
  });

  const deleteSavedMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("saved_answers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-answers"] });
      setSelectedSavedId(null);
      toast.success("Ответ удалён");
    },
  });

  const deleteSavedSearchMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("saved_searches" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["saved-searches"] }); toast.success("Поиск удалён"); },
  });

  const deleteSavedMontageMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("saved_montages" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["saved-montages"] }); toast.success("Монтаж удалён"); },
  });

  const deleteMomentBookmarkMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("moment_bookmarks" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["moment-bookmarks"] }); toast.success("Закладка удалена"); },
  });

  const handleRevalidate = async () => {
    if (!selectedSaved || !user || revalidating) return;
    setRevalidating(true);
    console.log("[analytics] answer_revalidated");

    try {
      // Check if evidence sources still exist
      const sourceIds = selectedEvidence
        .map((e: any) => e.source_id)
        .filter(Boolean);

      let newStatus = "VALID";
      if (sourceIds.length > 0) {
        const { data: existingContent } = await supabase
          .from("content_items")
          .select("id")
          .in("id", sourceIds);

        const existingIds = new Set((existingContent || []).map((c: any) => c.id));
        const missingCount = sourceIds.filter((id: string) => !existingIds.has(id)).length;

        if (missingCount === sourceIds.length) {
          newStatus = "FAILED";
        } else if (missingCount > 0) {
          newStatus = "PARTIALLY_INACCESSIBLE";
        }
      }

      await supabase
        .from("saved_answers")
        .update({
          validation_status: newStatus,
          last_validated_at: new Date().toISOString(),
        })
        .eq("id", selectedSaved.id);

      queryClient.invalidateQueries({ queryKey: ["saved-answers"] });
      toast.success("Валидация завершена");
    } catch {
      toast.error("Ошибка валидации");
    } finally {
      setRevalidating(false);
    }
  };

  const filteredPlaylists = playlists.filter((p: any) => p.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <PageTransition>
      <div className="p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Библиотека</h1>
          <p className="text-sm text-muted-foreground">Плейлисты, закладки, поиски, монтажи и история</p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="playlists" className="gap-1.5"><ListVideo className="h-3.5 w-3.5" /> Плейлисты</TabsTrigger>
            <TabsTrigger value="bookmarks" className="gap-1.5"><Bookmark className="h-3.5 w-3.5" /> Закладки</TabsTrigger>
            <TabsTrigger value="saved-answers" className="gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Ответы</TabsTrigger>
            <TabsTrigger value="saved-searches" className="gap-1.5"><SearchCheck className="h-3.5 w-3.5" /> Поиски</TabsTrigger>
            <TabsTrigger value="saved-montages" className="gap-1.5"><Scissors className="h-3.5 w-3.5" /> Монтажи</TabsTrigger>
            <TabsTrigger value="moment-bookmarks" className="gap-1.5"><Film className="h-3.5 w-3.5" /> Моменты</TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5"><History className="h-3.5 w-3.5" /> Просмотры</TabsTrigger>
            <TabsTrigger value="downloads" className="gap-1.5"><Download className="h-3.5 w-3.5" /> Загрузки</TabsTrigger>
          </TabsList>

          {/* PLAYLISTS */}
          <TabsContent value="playlists" className="space-y-4 mt-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Поиск плейлистов..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 text-sm" />
              </div>
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-3.5 w-3.5 mr-1.5" /> Создать</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Новый плейлист</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs font-medium mb-1.5 block">Название *</Label>
                      <Input value={newPlaylist.title} onChange={(e) => setNewPlaylist((p) => ({ ...p, title: e.target.value }))} placeholder="Мой плейлист" className="text-sm" maxLength={100} />
                    </div>
                    <div>
                      <Label className="text-xs font-medium mb-1.5 block">Описание</Label>
                      <Textarea value={newPlaylist.description} onChange={(e) => setNewPlaylist((p) => ({ ...p, description: e.target.value }))} placeholder="Опишите плейлист..." className="text-sm min-h-[80px]" maxLength={500} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">Публичный</p>
                        <p className="text-xs text-muted-foreground">Другие пользователи смогут его видеть</p>
                      </div>
                      <Switch checked={newPlaylist.is_public} onCheckedChange={(v) => setNewPlaylist((p) => ({ ...p, is_public: v }))} />
                    </div>
                    <Button className="w-full" onClick={() => createPlaylistMutation.mutate()} disabled={!newPlaylist.title.trim() || createPlaylistMutation.isPending}>Создать плейлист</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {playlistsLoading ? (
              <div className="text-center py-16 text-muted-foreground text-sm">Загрузка...</div>
            ) : filteredPlaylists.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <FolderOpen className="h-12 w-12 text-muted-foreground/40 mx-auto" />
                <p className="text-sm text-muted-foreground">Нет плейлистов</p>
                <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}><Plus className="h-3.5 w-3.5 mr-1.5" /> Создать первый</Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPlaylists.map((pl: any) => (
                  <motion.div key={pl.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="group rounded-xl border border-border bg-card overflow-hidden hover:border-primary/30 hover:shadow-lg transition-all cursor-pointer">
                    <div className="aspect-video bg-muted relative flex items-center justify-center">
                      {pl.thumbnail ? <img src={pl.thumbnail} alt="" className="w-full h-full object-cover" /> : <ListVideo className="h-10 w-10 text-muted-foreground/30" />}
                      <Badge className="absolute top-2 right-2 text-[9px] bg-black/60 text-white border-0">{(playlistCounts as any)[pl.id] || 0} видео</Badge>
                      <div className="absolute top-2 left-2">
                        {pl.is_public ? <Globe className="h-3.5 w-3.5 text-white/80 drop-shadow" /> : <Lock className="h-3.5 w-3.5 text-white/80 drop-shadow" />}
                      </div>
                    </div>
                    <div className="p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground truncate flex-1">{pl.title}</h3>
                        <button onClick={(e) => { e.stopPropagation(); deletePlaylistMutation.mutate(pl.id); }}
                          className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {pl.description && <p className="text-xs text-muted-foreground line-clamp-1">{pl.description}</p>}
                      <p className="text-[11px] text-muted-foreground/60">{formatDate(pl.updated_at)}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* BOOKMARKS */}
          <TabsContent value="bookmarks" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">{bookmarks.length} закладок</p>

            {bookmarksLoading ? (
              <div className="text-center py-16 text-muted-foreground text-sm">Загрузка...</div>
            ) : bookmarks.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <Bookmark className="h-12 w-12 text-muted-foreground/40 mx-auto" />
                <p className="text-sm text-muted-foreground">Закладок пока нет</p>
                <p className="text-xs text-muted-foreground">Добавляйте контент в закладки, чтобы не потерять</p>
              </div>
            ) : (
              <div className="space-y-2">
                {bookmarks.map((item: any) => (
                  <div key={item.id}
                    onClick={() => item.content_items?.id && navigate(`/product/${item.content_items.id}`)}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:border-primary/30 transition-all cursor-pointer group">
                    <div className="w-28 h-16 rounded-md overflow-hidden bg-muted shrink-0">
                      {item.content_items?.thumbnail ? <img src={item.content_items.thumbnail} alt="" className="w-full h-full object-cover" /> :
                        <div className="w-full h-full flex items-center justify-center"><Bookmark className="h-5 w-5 text-muted-foreground/30" /></div>}
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="text-sm font-medium text-foreground truncate">{item.content_items?.title || "Удалённый контент"}</p>
                      <p className="text-xs text-muted-foreground">{item.content_items?.creator_name}</p>
                      <p className="text-[11px] text-muted-foreground/60">{formatDate(item.created_at)}</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); removeBookmarkMutation.mutate(item.id); }}
                      className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* SAVED ANSWERS */}
          <TabsContent value="saved-answers" className="space-y-4 mt-4">
            {selectedSavedId && selectedSaved ? (
              /* Detail view */
              <div className="space-y-4">
                <button
                  onClick={() => { setSelectedSavedId(null); setSavedTypeFilter("all"); }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← Назад к списку
                </button>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Вопрос</p>
                  <h2 className="text-lg font-semibold text-foreground">{selectedSaved.question_text}</h2>
                </div>

                {/* Validation status */}
                <div className="flex items-center gap-3">
                  {(() => {
                    const meta = VALIDATION_STATUS_META[selectedSaved.validation_status] || VALIDATION_STATUS_META.VALID;
                    const StatusIcon = meta.icon;
                    return (
                      <div className={cn("flex items-center gap-1.5 text-xs", meta.className)}>
                        <StatusIcon className="h-3.5 w-3.5" />
                        {meta.label}
                      </div>
                    );
                  })()}
                  <span className="text-[11px] text-muted-foreground">
                    Проверено: {formatDate(selectedSaved.last_validated_at)}
                  </span>
                  {selectedSaved.validation_status !== "VALID" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRevalidate}
                      disabled={revalidating}
                      className="h-7 text-xs"
                    >
                      <RefreshCw className={cn("h-3 w-3 mr-1", revalidating && "animate-spin")} />
                      {revalidating ? "Проверка…" : "Перепроверить"}
                    </Button>
                  )}
                </div>

                {/* Answer */}
                <Card className="p-5 border-primary/20 bg-primary/5">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">Ответ</p>
                      <p className="text-sm text-foreground leading-relaxed">{selectedSaved.answer_text}</p>
                    </div>
                  </div>
                </Card>

                {/* Source type filters */}
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-foreground mr-2">Источники ({filteredEvidence.length})</p>
                  {SOURCE_TYPE_FILTERS.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => setSavedTypeFilter(f.value)}
                      className={cn(
                        "text-[11px] px-2 py-1 rounded-md transition-colors",
                        savedTypeFilter === f.value
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Evidence list */}
                <div className="space-y-2">
                  {filteredEvidence.map((ev: any) => {
                    const Icon = SOURCE_ICONS[ev.source_type] || FileText;
                    const conf = CONFIDENCE_STYLES[ev.confidence] || CONFIDENCE_STYLES.medium;
                    const link = ev.deep_link || (ev.source_id ? `/product/${ev.source_id}` : "#");
                    return (
                      <Card key={ev.id} className="p-4 hover:bg-muted/30 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <Link to={link} className="text-sm font-medium text-foreground hover:text-primary transition-colors line-clamp-1">
                                  {ev.title}
                                </Link>
                                <p className="text-xs text-muted-foreground">{ev.creator_name} · {ev.source_type}</p>
                              </div>
                              <Badge variant="outline" className={`shrink-0 text-[10px] ${conf.className}`}>
                                {conf.label}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 break-words">{ev.snippet}</p>
                            <Link to={link} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                              <ExternalLink className="h-3 w-3" /> Перейти к источнику
                            </Link>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                  {filteredEvidence.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">Нет источников данного типа</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => deleteSavedMutation.mutate(selectedSaved.id)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Удалить
                  </Button>
                  {selectedSaved.validation_status === "VALID" ? null : (
                    <Button size="sm" variant="outline" onClick={handleRevalidate} disabled={revalidating}>
                      <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", revalidating && "animate-spin")} />
                      Перепроверить
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              /* List view */
              <>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Поиск по ответам..." value={savedSearch} onChange={(e) => setSavedSearch(e.target.value)} className="pl-9 text-sm" />
                  </div>
                  <p className="text-sm text-muted-foreground">{filteredSaved.length} ответов</p>
                </div>

                {savedLoading ? (
                  <div className="text-center py-16 text-muted-foreground text-sm">Загрузка...</div>
                ) : filteredSaved.length === 0 ? (
                  <div className="text-center py-16 space-y-3">
                    <Sparkles className="h-12 w-12 text-muted-foreground/40 mx-auto" />
                    <p className="text-sm text-muted-foreground">Сохранённых ответов пока нет</p>
                    <p className="text-xs text-muted-foreground">Задайте вопрос в Ask и сохраните полезный ответ</p>
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/ask"><Sparkles className="h-3.5 w-3.5 mr-1.5" /> Задать вопрос</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredSaved.map((item: any) => {
                      const meta = VALIDATION_STATUS_META[item.validation_status] || VALIDATION_STATUS_META.VALID;
                      const StatusIcon = meta.icon;
                      return (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          onClick={() => {
                            setSelectedSavedId(item.id);
                            console.log("[analytics] saved_answer_opened");
                          }}
                          className="flex items-center gap-3 p-4 rounded-lg border border-border bg-card hover:border-primary/30 transition-all cursor-pointer group"
                        >
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Sparkles className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <p className="text-sm font-medium text-foreground line-clamp-1">{item.question_text}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">{item.answer_text}</p>
                            <div className="flex items-center gap-3 text-[11px]">
                              <span className={cn("flex items-center gap-1", meta.className)}>
                                <StatusIcon className="h-3 w-3" /> {meta.label}
                              </span>
                              <span className="text-muted-foreground/60">{formatDate(item.created_at)}</span>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0 group-hover:text-foreground transition-colors" />
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* VIEW HISTORY */}
          <TabsContent value="history" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{viewHistory.length} записей</p>
              {viewHistory.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => clearHistoryMutation.mutate("view")}><Trash2 className="h-3 w-3 mr-1.5" /> Очистить</Button>
              )}
            </div>

            {historyLoading ? (
              <div className="text-center py-16 text-muted-foreground text-sm">Загрузка...</div>
            ) : viewHistory.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <History className="h-12 w-12 text-muted-foreground/40 mx-auto" />
                <p className="text-sm text-muted-foreground">История просмотров пуста</p>
              </div>
            ) : (
              <div className="space-y-2">
                {viewHistory.map((item: any) => (
                  <div key={item.id} onClick={() => item.content_items?.id && navigate(`/product/${item.content_items.id}`)}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:border-primary/30 transition-all cursor-pointer">
                    <div className="w-28 h-16 rounded-md overflow-hidden bg-muted shrink-0">
                      {item.content_items?.thumbnail ? <img src={item.content_items.thumbnail} alt="" className="w-full h-full object-cover" /> :
                        <div className="w-full h-full flex items-center justify-center"><Play className="h-5 w-5 text-muted-foreground/30" /></div>}
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="text-sm font-medium text-foreground truncate">{item.content_items?.title || "Удалённый контент"}</p>
                      <p className="text-xs text-muted-foreground">{item.content_items?.creator_name}</p>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground/60">
                        {item.watched_seconds > 0 && item.total_seconds > 0 && (
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{Math.round((item.watched_seconds / item.total_seconds) * 100)}% просмотрено</span>
                        )}
                        <span>{formatDate(item.viewed_at)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* DOWNLOAD HISTORY */}
          <TabsContent value="downloads" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{downloadHistory.length} загрузок</p>
              {downloadHistory.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => clearHistoryMutation.mutate("download")}><Trash2 className="h-3 w-3 mr-1.5" /> Очистить</Button>
              )}
            </div>

            {downloadsLoading ? (
              <div className="text-center py-16 text-muted-foreground text-sm">Загрузка...</div>
            ) : downloadHistory.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <Download className="h-12 w-12 text-muted-foreground/40 mx-auto" />
                <p className="text-sm text-muted-foreground">История загрузок пуста</p>
              </div>
            ) : (
              <div className="space-y-2">
                {downloadHistory.map((item: any) => (
                  <div key={item.id} onClick={() => item.content_items?.id && navigate(`/product/${item.content_items.id}`)}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:border-primary/30 transition-all cursor-pointer">
                    <div className="w-28 h-16 rounded-md overflow-hidden bg-muted shrink-0">
                      {item.content_items?.thumbnail ? <img src={item.content_items.thumbnail} alt="" className="w-full h-full object-cover" /> :
                        <div className="w-full h-full flex items-center justify-center"><Download className="h-5 w-5 text-muted-foreground/30" /></div>}
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="text-sm font-medium text-foreground truncate">{item.content_items?.title || "Удалённый контент"}</p>
                      <p className="text-xs text-muted-foreground">{item.content_items?.creator_name}</p>
                      <p className="text-[11px] text-muted-foreground/60">{formatDate(item.downloaded_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* SAVED SEARCHES */}
          <TabsContent value="saved-searches" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">{savedSearches.length} сохранённых поисков</p>
            {savedSearchesLoading ? (
              <div className="text-center py-16 text-muted-foreground text-sm">Загрузка...</div>
            ) : savedSearches.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <SearchCheck className="h-12 w-12 text-muted-foreground/40 mx-auto" />
                <p className="text-sm text-muted-foreground">Нет сохранённых поисков</p>
                <p className="text-xs text-muted-foreground">Сохраняйте поисковые запросы на странице результатов</p>
              </div>
            ) : (
              <div className="space-y-2">
                {savedSearches.map((item: any) => (
                  <div
                    key={item.id}
                    onClick={() => item.query_id ? navigate(`/search/results/${item.query_id}`) : undefined}
                    className="flex items-center gap-3 p-4 rounded-lg border border-border bg-card hover:border-primary/30 transition-all cursor-pointer group"
                  >
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Search className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="text-sm font-medium text-foreground truncate">
                        {item.label || item.query_text}
                      </p>
                      {item.label && (
                        <p className="text-xs text-muted-foreground truncate">«{item.query_text}»</p>
                      )}
                      <p className="text-[11px] text-muted-foreground/60">{formatDate(item.created_at)}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSavedSearchMutation.mutate(item.id); }}
                      className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* SAVED MONTAGES */}
          <TabsContent value="saved-montages" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">{savedMontages.length} сохранённых монтажей</p>
            {savedMontagesLoading ? (
              <div className="text-center py-16 text-muted-foreground text-sm">Загрузка...</div>
            ) : savedMontages.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <Scissors className="h-12 w-12 text-muted-foreground/40 mx-auto" />
                <p className="text-sm text-muted-foreground">Нет сохранённых монтажей</p>
                <p className="text-xs text-muted-foreground">Создайте и сохраните монтаж из результатов поиска</p>
              </div>
            ) : (
              <div className="space-y-2">
                {savedMontages.map((item: any) => {
                  const segments = Array.isArray(item.segments_json) ? item.segments_json : [];
                  return (
                    <div
                      key={item.id}
                      onClick={() => item.montage_id ? navigate(`/montage/${item.montage_id}`) : undefined}
                      className="flex items-center gap-3 p-4 rounded-lg border border-border bg-card hover:border-primary/30 transition-all cursor-pointer group"
                    >
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Film className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <p className="text-sm font-medium text-foreground truncate">
                          {item.label || `Монтаж · ${segments.length} сегментов`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Цель: {item.target_duration_sec}с · Контекст: {item.lead_in_seconds}с
                        </p>
                        <p className="text-[11px] text-muted-foreground/60">{formatDate(item.created_at)}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteSavedMontageMutation.mutate(item.id); }}
                        className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* MOMENT BOOKMARKS */}
          <TabsContent value="moment-bookmarks" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">{momentBookmarks.length} сохранённых моментов</p>
            {momentBookmarksLoading ? (
              <div className="text-center py-16 text-muted-foreground text-sm">Загрузка...</div>
            ) : momentBookmarks.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <Film className="h-12 w-12 text-muted-foreground/40 mx-auto" />
                <p className="text-sm text-muted-foreground">Нет сохранённых моментов</p>
                <p className="text-xs text-muted-foreground">Добавляйте моменты в закладки из результатов поиска</p>
              </div>
            ) : (
              <div className="space-y-2">
                {momentBookmarks.map((item: any) => (
                  <div
                    key={item.id}
                    onClick={() => navigate(`/product/${item.video_id}?t=${Math.floor(item.start_sec)}`)}
                    className="flex items-center gap-3 p-4 rounded-lg border border-border bg-card hover:border-primary/30 transition-all cursor-pointer group"
                  >
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Play className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="text-sm font-medium text-foreground truncate">
                        {item.video_title || "Видео"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.creator_name ? `${item.creator_name} · ` : ""}
                        {Math.floor(item.start_sec / 60)}:{String(Math.floor(item.start_sec % 60)).padStart(2, "0")} — {Math.floor(item.end_sec / 60)}:{String(Math.floor(item.end_sec % 60)).padStart(2, "0")}
                      </p>
                      {item.note && <p className="text-xs text-muted-foreground/80 truncate">{item.note}</p>}
                      <p className="text-[11px] text-muted-foreground/60">{formatDate(item.created_at)}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteMomentBookmarkMutation.mutate(item.id); }}
                      className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PageTransition>
  );
};

export default Library;
