/**
 * ACT prompt — generates learning units and assistant actions.
 * Called by artifact_act edge function.
 */

const ACTION_INSTRUCTIONS: Record<string, string> = {
  generate_lesson_blocks: `Создай урок из текстовых блоков. Формат public_payload:
{
  "kind": "course",
  "modules": [{"id":"m1","title":"...","lessons":[{"id":"l1","title":"...","content":"...","type":"text"}]}]
}`,

  generate_quiz: `Создай тест. Формат public_payload:
{
  "kind": "quiz",
  "questions": [{"id":"q1","text":"...","type":"single_choice","options":[{"id":"a","text":"..."}],"explanation":"..."}],
  "time_limit_seconds": 300,
  "shuffle": false
}
Формат private_payload:
{
  "kind": "quiz",
  "answer_key": [{"question_id":"q1","correct_option_ids":["a"],"points":1}],
  "passing_score": 70
}`,

  generate_flashcards: `Создай набор карточек. Формат public_payload:
{
  "kind": "flashcards",
  "cards": [{"id":"c1","front":"Термин","back":"Определение","hint":"Подсказка"}]
}`,

  generate_slides: `Создай презентацию. Формат public_payload:
{
  "kind": "slides",
  "slides": [{"id":"s1","type":"title","title":"...","content":"..."}]
}`,

  generate_method_pack: `Создай методический пакет. Формат public_payload:
{
  "kind": "method_pack",
  "blocks": [{"id":"b1","type":"concept","title":"...","content":"...","order":0}]
}`,

  explain_term: `Объясни указанный термин простым языком. public_payload:
{
  "kind": "method_pack",
  "blocks": [{"id":"e1","type":"explanation","title":"Объяснение: [термин]","content":"...","order":0}]
}`,

  expand_selection: `Раскрой выбранный фрагмент подробнее. public_payload:
{
  "kind": "method_pack",
  "blocks": [{"id":"x1","type":"expansion","title":"Подробнее: ...","content":"...","order":0}]
}`,

  give_example: `Приведи практический пример. public_payload:
{
  "kind": "method_pack",
  "blocks": [{"id":"ex1","type":"example","title":"Пример: ...","content":"...","order":0}]
}`,

  remediate_topic: `Создай дополнительное объяснение для сложной темы. public_payload:
{
  "kind": "course",
  "modules": [{"id":"r1","title":"Разбор: ...","lessons":[{"id":"rl1","title":"...","content":"...","type":"text"}]}]
}`,

  grade_open: `Оцени открытый ответ ученика. public_payload:
{
  "kind": "method_pack",
  "blocks": [{"id":"fb1","type":"feedback","title":"Обратная связь","content":"...","order":0}]
}
private_payload:
{
  "kind": "exercise",
  "rubrics": [{"criterion":"...","max_points":10,"description":"..."}],
  "sample_answer": "..."
}
Также верни score (0-100) в ui_hints.`,
};

export function buildActSystemPrompt(actionType: string): string {
  const instruction = ACTION_INSTRUCTIONS[actionType] || ACTION_INSTRUCTIONS["explain_term"];

  return `Ты — AI-ассистент образовательной платформы. Генерируй учебный контент строго в JSON формате.

ВАЖНО: Ответь ТОЛЬКО валидным JSON без markdown-обёртки, комментариев и пояснений.

Задача: ${actionType}

${instruction}

Общий формат ответа:
{
  "public_payload": { ... },
  "private_payload": null | { ... },
  "source_refs": ["chunk_id_1", "chunk_id_2"],
  "ui_hints": {
    "display_mode": "full|compact|inline",
    "next_actions": ["action1", "action2"],
    "score": null | number
  }
}

Правила:
- Все id уникальные строки
- source_refs содержит id чанков, которые были использованы
- private_payload содержит ответы/ключи ТОЛЬКО для quiz и exercise — никогда не включай их в public_payload
- Язык: русский (или язык материала)
- Контент должен быть подробным и полезным`;
}

export function buildActUserPrompt(opts: {
  actionType: string;
  context?: string;
  target?: { term?: string; selected_text?: string; topic_id?: string };
  chunks: { id: string; text: string }[];
  userAnswer?: string;
}): string {
  const parts: string[] = [];

  if (opts.context) parts.push(`Контекст: ${opts.context}`);
  if (opts.target?.term) parts.push(`Термин: ${opts.target.term}`);
  if (opts.target?.selected_text) parts.push(`Выделенный текст: ${opts.target.selected_text}`);
  if (opts.target?.topic_id) parts.push(`Тема: ${opts.target.topic_id}`);
  if (opts.userAnswer) parts.push(`Ответ ученика:\n${opts.userAnswer}`);

  parts.push("\nИсточники:");
  for (const c of opts.chunks) {
    parts.push(`[${c.id}]\n${c.text}`);
  }

  return parts.join("\n\n");
}
