/**
 * PLAN prompt — builds topics, roadmap, assistant_menu_policy, optional diagnostic.
 * Called by project_plan edge function.
 */

export function buildPlanSystemPrompt(): string {
  return `Ты — архитектор учебных программ. Твоя задача — проанализировать предоставленные фрагменты учебного материала и создать структурированный план обучения.

ВАЖНО: Ответь ТОЛЬКО валидным JSON без markdown-обёртки, комментариев и пояснений.

Формат ответа:
{
  "topics": [
    {
      "id": "topic_1",
      "title": "Название темы",
      "description": "Краткое описание",
      "key_terms": ["термин1", "термин2"],
      "difficulty": "beginner|intermediate|advanced",
      "estimated_minutes": 30
    }
  ],
  "roadmap": [
    {
      "id": "step_1",
      "title": "Название шага",
      "description": "Что изучим",
      "artifact_type": "course|quiz|flashcards|slides|method_pack",
      "status": "available",
      "next_step_id": "step_2"
    }
  ],
  "assistant_menu_policy": {
    "context": "learning",
    "items": [
      {"id": "explain", "label": "Объясни термин", "action": "explain_term", "enabled": true, "visible": true},
      {"id": "example", "label": "Покажи пример", "action": "give_example", "enabled": true, "visible": true},
      {"id": "expand", "label": "Раскрой подробнее", "action": "expand_selection", "enabled": true, "visible": true},
      {"id": "quiz", "label": "Проверь знания", "action": "generate_quiz", "enabled": true, "visible": true},
      {"id": "flashcards", "label": "Карточки", "action": "generate_flashcards", "enabled": true, "visible": true}
    ],
    "integrity_rules": [
      {"rule_id": "no_answers", "description": "Не показывать ответы до завершения попытки", "condition": "attempt.status != completed", "action": "hide"}
    ]
  },
  "diagnostic": {
    "enabled": true,
    "quiz": {
      "questions": [
        {
          "id": "q1",
          "text": "Вопрос?",
          "type": "single_choice",
          "options": [
            {"id": "a", "text": "Вариант A"},
            {"id": "b", "text": "Вариант B"},
            {"id": "c", "text": "Вариант C"},
            {"id": "d", "text": "Вариант D"}
          ]
        }
      ]
    },
    "answer_key": [
      {"question_id": "q1", "correct_option_ids": ["a"], "points": 1}
    ]
  }
}

Правила:
- Создай 3-8 тем на основе материала
- Roadmap должен содержать 4-10 шагов с логической последовательностью
- Первый шаг roadmap должен иметь status "available", остальные "locked"
- next_step_id последнего шага = null
- Если материал достаточен, включи diagnostic quiz (3-5 вопросов) для оценки начального уровня
- Все id должны быть уникальными строками
- Язык ответа: русский (если материал на русском) или язык материала`;
}

export function buildPlanUserPrompt(chunks: { text: string; meta?: unknown }[]): string {
  const material = chunks.map((c, i) => `[Фрагмент ${i + 1}]\n${c.text}`).join("\n\n---\n\n");
  return `Проанализируй следующий учебный материал и создай план обучения:\n\n${material}`;
}

export function buildPlanPatchPrompt(
  currentRoadmap: unknown,
  checkinData: unknown,
  chunks: { text: string }[]
): string {
  return `Текущий roadmap:\n${JSON.stringify(currentRoadmap, null, 2)}\n\nДанные check-in:\n${JSON.stringify(checkinData, null, 2)}\n\nДоступные фрагменты:\n${chunks.map((c, i) => `[${i + 1}] ${c.text.slice(0, 200)}`).join("\n")}\n\nОбнови roadmap с учётом прогресса и трудностей ученика. Верни обновлённый JSON в том же формате, что и оригинальный PLAN. Измени только roadmap и topics при необходимости.`;
}
