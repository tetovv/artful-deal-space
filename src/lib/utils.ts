import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Sanitize a file name for Supabase storage (remove non-ASCII, spaces, parens, etc.) */
export function sanitizeStorageName(name: string): string {
  const ext = name.split(".").pop() || "";
  const base = name.slice(0, name.length - ext.length - 1);
  const clean = base
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80);
  return clean ? `${clean}.${ext}` : `file_${Date.now()}.${ext}`;
}
