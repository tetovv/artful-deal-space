import { useState, useEffect } from "react";
import { Lock, ArrowRight, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    // Check for recovery type in URL hash
    const hash = window.location.hash;
    if (!hash.includes("type=recovery")) {
      // If not a recovery link, redirect
      navigate("/auth", { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Пароли не совпадают");
      return;
    }
    if (password.length < 6) {
      setError("Минимум 6 символов");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
    } else {
      setDone(true);
      setTimeout(() => navigate("/"), 2000);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6 animate-fade-in">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold gradient-text">MediaOS</h1>
          <p className="text-sm text-muted-foreground">Установите новый пароль</p>
        </div>

        {done ? (
          <div className="space-y-4 text-center">
            <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center mx-auto">
              <Check className="h-5 w-5 text-success" />
            </div>
            <p className="text-sm text-foreground">Пароль обновлён! Перенаправляем...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input type="password" placeholder="Новый пароль" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9" required minLength={6} />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input type="password" placeholder="Подтвердите пароль" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="pl-9" required minLength={6} />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Обновление..." : "Обновить пароль"}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
