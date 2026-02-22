import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Copy, Check, Share2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface MontageShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  montageId: string;
  existingSlug?: string | null;
}

function generateSlug() {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map(b => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 10);
}

export default function MontageShareModal({ open, onOpenChange, montageId, existingSlug }: MontageShareModalProps) {
  const { user } = useAuth();
  const [slug, setSlug] = useState<string | null>(existingSlug ?? null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = slug ? `${window.location.origin}/m/${slug}` : null;

  const handleCreate = async () => {
    if (!user) return;
    setCreating(true);
    try {
      const newSlug = generateSlug();
      const { error } = await supabase.from("montage_shares" as any).insert({
        montage_id: montageId,
        slug: newSlug,
        created_by: user.id,
      });
      if (error) throw error;
      setSlug(newSlug);
      console.log("[analytics] montage_shared");
      toast.success("Ссылка создана");
    } catch {
      toast.error("Не удалось создать ссылку");
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Скопировано");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4" /> Поделиться монтажом
          </DialogTitle>
          <DialogDescription>
            Получатели с доступом к контенту увидят все сегменты. Недоступные сегменты будут заблокированы.
          </DialogDescription>
        </DialogHeader>

        {!slug ? (
          <Button onClick={handleCreate} disabled={creating} className="w-full">
            {creating ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Создание…</>
            ) : (
              "Создать ссылку для просмотра"
            )}
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input value={shareUrl ?? ""} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Ссылка доступна авторизованным пользователям. Платный контент виден только тем, кто имеет доступ.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
