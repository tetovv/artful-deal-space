import type { Placement } from "./CampaignManageView";

const DRAFTS_KEY = "mediaos_campaign_drafts";

export interface CampaignDraft {
  id: string;
  updatedAt: string;
  step: number;
  placement: Placement | null;
  destinationUrl: string;
  utmParams: string;
  creativeTitle: string;
  creativeText: string;
  totalBudget: string;
  startDate: string | null; // ISO string
  endDate: string | null;
  noEndDate: boolean;
  dailyCap: string;
  /** We can't persist File objects — only metadata for display */
  creativeFileName: string | null;
  creativeFileSize: number | null;
  creativeType: "image" | "video" | null;
}

export function loadDrafts(): CampaignDraft[] {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveDraft(draft: CampaignDraft) {
  const drafts = loadDrafts().filter((d) => d.id !== draft.id);
  drafts.unshift({ ...draft, updatedAt: new Date().toISOString() });
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
}

export function deleteDraft(id: string) {
  const drafts = loadDrafts().filter((d) => d.id !== id);
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
}

export function createDraftId(): string {
  return "draft_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
}
