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
  startDate: string | null;
  endDate: string | null;
  noEndDate: boolean;
  dailyCap: string;
  creativeFileName: string | null;
  creativeFileSize: number | null;
  creativeType: "image" | "video" | null;
  /** Base64 data URL of the creative file */
  creativeDataUrl: string | null;
}

/** Convert a File to a base64 data URL (max ~8 MB to avoid localStorage limits) */
export function fileToDataUrl(file: File): Promise<string | null> {
  if (file.size > 8 * 1024 * 1024) return Promise.resolve(null);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

/** Convert a data URL back to a File object */
export function dataUrlToFile(dataUrl: string, fileName: string): File | null {
  try {
    const [header, base64] = dataUrl.split(",");
    const mime = header.match(/:(.*?);/)?.[1] ?? "application/octet-stream";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], fileName, { type: mime });
  } catch {
    return null;
  }
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
  try {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  } catch {
    // Quota exceeded — strip file data only from THIS draft, keep other drafts' files
    const lite = drafts.map((d) =>
      d.id === draft.id ? { ...d, creativeDataUrl: null } : d
    );
    try {
      localStorage.setItem(DRAFTS_KEY, JSON.stringify(lite));
    } catch {
      // Still too large — strip all file data
      const ultraLite = drafts.map((d) => ({ ...d, creativeDataUrl: null }));
      localStorage.setItem(DRAFTS_KEY, JSON.stringify(ultraLite));
    }
  }
}

export function deleteDraft(id: string) {
  const drafts = loadDrafts().filter((d) => d.id !== id);
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
}

export function createDraftId(): string {
  return "draft_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
}
