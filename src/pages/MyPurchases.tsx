import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { PageTransition } from "@/components/layout/PageTransition";
import { motion } from "framer-motion";
import { ShoppingBag, ExternalLink, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.06 } } },
  item: { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } },
};

const MyPurchases = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ["my-purchases", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: purchaseRows } = await supabase
        .from("purchases")
        .select("id, created_at, content_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!purchaseRows || purchaseRows.length === 0) return [];

      const contentIds = purchaseRows.map((p: any) => p.content_id);
      const { data: contentItems } = await supabase
        .from("content_items")
        .select("*")
        .in("id", contentIds);

      return purchaseRows.map((p: any) => ({
        ...p,
        content: (contentItems || []).find((c: any) => c.id === p.content_id),
      }));
    },
    enabled: !!user,
  });

  return (
    <PageTransition>
      <div className="p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <ShoppingBag className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Мои покупки</h1>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Загрузка...</div>
        ) : purchases.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">У вас пока нет покупок</p>
            <Button variant="outline" onClick={() => navigate("/explore")}>
              Перейти в каталог
            </Button>
          </div>
        ) : (
          <motion.div variants={stagger.container} initial="hidden" animate="show" className="space-y-3">
            {purchases.map((p: any) => (
              <motion.div
                key={p.id}
                variants={stagger.item}
                className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:shadow-lg hover:border-primary/20 transition-all duration-300"
              >
                {/* Thumbnail */}
                <div className="h-16 w-24 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                  {p.content?.thumbnail ? (
                    <img src={p.content.thumbnail} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ShoppingBag className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{p.content?.title || "Контент"}</p>
                  <p className="text-xs text-muted-foreground">{p.content?.type || "—"} • {p.content?.creator_name || ""}</p>
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {new Date(p.created_at).toLocaleDateString("ru-RU")}
                  </div>
                </div>

                {/* Action */}
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 gap-1"
                  onClick={() => navigate(`/product/${p.content_id}`)}
                >
                  <ExternalLink className="h-3 w-3" />
                  Открыть
                </Button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </PageTransition>
  );
};

export default MyPurchases;
