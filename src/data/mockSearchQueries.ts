/**
 * Deterministic mock data for 10 Russian test queries.
 * Covers: clarification, direct results, no results, locked content, montage flow.
 */

import type { MomentResult, SearchResults, QueryData, ClarificationQuestion } from "./mockSearchTypes";

export type { MomentResult, SearchResults, QueryData, ClarificationQuestion };

/* ── helpers ── */

let _id = 0;
function mid() { return `mock-moment-${++_id}`; }
function vid(n: number) { return `mock-video-${n}`; }

function moment(
  overrides: Partial<MomentResult> & { video_n: number },
): MomentResult {
  const { video_n, ...rest } = overrides;
  return {
    id: mid(),
    video_id: vid(video_n),
    start_sec: 30,
    end_sec: 90,
    transcript_snippet: null,
    access: "allowed",
    video_title: `Видео ${video_n}`,
    creator_name: "Тест Креатор",
    score: 0.8,
    entity_tags: [],
    action_tags: [],
    ...rest,
  };
}

/* ── query definitions ── */

export interface MockQueryDef {
  /** exact query text to match */
  queryText: string;
  /** if true, goes through clarification first */
  needsClarification: boolean;
  /** max 2 */
  clarificationQuestions?: ClarificationQuestion[];
  /** result set after clarification (or directly) */
  results: SearchResults;
  /** initial query metadata */
  queryData: QueryData;
}

