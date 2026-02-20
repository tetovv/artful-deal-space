import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Copy, Crown, Calendar, Hash, Percent } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export function PromoCodesSection() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState(generateCode());
  const [discount, setDiscount] = useState(10);
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const { data: promos = [], isLoading } = useQuery({
    queryKey: ["promo-codes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promo_codes")
        .select("*")
        .eq("creator_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const createPromo = useMutation({
    mutationFn: async () => {
      const trimmedCode = code.trim().toUpperCase();
      if (!trimmedCode) throw new Error("Введите код");
      if (discount < 1 || discount > 100) throw new Error("Скидка от 1 до 100%");

      const { error } = await supabase.from("promo_codes").insert({
        creator_id: user!.id,
        code: trimmedCode,
        discount_percent: discount,
        max_uses: maxUses ? parseInt(maxUses) : null,
        expires_at: expiresAt || null,
      });
      if (error) {
        if (error.code === "23505") throw new Error("Такой код уже существует");
        throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["promo-codes"] });
      toast.success("Промокод создан");
      setShowForm(false);
      setCode(generateCode());
      setDiscount(10);
      setMaxUses("");
      setExpiresAt("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("promo_codes").update({ is_active: active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["promo-codes"] }),
    onError: () => toast.error("Ошибка обновления"),
  });

  const deletePromo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("promo_codes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["promo-codes"] });
      toast.success("Промокод удалён");
    },
    onError: () => toast.error("Ошибка удаления"),
  });

  const copyCode = (c: string) => {
    navigator.clipboard.writeText(c);
    toast.success("Скопировано");
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-foreground">Промокоды</h1>
          <p className="text-sm text-muted-foreground">Создавайте скидки для вашей аудитории</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Создать
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <Card className="border-primary/20">
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Код промокода</Label>
                <div className="relative">
                  <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="MYCODE10" className="pl-8 uppercase text-sm h-9" maxLength={20} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Скидка (%)</Label>
                <div className="relative">
                  <Percent className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))}
                    min={1} max={100} className="pl-8 text-sm h-9" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Макс. использований <span className="text-muted-foreground">(пусто = ∞)</span></Label>
                <Input type="number" value={maxUses} onChange={(e) => setMaxUses(e.target.value)}
                  placeholder="Безлимит" min={1} className="text-sm h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Срок действия</Label>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
                    className="pl-8 text-sm h-9" />
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Отмена</Button>
              <Button size="sm" onClick={() => createPromo.mutate()} disabled={createPromo.isPending}>
                {createPromo.isPending ? "Создание…" : "Создать промокод"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* List */}
      {isLoading ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Загрузка…</CardContent></Card>
      ) : promos.length === 0 && !showForm ? (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Crown className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">У вас пока нет промокодов</p>
            <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Создать первый
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {promos.map((p: any) => {
            const expired = p.expires_at && new Date(p.expires_at) < new Date();
            const exhausted = p.max_uses && p.used_count >= p.max_uses;
            return (
              <Card key={p.id} className={cn(!p.is_active && "opacity-60")}>
                <CardContent className="p-4 flex items-center gap-4 flex-wrap">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-sm font-bold text-foreground tracking-wider">{p.code}</code>
                      <Badge variant="secondary" className="text-[10px]">-{p.discount_percent}%</Badge>
                      {p.is_active && !expired && !exhausted && (
                        <Badge className="bg-success/10 text-success text-[10px]">Активен</Badge>
                      )}
                      {expired && <Badge variant="destructive" className="text-[10px]">Истёк</Badge>}
                      {exhausted && <Badge variant="destructive" className="text-[10px]">Исчерпан</Badge>}
                      {!p.is_active && <Badge variant="outline" className="text-[10px]">Отключён</Badge>}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span>Использован: {p.used_count}{p.max_uses ? `/${p.max_uses}` : ""}</span>
                      {p.expires_at && (
                        <span>До: {new Date(p.expires_at).toLocaleDateString("ru-RU")}</span>
                      )}
                      <span>{new Date(p.created_at).toLocaleDateString("ru-RU")}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch checked={p.is_active} onCheckedChange={(v) => toggleActive.mutate({ id: p.id, active: v })} />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyCode(p.code)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Удалить промокод?</AlertDialogTitle>
                          <AlertDialogDescription>Промокод «{p.code}» будет удалён навсегда.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Отмена</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deletePromo.mutate(p.id)}>Удалить</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
