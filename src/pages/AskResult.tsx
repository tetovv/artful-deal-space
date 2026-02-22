import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, AlertTriangle, Video, Music, FileText, BookOpen, Layout,
  ExternalLink, Clock, CheckCircle2, XCircle, Shield, BookmarkPlus, Check,
} from "lucide-react";
import { toast } from "sonner";

const SOURCE_ICONS: Record<string, React.ElementType> = {
  video: Video,
  audio: Music,
  podcast: Music,
  post: FileText,
  book: BookOpen,
  template: Layout,
};

const CONFIDENCE_STYLES: Record<string, { label: string; className: string }> = {
  high: { label: "Высокая", className: "bg-success/10 text-success border-success/20" },
  medium: { label: "Средняя", className: "bg-warning/10 text-warning border-warning/20" },
  low: { label: "Низкая", className: "bg-destructive/10 text-destructive border-destructive/20" },
};

export interface EvidenceData {
  id: string;
  source_type: string;
  source_id: string | null;
  title: string;
  creator_name: string;
  deep_link: string | null;
  snippet: string;
  confidence: string;
  sort_order: number;
}

export function EvidenceItem({ item }: { item: EvidenceData }) {
  const Icon = SOURCE_ICONS[item.source_type] || FileText;
  const conf = CONFIDENCE_STYLES[item.confidence] || CONFIDENCE_STYLES.medium;
  const link = item.deep_link || (item.source_id ? `/product/${item.source_id}` : "#");

  return (
    <Card className="p-4 hover:bg-muted/30 transition-colors">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                to={link}
                className="text-sm font-medium text-foreground hover:text-primary transition-colors line-clamp-1"
              >
                {item.title}
              </Link>
              <p className="text-xs text-muted-foreground">{item.creator_name} · {item.source_type}</p>
            </div>
            <Badge variant="outline" className={`shrink-0 text-[10px] ${conf.className}`}>
              {conf.label}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 break-words">
            {item.snippet}
          </p>
          <Link
            to={link}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Перейти к источнику
          </Link>
        </div>
      </div>
    </Card>
  );
}

export default function AskResult() {
  const { queryId } = useParams<{ queryId: string }>();
  const { user } = useAuth();
  const [status, setStatus] = useState<"loading" | "answered" | "insufficient" | "error">("loading");
  const [question, setQuestion] = useState("");
  const [answerText, setAnswerText] = useState("");
  const [evidence, setEvidence] = useState<EvidenceData[]>([]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!queryId || !user) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ask-answer/${queryId}`;
        const session = (await supabase.auth.getSession()).data.session;
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        };
        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`;
        }

        const qRes = await fetch(baseUrl, { headers });
        if (!qRes.ok) throw new Error("Failed to fetch query");
        const { query, result } = await qRes.json();

        if (cancelled) return;
        setQuestion(query.question);

        if (query.status === "processing") {
          setTimeout(poll, 2000);
          return;
        }

        if (query.status === "error") { setStatus("error"); return; }
        if (query.status === "insufficient") { setStatus("insufficient"); return; }

        const evRes = await fetch(`${baseUrl}/evidence`, { headers });
        const evData = await evRes.json();

        if (cancelled) return;
        if (!evData || evData.length === 0) { setStatus("insufficient"); return; }

        setEvidence(evData);
        setAnswerText(result?.answer_text || "");
        setStatus("answered");

        // Check if already saved
        const { data: existing } = await supabase
          .from("saved_answers")
          .select("id")
          .eq("query_id", queryId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (existing) setSaved(true);
      } catch {
        if (!cancelled) setStatus("error");
      }
    };

    poll();
    return () => { cancelled = true; };
  }, [queryId, user]);

  const handleSave = async () => {
    if (!user || !queryId || saving || saved) return;
    setSaving(true);
    try {
      const { data: sa, error: saErr } = await supabase
        .from("saved_answers")
        .insert({
          user_id: user.id,
          query_id: queryId,
          question_text: question,
          answer_text: answerText,
          validation_status: "VALID",
        })
        .select("id")
        .single();
      if (saErr) throw saErr;

      // Save evidence refs
      if (evidence.length > 0) {
        const refs = evidence.map((ev) => ({
          saved_answer_id: sa.id,
          source_type: ev.source_type,
          source_id: ev.source_id,
          title: ev.title,
          creator_name: ev.creator_name,
          deep_link: ev.deep_link,
          snippet: ev.snippet,
          confidence: ev.confidence,
        }));
        await supabase.from("saved_answer_evidence").insert(refs);
      }

      setSaved(true);
      console.log("[analytics] answer_saved");
      toast.success("Ответ сохранён в библиотеку");
    } catch {
      toast.error("Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <Link to="/ask" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Новый вопрос
      </Link>

      {question && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">Ваш вопрос</p>
          <h1 className="text-xl font-semibold text-foreground">{question}</h1>
        </div>
      )}

      {status === "loading" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 animate-pulse" />
            Ищем ответ в ваших источниках…
          </div>
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      )}

      {status === "answered" && (
        <>
          <Card className="p-5 border-primary/20 bg-primary/5">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="space-y-2 flex-1">
                <p className="text-sm font-medium text-foreground">Ответ</p>
                <p className="text-sm text-foreground leading-relaxed">{answerText}</p>
              </div>
            </div>
          </Card>

          {/* Save CTA */}
          <Button
            onClick={handleSave}
            disabled={saved || saving}
            variant={saved ? "outline" : "default"}
            className="w-full"
          >
            {saved ? (
              <><Check className="h-4 w-4 mr-2" /> Сохранено</>
            ) : (
              <><BookmarkPlus className="h-4 w-4 mr-2" /> {saving ? "Сохранение…" : "Сохранить"}</>
            )}
          </Button>

          <div>
            <p className="text-sm font-medium text-foreground mb-3">
              Источники ({evidence.length})
            </p>
            <div className="space-y-2">
              {evidence.map((ev) => (
                <EvidenceItem key={ev.id} item={ev} />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5" />
            Показаны только источники, к которым у вас есть доступ.
          </div>
        </>
      )}

      {status === "insufficient" && (
        <Card className="p-6 text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-12 w-12 rounded-full bg-warning/10 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-warning" />
            </div>
          </div>
          <div>
            <p className="text-base font-medium text-foreground">Недостаточно данных для ответа</p>
            <p className="text-sm text-muted-foreground mt-1">
              Не удалось найти достаточно надёжных источников. Попробуйте:
            </p>
          </div>
          <ul className="text-sm text-muted-foreground space-y-1 text-left max-w-sm mx-auto">
            <li>• Переформулировать вопрос более конкретно</li>
            <li>• Включить источники Workspace</li>
            <li>• Подписаться на больше авторов для расширения базы знаний</li>
          </ul>
          <Button asChild variant="outline">
            <Link to="/ask">Задать другой вопрос</Link>
          </Button>
        </Card>
      )}

      {status === "error" && (
        <Card className="p-6 text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
          </div>
          <div>
            <p className="text-base font-medium text-foreground">Произошла ошибка</p>
            <p className="text-sm text-muted-foreground mt-1">
              Не удалось обработать ваш запрос. Пожалуйста, попробуйте снова.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/ask">Попробовать снова</Link>
          </Button>
        </Card>
      )}
    </div>
  );
}
