import { idbDelete, idbGetAll, idbPut } from "@/lib/lab/db";
import type { Params, StrategyLanguage } from "@/lib/lab/strategy/types";

// Saved code strategies, kept in this browser's IndexedDB ("compass-lab" →
// "strategies"). Import and export use plain .py and .ts files.

export interface SavedStrategy {
  id: string;
  name: string;
  language: StrategyLanguage;
  code: string;
  universe: string[];
  params: Params;
  updatedAt: string;
}

export async function listStrategies(): Promise<SavedStrategy[]> {
  const all = await idbGetAll<SavedStrategy>("strategies");
  return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export const saveStrategy = (s: SavedStrategy) => idbPut("strategies", s);
export const deleteStrategy = (id: string) => idbDelete("strategies", id);

export function newStrategyId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export const extensionFor = (language: StrategyLanguage) => (language === "python" ? "py" : "ts");

/** Language and name from an uploaded file, or null when the extension is not .py or .ts. */
export function parseStrategyFile(fileName: string): { language: StrategyLanguage; name: string } | null {
  const m = fileName.match(/^(.*)\.(py|ts)$/i);
  if (!m) return null;
  return { language: m[2].toLowerCase() === "py" ? "python" : "typescript", name: m[1] || "Imported strategy" };
}

/** A safe file name for an export. */
export function exportFileName(name: string, language: StrategyLanguage): string {
  const base = name.trim().replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "strategy";
  return `${base}.${extensionFor(language)}`;
}
