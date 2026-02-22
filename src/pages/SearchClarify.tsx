import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Film, Loader2, SkipForward } from "lucide-react";
import { toast } from "sonner";

interface ClarificationOption {
  value: string;
  label: string;
}

interface ClarificationQuestion {
  id: string;
  text: string;
  reason: string;
  options: ClarificationOption[];
  defaultValue: string;
}

export default function SearchClarify() {
  const { queryId } = useParams<{ queryId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [questions, setQuestions] = useState<ClarificationQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [queryText, setQueryText] = useState("");

  // Log view
  useEffect(() => {
    console.log("[analytics] meaning_search_clarification_shown");
  }, []);

  // Load query + questions
  useEffect(() => {
    if (!queryId || !user) return;
    (async () => {
      try {
        const session = (await supabase.auth.getSession()).data.session;
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/video-meaning-search/${queryId}`,
          {
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              ...(session?.access_token
                ? { Authorization: `Bearer ${session.access_token}` }
                : {}),
            },
          },
        );
        if (!res.ok) throw new Error();
        const data = await res.json();
        setQueryText(data.query?.query_text || "");
        const qs: ClarificationQuestion[] =
          data.query?.clarification_questions || [];
        setQuestions(qs);
        // Pre-fill defaults
        const defaults: Record<string, string> = {};
        qs.forEach((q: ClarificationQuestion) => {
          defaults[q.id] = q.defaultValue;
        });
        setAnswers(defaults);
      } catch {
        toast.error("Не удалось загрузить вопросы");
      } finally {
        setLoading(false);
      }
    })();
  }, [queryId, user]);

  const handleSubmit = async (skipAll = false) => {
    if (!queryId || !user) return;
    setSubmitting(true);

    const finalAnswers = skipAll
      ? Object.fromEntries(questions.map((q) => [q.id, q.defaultValue]))
      : answers;

    console.log("[analytics] meaning_search_clarification_answered", {
      skipped: skipAll,
    });

    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/video-meaning-search/clarify`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            ...(session?.access_token
              ? { Authorization: `Bearer ${session.access_token}` }
              : {}),
          },
          body: JSON.stringify({
            queryId,
            answersJson: finalAnswers,
          }),
        },
      );
      if (!res.ok) throw new Error();
      navigate(`/search/results/${queryId}`, { replace: true });
    } catch {
      toast.error("Ошибка при отправке");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Film className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Уточним запрос
          </h1>
          <p className="text-sm text-muted-foreground line-clamp-1">
            «{queryText}»
          </p>
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-5">
        {questions.map((q) => (
          <Card key={q.id} className="p-5 space-y-3">
            <div>
              <p className="text-base font-medium text-foreground">{q.text}</p>
              <p className="text-sm text-muted-foreground mt-1">{q.reason}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {q.options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() =>
                    setAnswers((prev) => ({ ...prev, [q.id]: opt.value }))
                  }
                  className={`px-4 py-2 rounded-full border text-sm transition-colors ${
                    answers[q.id] === opt.value
                      ? "border-primary bg-primary/5 text-primary font-medium"
                      : "border-border text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 pt-2">
        <Button
          className="w-full h-12 text-base"
          onClick={() => handleSubmit(false)}
          disabled={submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Ищем…
            </>
          ) : (
            "Продолжить"
          )}
        </Button>

        <Button
          variant="ghost"
          className="w-full text-muted-foreground"
          onClick={() => handleSubmit(true)}
          disabled={submitting}
        >
          <SkipForward className="h-4 w-4 mr-2" />
          Пропустить
        </Button>
      </div>
    </div>
  );
}
