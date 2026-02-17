import { useState } from "react";
import { Mail, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) setSent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6 animate-fade-in">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold gradient-text">MediaOS</h1>
          <p className="text-sm text-muted-foreground">Войдите в экосистему</p>
        </div>

        {!sent ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9"
                required
              />
            </div>
            <Button type="submit" className="w-full">Получить код <ArrowRight className="h-4 w-4 ml-2" /></Button>
          </form>
        ) : (
          <div className="space-y-4 text-center">
            <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center mx-auto">
              <Mail className="h-5 w-5 text-success" />
            </div>
            <p className="text-sm text-foreground">Код отправлен на <strong>{email}</strong></p>
            <Input placeholder="Введите код" className="text-center tracking-widest" maxLength={6} />
            <Button className="w-full" onClick={() => navigate("/")}>Войти</Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Auth;
