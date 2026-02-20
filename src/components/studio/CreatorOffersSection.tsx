import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Edit, Save, X, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const OFFER_TYPES = [
  { value: "video_integration", label: "Видео-интеграция" },
  { value: "preroll", label: "Преролл" },
  { value: "post", label: "Пост" },
  { value: "stories", label: "Stories" },
  { value: "podcast_mention", label: "Упоминание в подкасте" },
  { value: "review", label: "Обзор" },
  { value: "custom", label: "Индивидуальное" },
];

const OFFER_TYPE_LABELS: Record<string, string> = Object.fromEntries(OFFER_TYPES.map((t) => [t.value, t.label]));

export function CreatorOffersSection() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: offers = [], isLoading } = useQuery({
    queryKey: ["my_offers", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("creator_offers")
        .select("*")
        .eq("creator_id", user.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ offer_type: "video_integration", price: "", turnaround_days: "7" });

  const addOffer = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not auth");
      const { error } = await supabase.from("creator_offers").insert({
        creator_id: user.id,
        offer_type: form.offer_type,
        price: parseInt(form.price) || 0,
        turnaround_days: parseInt(form.turnaround_days) || 7,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my_offers"] });
      setShowAdd(false);
      setForm({ offer_type: "video_integration", price: "", turnaround_days: "7" });
      toast.success("Оффер добавлен");
    },
    onError: () => toast.error("Ошибка при добавлении"),
  });

  const updateOffer = useMutation({
    mutationFn: async (params: { id: string; price: number; turnaround_days: number; is_active: boolean }) => {
      const { error } = await supabase.from("creator_offers")
        .update({ price: params.price, turnaround_days: params.turnaround_days, is_active: params.is_active })
        .eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my_offers"] });
      setEditingId(null);
      toast.success("Оффер обновлён");
    },
  });

  const deleteOffer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("creator_offers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my_offers"] });
      toast.success("Оффер удалён");
    },
  });

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Мои офферы</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Настройте типы размещений и цены для рекламодателей</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)} disabled={showAdd}>
          <Plus className="h-4 w-4 mr-1.5" /> Добавить оффер
        </Button>
      </div>

      {/* Add form */}
      {showAdd && (
        <Card className="border-primary/30">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-semibold text-foreground">Новый оффер</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Тип размещения</label>
                <Select value={form.offer_type} onValueChange={(v) => setForm({ ...form, offer_type: v })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OFFER_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Цена, ₽</label>
                <Input type="number" placeholder="10000" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="h-9" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Срок, дней</label>
                <Input type="number" placeholder="7" value={form.turnaround_days} onChange={(e) => setForm({ ...form, turnaround_days: e.target.value })} className="h-9" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => addOffer.mutate()} disabled={addOffer.isPending || !form.price}>
                <Save className="h-3.5 w-3.5 mr-1" /> {addOffer.isPending ? "Сохранение…" : "Сохранить"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
                <X className="h-3.5 w-3.5 mr-1" /> Отмена
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Offers list */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Загрузка…</p>
      ) : offers.length === 0 && !showAdd ? (
        <div className="text-center py-12 space-y-3">
          <Package className="h-10 w-10 text-muted-foreground/40 mx-auto" />
          <p className="text-sm text-muted-foreground">У вас пока нет офферов</p>
          <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-1" /> Создать первый оффер
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {offers.map((offer) => (
            <OfferRow
              key={offer.id}
              offer={offer}
              editing={editingId === offer.id}
              onEdit={() => setEditingId(offer.id)}
              onCancel={() => setEditingId(null)}
              onSave={(price, days, active) => updateOffer.mutate({ id: offer.id, price, turnaround_days: days, is_active: active })}
              onDelete={() => deleteOffer.mutate(offer.id)}
              saving={updateOffer.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OfferRow({ offer, editing, onEdit, onCancel, onSave, onDelete, saving }: {
  offer: any; editing: boolean; onEdit: () => void; onCancel: () => void;
  onSave: (price: number, days: number, active: boolean) => void; onDelete: () => void; saving: boolean;
}) {
  const [price, setPrice] = useState(String(offer.price));
  const [days, setDays] = useState(String(offer.turnaround_days));
  const [active, setActive] = useState(offer.is_active);

  if (editing) {
    return (
      <Card className="border-primary/30">
        <CardContent className="p-3 flex items-center gap-3">
          <span className="text-sm font-medium text-foreground w-40 shrink-0">{OFFER_TYPE_LABELS[offer.offer_type] || offer.offer_type}</span>
          <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="h-8 w-28" />
          <span className="text-xs text-muted-foreground">₽</span>
          <Input type="number" value={days} onChange={(e) => setDays(e.target.value)} className="h-8 w-20" />
          <span className="text-xs text-muted-foreground">дней</span>
          <Switch checked={active} onCheckedChange={setActive} />
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onSave(parseInt(price) || 0, parseInt(days) || 7, active)} disabled={saving}>
            <Save className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onCancel}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(!offer.is_active && "opacity-50")}>
      <CardContent className="p-3 flex items-center gap-3">
        <span className="text-sm font-medium text-foreground flex-1">{OFFER_TYPE_LABELS[offer.offer_type] || offer.offer_type}</span>
        <span className="text-sm font-bold text-foreground">{offer.price.toLocaleString()} ₽</span>
        <span className="text-xs text-muted-foreground">{offer.turnaround_days} дн.</span>
        <Badge variant="outline" className={cn("text-[10px]", offer.is_active ? "text-success border-success/30" : "text-muted-foreground")}>
          {offer.is_active ? "Активен" : "Выкл"}
        </Badge>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onEdit}><Edit className="h-3.5 w-3.5" /></Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
      </CardContent>
    </Card>
  );
}
