import { z } from "zod";

// ══════════════════════════════════════
// Roadmap
// ══════════════════════════════════════

export const RoadmapStepSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().default(""),
  artifact_type: z.string().optional(),
  status: z.enum(["locked", "available", "in_progress", "completed"]).default("locked"),
  next_step_id: z.string().nullable().default(null),
});

export const RoadmapSchema = z.array(RoadmapStepSchema);

export type RoadmapStep = z.infer<typeof RoadmapStepSchema>;
export type Roadmap = z.infer<typeof RoadmapSchema>;

// ══════════════════════════════════════
// Assistant Menu Policy
// ══════════════════════════════════════

export const MenuItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  action: z.string(),
  enabled: z.boolean().default(true),
  visible: z.boolean().default(true),
});

export const IntegrityRuleSchema = z.object({
  rule_id: z.string(),
  description: z.string(),
  condition: z.string(),
  action: z.enum(["hide", "disable", "warn"]),
});

export const AssistantMenuPolicySchema = z.object({
  context: z.string().default("default"),
  items: z.array(MenuItemSchema).default([]),
  integrity_rules: z.array(IntegrityRuleSchema).default([]),
});

export type MenuItem = z.infer<typeof MenuItemSchema>;
export type IntegrityRule = z.infer<typeof IntegrityRuleSchema>;
export type AssistantMenuPolicy = z.infer<typeof AssistantMenuPolicySchema>;

// ══════════════════════════════════════
// Artifact Public JSON — by type
// ══════════════════════════════════════

// Course
export const CourseLessonSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  type: z.enum(["text", "quiz", "exercise"]),
});
export const CourseModuleSchema = z.object({
  id: z.string(),
  title: z.string(),
  lessons: z.array(CourseLessonSchema),
});
export const CoursePublicSchema = z.object({
  modules: z.array(CourseModuleSchema),
});
export type CoursePublic = z.infer<typeof CoursePublicSchema>;

// Quiz
export const QuizOptionSchema = z.object({
  id: z.string(),
  text: z.string(),
});
export const QuizQuestionSchema = z.object({
  id: z.string(),
  text: z.string(),
  type: z.enum(["single_choice", "multiple_choice"]),
  options: z.array(QuizOptionSchema),
  explanation: z.string().optional(),
});
export const QuizPublicSchema = z.object({
  questions: z.array(QuizQuestionSchema),
  time_limit_seconds: z.number().optional(),
  shuffle: z.boolean().default(false),
});
export type QuizPublic = z.infer<typeof QuizPublicSchema>;

// Flashcards
export const FlashcardSchema = z.object({
  id: z.string(),
  front: z.string(),
  back: z.string(),
  hint: z.string().optional(),
});
export const FlashcardsPublicSchema = z.object({
  cards: z.array(FlashcardSchema),
});
export type FlashcardsPublic = z.infer<typeof FlashcardsPublicSchema>;

// Slides
export const SlideSchema = z.object({
  id: z.string(),
  type: z.enum(["title", "content", "bullets", "two-column", "quote", "summary"]),
  title: z.string(),
  content: z.string().optional(),
  bullets: z.array(z.string()).optional(),
  leftColumn: z.string().optional(),
  rightColumn: z.string().optional(),
  notes: z.string().optional(),
});
export const SlidesPublicSchema = z.object({
  slides: z.array(SlideSchema),
});
export type SlidesPublic = z.infer<typeof SlidesPublicSchema>;

// Method Pack
export const MethodBlockSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  content: z.string(),
  order: z.number().default(0),
});
export const MethodPackPublicSchema = z.object({
  blocks: z.array(MethodBlockSchema),
});
export type MethodPackPublic = z.infer<typeof MethodPackPublicSchema>;

// Union
export const ArtifactPublicSchema = z.discriminatedUnion("kind", [
  CoursePublicSchema.extend({ kind: z.literal("course") }),
  QuizPublicSchema.extend({ kind: z.literal("quiz") }),
  FlashcardsPublicSchema.extend({ kind: z.literal("flashcards") }),
  SlidesPublicSchema.extend({ kind: z.literal("slides") }),
  MethodPackPublicSchema.extend({ kind: z.literal("method_pack") }),
]);
export type ArtifactPublic = z.infer<typeof ArtifactPublicSchema>;

// ══════════════════════════════════════
// Artifact Private JSON
// ══════════════════════════════════════

export const QuizAnswerKeySchema = z.object({
  question_id: z.string(),
  correct_option_ids: z.array(z.string()),
  points: z.number().default(1),
});
export const QuizPrivateSchema = z.object({
  kind: z.literal("quiz"),
  answer_key: z.array(QuizAnswerKeySchema),
  passing_score: z.number().optional(),
});

export const ExerciseRubricSchema = z.object({
  criterion: z.string(),
  max_points: z.number(),
  description: z.string().default(""),
});
export const ExercisePrivateSchema = z.object({
  kind: z.literal("exercise"),
  rubrics: z.array(ExerciseRubricSchema),
  sample_answer: z.string().optional(),
});

export const ArtifactPrivateSchema = z.discriminatedUnion("kind", [
  QuizPrivateSchema,
  ExercisePrivateSchema,
]);
export type ArtifactPrivate = z.infer<typeof ArtifactPrivateSchema>;

// ══════════════════════════════════════
// Component Registry (MVP)
// ══════════════════════════════════════

export const COMPONENT_REGISTRY = {
  text_block: {
    id: "text_block",
    label: "Текстовый блок",
    description: "Произвольный текст / параграф",
    category: "content",
  },
  summary_block: {
    id: "summary_block",
    label: "Резюме",
    description: "Краткое изложение / выводы",
    category: "content",
  },
  quiz_single_choice: {
    id: "quiz_single_choice",
    label: "Тест (один ответ)",
    description: "Вопрос с одним правильным ответом",
    category: "assessment",
  },
  quiz_multiple_choice: {
    id: "quiz_multiple_choice",
    label: "Тест (несколько ответов)",
    description: "Вопрос с несколькими правильными ответами",
    category: "assessment",
  },
  flashcards: {
    id: "flashcards",
    label: "Карточки",
    description: "Набор карточек для запоминания",
    category: "learning",
  },
  exercise_open: {
    id: "exercise_open",
    label: "Открытое задание",
    description: "Задание с развёрнутым ответом",
    category: "assessment",
  },
} as const;

export type ComponentRegistryKey = keyof typeof COMPONENT_REGISTRY;
export type ComponentRegistryEntry = (typeof COMPONENT_REGISTRY)[ComponentRegistryKey];

// ══════════════════════════════════════
// Project type (DB row shape)
// ══════════════════════════════════════

export interface GuidedProject {
  id: string;
  user_id: string;
  title: string;
  description: string;
  goal: string;
  audience: string;
  roadmap: Roadmap;
  assistant_menu_policy: AssistantMenuPolicy;
  status: string;
  created_at: string;
  updated_at: string;
}
