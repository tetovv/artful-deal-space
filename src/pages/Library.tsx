import { useState } from "react";
import {
  ListVideo, History, Download, Plus, Trash2, Bookmark,
  Search, FolderOpen, Globe, Lock, Play, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PageTransition } from "@/components/layout/PageTransition";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

const formatDate = (d: string) => {
  try { return format(new Date(d), "d MMM yyyy, HH:mm", { locale: ru }); } catch { return d; }
};

const Library = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("playlists");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newPlaylist, setNewPlaylist] = useState({ title: "", description: "", is_public: true });

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

  const filteredPlaylists = playlists.filter((p: any) => p.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <PageTransition>
      <div className="p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Библиотека</h1>
          <p className="text-sm text-muted-foreground">Плейлисты, закладки, история просмотров и загрузок</p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="playlists" className="gap-1.5"><ListVideo className="h-3.5 w-3.5" /> Плейлисты</TabsTrigger>
            <TabsTrigger value="bookmarks" className="gap-1.5"><Bookmark className="h-3.5 w-3.5" /> Закладки</TabsTrigger>
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
        </Tabs>
      </div>
    </PageTransition>
  );
};

export default Library;
