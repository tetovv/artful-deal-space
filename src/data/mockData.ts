import { User, CreatorProfile, ContentItem, Deal, Message, Rating, AICourse } from "@/types";

export const currentUser: User = {
  id: "u1",
  name: "Алексей Петров",
  email: "alex@demo.com",
  avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex",
  role: "creator",
  createdAt: "2024-01-15",
};

export const users: User[] = [
  currentUser,
  { id: "u2", name: "Мария Иванова", email: "maria@demo.com", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Maria", role: "advertiser", createdAt: "2024-02-10" },
  { id: "u3", name: "Дмитрий Козлов", email: "dmitry@demo.com", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Dmitry", role: "user", createdAt: "2024-03-05" },
  { id: "u4", name: "Елена Смирнова", email: "elena@demo.com", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Elena", role: "moderator", createdAt: "2024-01-01" },
  { id: "u5", name: "TechBrand Corp", email: "techbrand@demo.com", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Tech", role: "advertiser", createdAt: "2024-04-01" },
];

export const creators: CreatorProfile[] = [
  { userId: "u1", displayName: "Алексей Петров", bio: "Продюсер цифрового контента, специализируюсь на образовательных видео и курсах", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex", niche: ["Образование", "Технологии"], followers: 125000, reach: 450000, geo: "Россия", rating: 4.8, contentCount: 47, verified: true },
  { userId: "c2", displayName: "Анна Волкова", bio: "Дизайнер и фотограф. Шаблоны, пресеты и обучающий контент", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Anna", niche: ["Дизайн", "Фото"], followers: 89000, reach: 320000, geo: "Россия", rating: 4.9, contentCount: 63, verified: true },
  { userId: "c3", displayName: "Игорь Сидоров", bio: "Музыкант и подкастер. Авторская музыка и подкасты о культуре", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Igor", niche: ["Музыка", "Подкасты"], followers: 56000, reach: 180000, geo: "Беларусь", rating: 4.6, contentCount: 124, verified: false },
  { userId: "c4", displayName: "Ольга Новикова", bio: "Бизнес-коуч. Книги, курсы и шаблоны для предпринимателей", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Olga", niche: ["Бизнес", "Образование"], followers: 210000, reach: 780000, geo: "Россия", rating: 4.7, contentCount: 35, verified: true },
  { userId: "c5", displayName: "Максим Лебедев", bio: "Видеограф и motion-дизайнер. Шаблоны After Effects и уроки", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Max", niche: ["Видео", "Motion"], followers: 43000, reach: 150000, geo: "Казахстан", rating: 4.5, contentCount: 88, verified: false },
];

const thumbs = [
  "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=400&h=300&fit=crop",
];

export const contentItems: ContentItem[] = [
  { id: "cnt1", title: "Продвинутый курс по TypeScript", description: "Полный курс от основ до продвинутых паттернов TypeScript с практическими проектами", type: "video", thumbnail: thumbs[0], creatorId: "u1", creatorName: "Алексей Петров", creatorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex", price: 2990, views: 12400, likes: 890, createdAt: "2024-11-01", tags: ["TypeScript", "Программирование"] },
  { id: "cnt2", title: "Lo-Fi Beats Collection Vol.3", description: "50 оригинальных lo-fi треков для ваших проектов", type: "music", thumbnail: thumbs[1], creatorId: "c3", creatorName: "Игорь Сидоров", creatorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Igor", price: 990, views: 8200, likes: 1240, createdAt: "2024-10-15", tags: ["Музыка", "Lo-Fi", "Биты"] },
  { id: "cnt3", title: "UI Kit для Figma — 200+ компонентов", description: "Полный UI Kit с компонентами для веб и мобильных приложений", type: "template", thumbnail: thumbs[2], creatorId: "c2", creatorName: "Анна Волкова", creatorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Anna", price: 4990, views: 5600, likes: 672, createdAt: "2024-09-20", tags: ["Дизайн", "Figma", "UI"] },
  { id: "cnt4", title: "Как построить личный бренд", description: "Подкаст о стратегиях построения личного бренда в цифровую эпоху", type: "podcast", thumbnail: thumbs[3], creatorId: "c4", creatorName: "Ольга Новикова", creatorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Olga", price: null, views: 23000, likes: 2100, createdAt: "2024-12-01", tags: ["Бизнес", "Бренд"] },
  { id: "cnt5", title: "Фотопак: Минимализм в архитектуре", description: "30 фото высокого разрешения для коммерческого использования", type: "image", thumbnail: thumbs[5], creatorId: "c2", creatorName: "Анна Волкова", creatorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Anna", price: 1490, views: 3200, likes: 445, createdAt: "2024-11-28", tags: ["Фото", "Архитектура"] },
  { id: "cnt6", title: "Предпринимательство: от идеи до масштаба", description: "Электронная книга с пошаговым руководством для стартаперов", type: "book", thumbnail: thumbs[6], creatorId: "c4", creatorName: "Ольга Новикова", creatorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Olga", price: 1990, views: 9800, likes: 1560, createdAt: "2024-08-15", tags: ["Книга", "Бизнес", "Стартап"] },
  { id: "cnt7", title: "Motion Graphics Starter Pack", description: "20 анимированных шаблонов для After Effects", type: "template", thumbnail: thumbs[7], creatorId: "c5", creatorName: "Максим Лебедев", creatorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Max", price: 3490, views: 4100, likes: 388, createdAt: "2024-10-05", tags: ["Motion", "After Effects"] },
  { id: "cnt8", title: "Тренды дизайна 2025", description: "Обзор главных трендов в UI/UX и графическом дизайне", type: "post", thumbnail: thumbs[4], creatorId: "c2", creatorName: "Анна Волкова", creatorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Anna", price: null, views: 18500, likes: 2890, createdAt: "2024-12-10", tags: ["Дизайн", "Тренды", "2025"] },
];

export const deals: Deal[] = [
  {
    id: "d1", advertiserId: "u2", advertiserName: "Мария Иванова", creatorId: "u1", creatorName: "Алексей Петров",
    title: "Интеграция в видео о TypeScript", description: "Рекламная интеграция продукта в обучающее видео",
    budget: 45000, status: "in_progress", createdAt: "2024-12-01", deadline: "2025-01-15",
    milestones: [
      { id: "m1", title: "Согласование брифа", completed: true, dueDate: "2024-12-05" },
      { id: "m2", title: "Черновик интеграции", completed: true, dueDate: "2024-12-20" },
      { id: "m3", title: "Финальный ролик", completed: false, dueDate: "2025-01-10" },
      { id: "m4", title: "Публикация", completed: false, dueDate: "2025-01-15" },
    ],
  },
  {
    id: "d2", advertiserId: "u5", advertiserName: "TechBrand Corp", creatorId: "c4", creatorName: "Ольга Новикова",
    title: "Спонсорство подкаста — 3 эпизода", description: "Спонсорские вставки в 3 эпизодах подкаста",
    budget: 120000, status: "completed", createdAt: "2024-10-01", deadline: "2024-12-01",
    milestones: [
      { id: "m5", title: "Контракт подписан", completed: true, dueDate: "2024-10-05" },
      { id: "m6", title: "Эпизод 1", completed: true, dueDate: "2024-10-20" },
      { id: "m7", title: "Эпизод 2", completed: true, dueDate: "2024-11-10" },
      { id: "m8", title: "Эпизод 3", completed: true, dueDate: "2024-12-01" },
    ],
  },
  {
    id: "d3", advertiserId: "u2", advertiserName: "Мария Иванова", creatorId: "c2", creatorName: "Анна Волкова",
    title: "Обзор продукта в посте", description: "Развернутый обзор нового продукта в формате поста",
    budget: 25000, status: "pending", createdAt: "2024-12-15", deadline: "2025-02-01",
    milestones: [
      { id: "m9", title: "Бриф получен", completed: false, dueDate: "2024-12-20" },
      { id: "m10", title: "Драфт поста", completed: false, dueDate: "2025-01-15" },
    ],
  },
];

export const messages: Message[] = [
  { id: "msg1", dealId: "d1", senderId: "u2", senderName: "Мария Иванова", content: "Добрый день! Отправляю бриф по интеграции.", timestamp: "2024-12-01T10:00:00", attachment: "brief_v1.pdf" },
  { id: "msg2", dealId: "d1", senderId: "u1", senderName: "Алексей Петров", content: "Получил, спасибо! Посмотрю до конца дня и вернусь с вопросами.", timestamp: "2024-12-01T11:30:00" },
  { id: "msg3", dealId: "d1", senderId: "u1", senderName: "Алексей Петров", content: "Бриф отличный, могу начать на этой неделе. Предлагаю формат: 60-секундная вставка в середине видео.", timestamp: "2024-12-02T09:00:00" },
  { id: "msg4", dealId: "d1", senderId: "u2", senderName: "Мария Иванова", content: "Отлично, согласна! Пожалуйста, пришлите черновик до 20 декабря.", timestamp: "2024-12-02T10:15:00" },
  { id: "msg5", dealId: "d1", senderId: "u1", senderName: "Алексей Петров", content: "Черновик готов! Прикрепляю файл для ревью.", timestamp: "2024-12-18T16:00:00", attachment: "draft_integration.mp4" },
];

export const ratings: Rating[] = [
  { id: "r1", dealId: "d2", fromId: "c4", toId: "u5", communication: 5, payment: 5, professionalism: 4, overall: 4.7, createdAt: "2024-12-05" },
  { id: "r2", dealId: "d2", fromId: "u5", toId: "c4", communication: 5, payment: 5, professionalism: 5, overall: 5.0, createdAt: "2024-12-05" },
];

export const aiCourses: AICourse[] = [
  {
    id: "ai1", userId: "u1", title: "Основы машинного обучения", status: "completed", progress: 100, createdAt: "2024-12-10",
    modules: [
      { id: "mod1", title: "Введение в ML", lessons: [
        { id: "l1", title: "Что такое машинное обучение?", content: "Машинное обучение — это подобласть ИИ...", type: "text" },
        { id: "l2", title: "Типы ML", content: "Supervised, Unsupervised, Reinforcement...", type: "text" },
        { id: "l3", title: "Проверка знаний", content: "quiz_data_placeholder", type: "quiz" },
      ]},
      { id: "mod2", title: "Линейная регрессия", lessons: [
        { id: "l4", title: "Теория", content: "Линейная регрессия моделирует...", type: "text" },
        { id: "l5", title: "Практика", content: "exercise_placeholder", type: "exercise" },
      ]},
      { id: "mod3", title: "Нейронные сети", lessons: [
        { id: "l6", title: "Перцептрон", content: "Простейшая модель нейрона...", type: "text" },
        { id: "l7", title: "Итоговый тест", content: "quiz_final_placeholder", type: "quiz" },
      ]},
    ],
  },
  {
    id: "ai2", userId: "u1", title: "Digital Marketing Strategy", status: "generating", progress: 62, createdAt: "2024-12-14",
    modules: [
      { id: "mod4", title: "Основы digital-маркетинга", lessons: [
        { id: "l8", title: "Каналы продвижения", content: "...", type: "text" },
      ]},
    ],
  },
];

export const purchasedItems = ["cnt1", "cnt2", "cnt6"];

export const contentTypeLabels: Record<string, string> = {
  video: "Видео",
  music: "Музыка",
  post: "Пост",
  podcast: "Подкаст",
  book: "Книга",
  template: "Шаблон",
  image: "Изображение",
};

export const contentTypeIcons: Record<string, string> = {
  video: "Play",
  music: "Music",
  post: "FileText",
  podcast: "Mic",
  book: "BookOpen",
  template: "Layout",
  image: "Image",
};
