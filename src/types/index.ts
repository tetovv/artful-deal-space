export type UserRole = "user" | "creator" | "advertiser" | "moderator" | "support";

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: UserRole;
  createdAt: string;
}

export interface CreatorProfile {
  userId: string;
  displayName: string;
  bio: string;
  avatar: string;
  niche: string[];
  followers: number;
  reach: number;
  geo: string;
  rating: number;
  contentCount: number;
  verified: boolean;
}

export type ContentType = "video" | "music" | "post" | "podcast" | "book" | "template";

export interface ContentItem {
  id: string;
  title: string;
  description: string;
  type: ContentType;
  thumbnail: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar: string;
  price: number | null; // null = free
  views: number;
  likes: number;
  createdAt: string;
  tags: string[];
}

export interface Product {
  id: string;
  contentId: string;
  price: number;
  currency: string;
  subscriptionType: "one-time" | "monthly" | "yearly" | null;
  salesCount: number;
}

export interface Subscription {
  id: string;
  userId: string;
  creatorId: string;
  plan: "basic" | "premium" | "vip";
  price: number;
  status: "active" | "cancelled" | "expired";
  startDate: string;
  endDate: string;
}

export type DealStatus = "pending" | "briefing" | "in_progress" | "review" | "completed" | "disputed";

export interface Deal {
  id: string;
  advertiserId: string;
  advertiserName: string;
  creatorId: string;
  creatorName: string;
  title: string;
  description: string;
  budget: number;
  status: DealStatus;
  milestones: Milestone[];
  createdAt: string;
  deadline: string;
}

export interface Milestone {
  id: string;
  title: string;
  completed: boolean;
  dueDate: string;
}

export interface Message {
  id: string;
  dealId: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
  attachment?: string;
}

export interface Rating {
  id: string;
  dealId: string;
  fromId: string;
  toId: string;
  communication: number;
  payment: number;
  professionalism: number;
  overall: number;
  createdAt: string;
}

export interface Dispute {
  id: string;
  dealId: string;
  raisedBy: string;
  reason: string;
  status: "open" | "in_review" | "resolved";
  createdAt: string;
}

export interface AICourse {
  id: string;
  userId: string;
  title: string;
  status: "uploading" | "processing" | "generating" | "completed" | "failed";
  progress: number;
  modules: AICourseModule[];
  createdAt: string;
}

export interface AICourseModule {
  id: string;
  title: string;
  lessons: { id: string; title: string; content: string; type: "text" | "quiz" | "exercise" }[];
}
