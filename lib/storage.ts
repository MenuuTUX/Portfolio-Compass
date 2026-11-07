import { isTicker, normalizeTicker } from "@/lib/tickers";
import { z } from "zod";

/**
 * Portfolio storage uses browser LocalStorage only.
 * Nothing is written to a server database.
 *
 * Key: portfolio_compass_v1
 * Shape: { v: 2, items: [{ ticker, weight, shares }, ...] }
 * Older saves wrote the bare array; loads accept both and the next save migrates.
 */

/** A backup file larger than this is refused before it is parsed. */
export const MAX_BACKUP_BYTES = 1_000_000;
/** More holdings than this in a backup is refused; no real portfolio gets close. */
export const MAX_BACKUP_HOLDINGS = 500;

/**
 * A blank number input yields NaN and a pasted "-5" yields a negative holding.
 * Both are rejected here rather than in each caller, so no UI path can write a
 * portfolio that later breaks the weighting and projection math.
 */
const nonNegative = z.number().nonnegative();

const LocalPortfolioItemSchema = z.object({
  ticker: z.string().min(1),
  weight: nonNegative,
  shares: nonNegative,
});

export type LocalPortfolioItem = z.infer<typeof LocalPortfolioItemSchema>;

export const LocalPortfolioSchema = z.array(LocalPortfolioItemSchema);

/** Validate a backup and normalize ticker identity before preview or restore. */
export function parsePortfolioBackup(input: unknown): LocalPortfolioItem[] {
  if (Array.isArray(input) && input.length > MAX_BACKUP_HOLDINGS) {
    throw new Error(`A backup can hold at most ${MAX_BACKUP_HOLDINGS} holdings.`);
  }
  const result = LocalPortfolioSchema.safeParse(input);
  if (!result.success) {
    throw new Error("Backup must be an array of holdings with a ticker, target weight, and non-negative shares.");
  }

  const seen = new Set<string>();
  return result.data.map((item) => {
    const ticker = normalizeTicker(item.ticker);
    if (!isTicker(ticker)) {
      throw new Error(`“${item.ticker}” is not a valid ticker. Use 1–15 letters, numbers, dots, dashes, ^ or =.`);
    }
    if (seen.has(ticker)) {
      throw new Error(`Backup contains ${ticker} more than once.`);
    }
    seen.add(ticker);
    return { ticker, weight: item.weight, shares: item.shares };
  });
}

/** Both lists come from parsePortfolioBackup, so tickers are already normalized. */
export function mergePortfolioBackup(
  current: LocalPortfolioItem[],
  imported: LocalPortfolioItem[],
): LocalPortfolioItem[] {
  const merged = new Map<string, LocalPortfolioItem>();
  for (const item of [...current, ...imported]) merged.set(item.ticker, item);
  return [...merged.values()];
}

/** The LocalStorage key that holds the portfolio; other tabs write to it too. */
export const PORTFOLIO_STORAGE_KEY = "portfolio_compass_v1";
const ENVELOPE_VERSION = 2;

/** Return the holdings from either the v2 envelope or the older bare array. */
function holdingsFrom(parsed: unknown): unknown {
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const envelope = parsed as { v?: unknown; items?: unknown };
    if (envelope.v === ENVELOPE_VERSION) return envelope.items;
  }
  return parsed;
}

export function savePortfolio(items: LocalPortfolioItem[]) {
  if (!globalThis.window) return;

  const validItems = LocalPortfolioSchema.parse(items);

  try {
    localStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify({ v: ENVELOPE_VERSION, items: validItems }));
  } catch {
    // Quota exceeded or storage disabled (private mode): say so in plain words.
    throw new Error("Your browser blocked saving your portfolio (storage is full or disabled)");
  }
}

export function loadPortfolio(): LocalPortfolioItem[] {
  if (!globalThis.window) return [];
  try {
    const raw = localStorage.getItem(PORTFOLIO_STORAGE_KEY);
    if (!raw) return [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      preserveCorruptPortfolio(raw);
      return [];
    }

    const holdings = holdingsFrom(parsed);
    const result = LocalPortfolioSchema.safeParse(holdings);
    if (result.success) return result.data;

    // One bad holding must not make the whole portfolio look empty, because the
    // next save would then overwrite every holding. Keep each item that has a
    // ticker, reset unusable numbers to 0, and keep the raw text for recovery.
    preserveCorruptPortfolio(raw);
    console.warn("Local portfolio data partly invalid, repaired:", result.error);
    return repairPortfolio(holdings);
  } catch (error) {
    console.error("Failed to load portfolio from local storage:", error);
    return [];
  }
}

export const CORRUPT_BACKUP_KEY = `${PORTFOLIO_STORAGE_KEY}_corrupt_backup`;

function preserveCorruptPortfolio(raw: string) {
  try {
    // Keep the first copy: a later repair must not replace the original data.
    if (localStorage.getItem(CORRUPT_BACKUP_KEY) === null) {
      localStorage.setItem(CORRUPT_BACKUP_KEY, raw);
    }
  } catch {
    // Storage full or blocked: nothing more can be saved.
  }
}

function toNonNegative(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

/** Keep holdings with a usable ticker; invalid weights or shares become 0. */
function repairPortfolio(input: unknown): LocalPortfolioItem[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const items: LocalPortfolioItem[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const { ticker, weight, shares } = item as Record<string, unknown>;
    if (typeof ticker !== "string" || !ticker.trim()) continue;
    const key = normalizeTicker(ticker);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ ticker: ticker.trim(), weight: toNonNegative(weight), shares: toNonNegative(shares) });
  }
  return items;
}

/** Read local holdings strictly for backup export, where corruption must not look empty. */
export function loadPortfolioBackup(): LocalPortfolioItem[] {
  if (!globalThis.window) return [];
  const raw = localStorage.getItem(PORTFOLIO_STORAGE_KEY);
  if (raw === null) return [];

  try {
    return parsePortfolioBackup(holdingsFrom(JSON.parse(raw)));
  } catch {
    throw new Error("Stored portfolio data is corrupted and could not be exported.");
  }
}
