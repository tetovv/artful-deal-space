import { ContentItem } from "@/types";
import { contentTypeLabels } from "@/data/mockData";
import { Eye, Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

export function ContentCard({ item }: { item: ContentItem }) {
  const navigate = useNavigate();

  return (
    <motion.div
      onClick={() => navigate(`/product/${item.id}`)}
      className="group cursor-pointer rounded-xl border border-border bg-card overflow-hidden hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="relative aspect-video overflow-hidden">
        <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        <Badge className="absolute top-3 left-3 bg-card/90 text-card-foreground text-[10px] backdrop-blur-sm border-0">
          {contentTypeLabels[item.type] || item.type}
        </Badge>
        {item.price === null && (
          <Badge className="absolute top-3 right-3 bg-success text-success-foreground text-[10px] border-0">
            Бесплатно
          </Badge>
        )}
      </div>
      <div className="p-4 space-y-2">
        <h3 className="font-semibold text-sm text-card-foreground line-clamp-2 group-hover:text-primary transition-colors">{item.title}</h3>
        <div className="flex items-center gap-2">
          <img src={item.creatorAvatar} alt="" className="h-5 w-5 rounded-full" />
          <span className="text-xs text-muted-foreground">{item.creatorName}</span>
        </div>
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{(item.views / 1000).toFixed(1)}k</span>
            <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{item.likes}</span>
          </div>
          {item.price !== null && (
            <span className="text-sm font-bold text-primary">{item.price.toLocaleString()} ₽</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
