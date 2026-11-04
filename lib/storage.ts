import { z } from "zod";

/**
 * Portfolio storage uses browser LocalStorage only.
 * Nothing is written to a server database.
 *
 * Key: portfolio_compass_v1
 * Shape: [{ ticker, weight, shares }, ...]
 */

/**
 * A blank number input yields NaN and a pasted "-5" yields a negative holding.
 * Both are rejected here rather than in each caller, so no UI path can write a
 * portfolio that later breaks the weighting and projection math.
 */
const nonNegative = z.number().nonnegative();

export const LocalPortfolioItemSchema = z.object({
  ticker: z.string().min(1),
  weight: nonNegative,
  shares: nonNegative,
});

export type LocalPortfolioItem = z.infer<typeof LocalPortfolioItemSchema>;

export const LocalPortfolioSchema = z.array(LocalPortfolioItemSchema);

/** Validate a backup and normalize ticker identity before preview or restore. */
export function parsePortfolioBackup(input: unknown): LocalPortfolioItem[] {
  const result = LocalPortfolioSchema.safeParse(input);
  if (!result.success) {
    throw new Error("Backup must be an array of holdings with a ticker, target weight, and non-negative shares.");
  }

  const seen = new Set<string>();
  return result.data.map((item) => {
    const ticker = item.ticker.trim().toUpperCase();
    if (!/^[A-Z0-9.-]{1,12}$/.test(ticker)) {
      throw new Error(`“${item.ticker}” is not a valid ticker. Use 1–12 letters, numbers, dots, or dashes.`);
    }
    if (seen.has(ticker)) {
      throw new Error(`Backup contains ${ticker} more than once.`);
    }
    seen.add(ticker);
    return { ticker, weight: item.weight, shares: item.shares };
  });
}

/** Imported values replace same-ticker records while other local holdings stay. */
export function mergePortfolioBackup(
  current: LocalPortfolioItem[],
  imported: LocalPortfolioItem[],
): LocalPortfolioItem[] {
  const merged = new Map<string, LocalPortfolioItem>();
  for (const item of current) {
    const ticker = item.ticker.trim().toUpperCase();
    merged.set(ticker, { ticker, weight: item.weight, shares: item.shares });
  }
  for (const item of imported) {
    const ticker = item.ticker.trim().toUpperCase();
    merged.set(ticker, { ticker, weight: item.weight, shares: item.shares });
  }
  return [...merged.values()];
}

const STORAGE_KEY = "portfolio_compass_v1";

export function savePortfolio(items: LocalPortfolioItem[]) {
  if (!globalThis.window) return;

  // Validate schema - will throw ZodError if invalid
  const validItems = LocalPortfolioSchema.parse(items);

  // Save to storage - will throw if quota exceeded
  localStorage.setItem(STORAGE_KEY, JSON.stringify(validItems));
}

export function loadPortfolio(): LocalPortfolioItem[] {
  if (!globalThis.window) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      preserveCorruptPortfolio(raw);
      return [];
    }

    const result = LocalPortfolioSchema.safeParse(parsed);
    if (result.success) return result.data;

    // One bad holding must not make the whole portfolio look empty, because the
    // next save would then overwrite every holding. Keep each item that has a
    // ticker, reset unusable numbers to 0, and keep the raw text for recovery.
    preserveCorruptPortfolio(raw);
    console.warn("Local portfolio data partly invalid, repaired:", result.error);
    return repairPortfolio(parsed);
  } catch (error) {
    console.error("Failed to load portfolio from local storage:", error);
    return [];
  }
}

export const CORRUPT_BACKUP_KEY = `${STORAGE_KEY}_corrupt_backup`;

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
export function repairPortfolio(input: unknown): LocalPortfolioItem[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const items: LocalPortfolioItem[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const { ticker, weight, shares } = item as Record<string, unknown>;
    if (typeof ticker !== "string" || !ticker.trim()) continue;
    const key = ticker.trim().toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ ticker: ticker.trim(), weight: toNonNegative(weight), shares: toNonNegative(shares) });
  }
  return items;
}

/** Read local holdings strictly for backup export, where corruption must not look empty. */
export function loadPortfolioBackup(): LocalPortfolioItem[] {
  if (!globalThis.window) return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return [];

  try {
    return parsePortfolioBackup(JSON.parse(raw));
  } catch {
    throw new Error("Stored portfolio data is corrupted and could not be exported.");
  }
}
