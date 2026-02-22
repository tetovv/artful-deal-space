/** Shared types for mock search data and search UI */

export interface MomentResult {
  id: string;
  video_id: string;
  start_sec: number;
  end_sec: number;
  transcript_snippet: string | null;
  access: "allowed" | "locked";
  video_title: string;
  creator_name: string;
  score: number;
  entity_tags?: unknown[];
  action_tags?: unknown[];
}

export interface SearchResults {
  best: MomentResult | null;
  moreVideos: MomentResult[];
  montageCandidates: MomentResult[];
}

export interface QueryData {
  query_text: string;
  preferences: Record<string, string>;
  include_private_sources: boolean;
}

export interface ClarificationQuestion {
  id: string;
  text: string;
  reason: string;
  options: { value: string; label: string }[];
  defaultValue: string;
}