const QUERIES: MockQueryDef[] = [
  /* 1 ─ Direct results, multiple moments */
  {
    queryText: "Азамат Мусагалиев танцует",
    needsClarification: false,
    results: {
      best: moment({
        video_n: 1,
        start_sec: 120,
        end_sec: 185,
        transcript_snippet: "А сейчас Азамат покажет свой фирменный танец…",
        video_title: "Большое шоу — Выпуск 42",
        creator_name: "Большое шоу",
        score: 0.95,
      }),
      moreVideos: [
        moment({
          video_n: 2,
          start_sec: 45,
          end_sec: 110,
          transcript_snippet: "Азамат выходит на сцену и начинает танцевать",
          video_title: "Comedy Club — Лучшие номера",
          creator_name: "Comedy Club",
          score: 0.82,
        }),
        moment({
          video_n: 3,
          start_sec: 200,
          end_sec: 260,
          transcript_snippet: "Зрители аплодируют танцу Мусагалиева",
          video_title: "Вечерний шоу",
          creator_name: "Первый канал",
          score: 0.71,
          access: "locked",
        }),
      ],
      montageCandidates: [
        moment({
          video_n: 1,
          start_sec: 120,
          end_sec: 185,
          transcript_snippet: "Фирменный танец",
          video_title: "Большое шоу — Выпуск 42",
          creator_name: "Большое шоу",
          score: 0.95,
        }),
        moment({
          video_n: 2,
          start_sec: 45,
          end_sec: 110,
          transcript_snippet: "Начинает танцевать",
          video_title: "Comedy Club",
          creator_name: "Comedy Club",
          score: 0.82,
        }),
      ],
    },
    queryData: {
      query_text: "Азамат Мусагалиев танцует",
      preferences: {},
      include_private_sources: false,
    },
  },

  /* 2 ─ Needs clarification (output type ambiguous) */
  {
    queryText: "Азамат Мусагалиев танцует в Большом шоу",
    needsClarification: true,
    clarificationQuestions: [
      {
        id: "outputType",
        text: "Что именно вы хотите получить?",
        reason: "Запрос может означать один момент или подборку.",
        options: [
          { value: "one_best", label: "Один лучший" },
          { value: "more_videos", label: "Больше видео" },
          { value: "montage", label: "Монтаж" },
          { value: "just_moment", label: "Только момент" },
        ],
        defaultValue: "one_best",
      },
      {
        id: "recency",
        text: "За какой период искать?",
        reason: "Большое шоу выходит давно — ограничим период?",
        options: [
          { value: "recent", label: "Последние 12 месяцев" },
          { value: "any", label: "За всё время" },
        ],
        defaultValue: "any",
      },
    ],
    results: {
      best: moment({
        video_n: 4,
        start_sec: 300,
        end_sec: 370,
        transcript_snippet: "В этом выпуске Большого шоу Азамат Мусагалиев исполняет зажигательный танец",
        video_title: "Большое шоу — Выпуск 42",
        creator_name: "Большое шоу",
        score: 0.97,
      }),
      moreVideos: [
        moment({
          video_n: 5,
          start_sec: 100,
          end_sec: 155,
          transcript_snippet: "Ещё один танцевальный номер Азамата",
          video_title: "Большое шоу — Выпуск 38",
          creator_name: "Большое шоу",
          score: 0.85,
        }),
      ],
      montageCandidates: [],
    },
    queryData: {
      query_text: "Азамат Мусагалиев танцует в Большом шоу",
      preferences: {},
      include_private_sources: false,
    },
  },

  /* 3 ─ Clarification (laugh intent → context question) */
  {
    queryText: "Где Азамат смеётся и почему",
    needsClarification: true,
    clarificationQuestions: [
      {
        id: "outputType",
        text: "Что именно вы хотите получить?",
        reason: "Уточним формат — один момент или подборку?",
        options: [
          { value: "one_best", label: "Один лучший" },
          { value: "more_videos", label: "Больше видео" },
        ],
        defaultValue: "more_videos",
      },
      {
        id: "includeContext",
        text: "Включить контекст перед моментом?",
        reason: "Иногда смех понятен только с предысторией.",
        options: [
          { value: "yes", label: "Да, с контекстом" },
          { value: "no", label: "Нет, только момент" },
        ],
        defaultValue: "yes",
      },
    ],
    results: {
      best: moment({
        video_n: 6,
        start_sec: 500,
        end_sec: 540,
        transcript_snippet: "Азамат не может сдержать смех после шутки ведущего",
        video_title: "Большое шоу — Выпуск 50",
        creator_name: "Большое шоу",
        score: 0.91,
      }),
      moreVideos: [
        moment({
          video_n: 7,
          start_sec: 80,
          end_sec: 130,
          transcript_snippet: "Азамат смеётся над собственным провалом на сцене",
          video_title: "Comedy Club — Backstage",
          creator_name: "Comedy Club",
          score: 0.78,
        }),
      ],
      montageCandidates: [],
    },
    queryData: {
      query_text: "Где Азамат смеётся и почему",
      preferences: {},
      include_private_sources: false,
    },
  },

  /* 4 ─ Direct results with exact quote match */
  {
    queryText: "Найди момент где ведущий говорит 'не задуряйтесь'",
    needsClarification: false,
    results: {
      best: moment({
        video_n: 8,
        start_sec: 742,
        end_sec: 760,
        transcript_snippet: "…и запомните — не задуряйтесь, ребята!",
        video_title: "Вечерний Ургант — Спецвыпуск",
        creator_name: "Вечерний Ургант",
        score: 0.99,
      }),
      moreVideos: [],
      montageCandidates: [],
    },
    queryData: {
      query_text: "Найди момент где ведущий говорит 'не задуряйтесь'",
      preferences: { resultType: "just_moment" },
      include_private_sources: false,
    },
  },

  /* 5 ─ Montage flow (detected from "нарезку") */
  {
    queryText: "Собери нарезку всех моментов где он танцует и зрители смеются",
    needsClarification: false,
    results: {
      best: moment({
        video_n: 9,
        start_sec: 60,
        end_sec: 120,
        transcript_snippet: "Зрители хохочут, пока Азамат танцует ламбаду",
        video_title: "Большое шоу — Выпуск 42",
        creator_name: "Большое шоу",
        score: 0.93,
      }),
      moreVideos: [],
      montageCandidates: [
        moment({
          video_n: 9,
          start_sec: 60,
          end_sec: 120,
          transcript_snippet: "Танец + смех зала",
          video_title: "Большое шоу — Выпуск 42",
          creator_name: "Большое шоу",
          score: 0.93,
        }),
        moment({
          video_n: 10,
          start_sec: 200,
          end_sec: 245,
          transcript_snippet: "Танцевальная импровизация, зрители аплодируют",
          video_title: "Шоу на ТНТ",
          creator_name: "ТНТ",
          score: 0.87,
        }),
        moment({
          video_n: 11,
          start_sec: 330,
          end_sec: 400,
          transcript_snippet: "Финальный танец под овации зала",
          video_title: "Comedy Club",
          creator_name: "Comedy Club",
          score: 0.81,
        }),
        moment({
          video_n: 12,
          start_sec: 15,
          end_sec: 55,
          transcript_snippet: "Начало номера — зал уже смеётся",
          video_title: "Вечерний шоу — Гость",
          creator_name: "Первый канал",
          score: 0.75,
          access: "locked",
        }),
      ],
    },
    queryData: {
      query_text: "Собери нарезку всех моментов где он танцует и зрители смеются",
      preferences: { resultType: "montage" },
      include_private_sources: false,
    },
  },

  /* 6 ─ Very short query → clarification */
  {
    queryText: "Азамат",
    needsClarification: true,
    clarificationQuestions: [
      {
        id: "outputType",
        text: "Что именно вы хотите получить?",
        reason: "Запрос слишком короткий — уточним.",
        options: [
          { value: "one_best", label: "Один лучший" },
          { value: "more_videos", label: "Больше видео" },
          { value: "montage", label: "Монтаж" },
          { value: "just_moment", label: "Только момент" },
        ],
        defaultValue: "more_videos",
      },
      {
        id: "duration",
        text: "Какая длительность вам подходит?",
        reason: "Уточним формат результатов.",
        options: [
          { value: "short", label: "Короткое (≤60с)" },
          { value: "medium", label: "Среднее (1–5 мин)" },
          { value: "full", label: "Полный выпуск" },
        ],
        defaultValue: "short",
      },
    ],
    results: {
      best: moment({
        video_n: 13,
        start_sec: 0,
        end_sec: 45,
        transcript_snippet: "Встречайте — Азамат Мусагалиев!",
        video_title: "Большое шоу — Все выпуски",
        creator_name: "Большое шоу",
        score: 0.7,
      }),
      moreVideos: [
        moment({
          video_n: 14,
          start_sec: 90,
          end_sec: 150,
          transcript_snippet: "Азамат на сцене",
          video_title: "Comedy Club",
          creator_name: "Comedy Club",
          score: 0.65,
        }),
      ],
      montageCandidates: [],
    },
    queryData: {
      query_text: "Азамат",
      preferences: {},
      include_private_sources: false,
    },
  },

  /* 7 ─ Conflicting preferences → clarification */
  {
    queryText: "короткое и полный выпуск",
    needsClarification: true,
    clarificationQuestions: [
      {
        id: "duration",
        text: "Какая длительность вам подходит?",
        reason: "Вы указали и «короткое» и «полный выпуск» — уточним.",
        options: [
          { value: "short", label: "Короткое (≤60с)" },
          { value: "medium", label: "Среднее (1–5 мин)" },
          { value: "full", label: "Полный выпуск" },
        ],
        defaultValue: "short",
      },
    ],
    results: {
      best: moment({
        video_n: 15,
        start_sec: 0,
        end_sec: 50,
        transcript_snippet: "Краткий обзор лучших моментов",
        video_title: "Дайджест — Топ недели",
        creator_name: "Дайджест",
        score: 0.72,
      }),
      moreVideos: [],
      montageCandidates: [],
    },
    queryData: {
      query_text: "короткое и полный выпуск",
      preferences: {},
      include_private_sources: false,
    },
  },

  /* 8 ─ No results */
  {
    queryText: "момент где он играет на саксофоне (без подсказок)",
    needsClarification: false,
    results: {
      best: null,
      moreVideos: [],
      montageCandidates: [],
    },
    queryData: {
      query_text: "момент где он играет на саксофоне (без подсказок)",
      preferences: {},
      include_private_sources: false,
    },
  },

  /* 9 ─ Quote paraphrase → direct result */
  {
    queryText: "где он говорит что-то типа 'не надо так делать'",
    needsClarification: false,
    results: {
      best: moment({
        video_n: 16,
        start_sec: 410,
        end_sec: 435,
        transcript_snippet: "…ну вот, ребята, не надо так делать, серьёзно…",
        video_title: "Большое шоу — Выпуск 55",
        creator_name: "Большое шоу",
        score: 0.88,
      }),
      moreVideos: [
        moment({
          video_n: 17,
          start_sec: 220,
          end_sec: 250,
          transcript_snippet: "Это не стоит повторять, правда не надо так",
          video_title: "Интервью с Азаматом",
          creator_name: "YouTube Originals",
          score: 0.74,
          access: "locked",
        }),
      ],
      montageCandidates: [],
    },
    queryData: {
      query_text: "где он говорит что-то типа 'не надо так делать'",
      preferences: { resultType: "just_moment" },
      include_private_sources: false,
    },
  },

  /* 10 ─ Negative constraint → direct but few results */
  {
    queryText: "без шортсов, не из этого шоу",
    needsClarification: false,
    results: {
      best: moment({
        video_n: 18,
        start_sec: 600,
        end_sec: 660,
        transcript_snippet: "Полноформатный выпуск — разговор без купюр",
        video_title: "Интервью — Другой канал",
        creator_name: "Другой канал",
        score: 0.68,
      }),
      moreVideos: [],
      montageCandidates: [],
    },
    queryData: {
      query_text: "без шортсов, не из этого шоу",
      preferences: {},
      include_private_sources: false,
    },
  },
];

/* ── public API ── */

/** All 10 test queries in order */
export const MOCK_QUERIES = QUERIES;

/** Find mock by exact query text */
export function findMockQuery(text: string): MockQueryDef | undefined {
  return QUERIES.find((q) => q.queryText === text.trim());
}

/** Generate a deterministic fake query ID from query text */
export function mockQueryId(text: string): string {
  // Simple hash to produce stable IDs
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) - h + text.charCodeAt(i)) | 0;
  }
  return `mock-query-${Math.abs(h).toString(16).padStart(8, "0")}`;
}
