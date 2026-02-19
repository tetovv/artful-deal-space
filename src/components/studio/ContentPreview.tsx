import { Eye, Heart, User, X, ThumbsUp, MessageCircle, Share2, Music, Mic, BookOpen, Layout, FileText, Video } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface PreviewData {
  title: string;
  description: string;
  thumbnail?: string;
  tags: string[];
  price?: number | null;
  monetization_type: string;
  creatorName: string;
  creatorAvatar: string;
  type: string;
}

interface ContentPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: PreviewData;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  video: Video, post: FileText, music: Music, podcast: Mic, book: BookOpen, template: Layout,
};

const TYPE_LABELS: Record<string, string> = {
  video: "Видео", post: "Пост", music: "Музыка", podcast: "Подкаст", book: "Книга", template: "Шаблон",
};

export function ContentPreview({ open, onOpenChange, data }: ContentPreviewProps) {
  const Icon = TYPE_ICONS[data.type] || FileText;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            Предпросмотр · {TYPE_LABELS[data.type] || data.type}
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 pb-5">
          <p className="text-[11px] text-muted-foreground mb-3">Так карточка будет выглядеть для пользователей</p>

          {/* Card preview */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            {data.type === "post" ? (
              /* Post card preview */
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  {data.creatorAvatar ? (
                    <img src={data.creatorAvatar} alt="" className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <span className="font-medium text-sm text-card-foreground">{data.creatorName || "Автор"}</span>
                </div>
                <p className="text-sm text-card-foreground whitespace-pre-wrap line-clamp-4">
                  {data.description || data.title}
                </p>
                {data.thumbnail && (
                  <img src={data.thumbnail} alt="" className="w-full rounded-lg max-h-48 object-cover" />
                )}
                <div className="flex items-center gap-4 pt-1">
                  <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
                    <ThumbsUp className="h-4 w-4" />
                  </span>
                  <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
                    <MessageCircle className="h-4 w-4" /> 0
                  </span>
                  <span className="text-muted-foreground"><Share2 className="h-4 w-4" /></span>
                </div>
              </div>
            ) : (
              /* Standard media card preview */
              <>
                <div className="relative aspect-video overflow-hidden bg-muted">
                  {data.thumbnail ? (
                    <img src={data.thumbnail} alt={data.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Icon className="h-12 w-12 text-muted-foreground/30" />
                    </div>
                  )}
                  {data.type === "video" && (
                    <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">0:00</span>
                  )}
                </div>
                <div className="p-4 space-y-2">
                  <h3 className="font-semibold text-sm text-card-foreground line-clamp-2">{data.title || "Без названия"}</h3>
                  <div className="flex items-center gap-2">
                    {data.creatorAvatar ? (
                      <img src={data.creatorAvatar} alt="" className="h-5 w-5 rounded-full object-cover" />
                    ) : (
                      <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-3 w-3 text-muted-foreground" />
                      </div>
                    )}
                    <span className="text-xs text-muted-foreground">{data.creatorName || "Автор"}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" />0</span>
                      <span className="flex items-center gap-1"><Heart className="h-3 w-3" />0</span>
                    </div>
                    {data.monetization_type === "paid" && data.price ? (
                      <span className="text-sm font-bold text-primary">{data.price.toLocaleString()} ₽</span>
                    ) : null}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Tags */}
          {data.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {data.tags.map(t => (
                <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
