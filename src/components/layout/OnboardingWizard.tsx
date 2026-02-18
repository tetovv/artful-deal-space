import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Compass, Palette, Megaphone, Sparkles, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OnboardingWizardProps {
  onComplete: (selectedRole: string, interests: string[]) => void;
}

const roles = [
  { id: "user", label: "Зритель / Покупатель", desc: "Ищу контент, покупаю, подписываюсь", icon: Compass, color: "text-primary" },
  { id: "creator", label: "Автор контента", desc: "Создаю и монетизирую контент", icon: Palette, color: "text-accent" },
  { id: "advertiser", label: "Рекламодатель", desc: "Размещаю рекламу у авторов", icon: Megaphone, color: "text-warning" },
];

const interestOptions = [
  "Видео", "Музыка", "Подкасты", "Книги", "Шаблоны", "Дизайн", "Технологии", "Бизнес", "Образование", "Развлечения",
];

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [selectedRole, setSelectedRole] = useState("");
  const [interests, setInterests] = useState<string[]>([]);

  const toggleInterest = (i: string) => {
    setInterests((prev) => prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg"
      >
        {/* Progress */}
        <div className="flex gap-2 mb-8 justify-center">
          {[0, 1, 2].map((s) => (
            <div key={s} className={cn("h-1.5 w-12 rounded-full transition-colors", s <= step ? "bg-primary" : "bg-muted")} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="welcome" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="text-center space-y-6">
              <Sparkles className="h-12 w-12 text-primary mx-auto" />
              <h1 className="text-3xl font-bold">Добро пожаловать в <span className="gradient-text">MediaOS</span></h1>
              <p className="text-muted-foreground">Единая экосистема для авторов, зрителей и рекламодателей. Настроим платформу под вас за 30 секунд.</p>
              <Button onClick={() => setStep(1)} size="lg" className="gap-2">
                Начать <ArrowRight className="h-4 w-4" />
              </Button>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="role" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold">Кто вы?</h2>
                <p className="text-sm text-muted-foreground mt-1">Выберите основную роль (можно изменить позже)</p>
              </div>
              <div className="space-y-3">
                {roles.map((role) => (
                  <button
                    key={role.id}
                    onClick={() => setSelectedRole(role.id)}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 text-left",
                      selectedRole === role.id
                        ? "border-primary bg-primary/5 shadow-md"
                        : "border-border hover:border-primary/30 bg-card"
                    )}
                  >
                    <div className={cn("h-10 w-10 rounded-lg bg-muted flex items-center justify-center", role.color)}>
                      <role.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{role.label}</p>
                      <p className="text-xs text-muted-foreground">{role.desc}</p>
                    </div>
                    {selectedRole === role.id && <Check className="h-5 w-5 text-primary" />}
                  </button>
                ))}
              </div>
              <Button onClick={() => setStep(2)} disabled={!selectedRole} className="w-full gap-2">
                Далее <ArrowRight className="h-4 w-4" />
              </Button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="interests" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold">Ваши интересы</h2>
                <p className="text-sm text-muted-foreground mt-1">Выберите темы для персональных рекомендаций</p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {interestOptions.map((interest) => (
                  <button
                    key={interest}
                    onClick={() => toggleInterest(interest)}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200",
                      interests.includes(interest)
                        ? "bg-primary text-primary-foreground border-primary shadow-md"
                        : "bg-card text-muted-foreground border-border hover:border-primary/40"
                    )}
                  >
                    {interest}
                  </button>
                ))}
              </div>
              <Button onClick={() => onComplete(selectedRole, interests)} className="w-full gap-2">
                <Sparkles className="h-4 w-4" /> Готово — перейти в MediaOS
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
