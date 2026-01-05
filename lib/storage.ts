import { z } from "zod";

/**
 * Local Storage Management for Portfolio
 * Implements Local-First architecture.
 */

export const LocalPortfolioItemSchema = z.object({
  ticker: z.string(),
  weight: z.number(),
  shares: z.number(),
});

export type LocalPortfolioItem = z.infer<typeof LocalPortfolioItemSchema>;

export const LocalPortfolioSchema = z.array(LocalPortfolioItemSchema);

const STORAGE_KEY = "portfolio_compass_v1";

export function savePortfolio(items: LocalPortfolioItem[]) {
  if (typeof window === "undefined") return;

  // Validate schema - will throw ZodError if invalid
  const validItems = LocalPortfolioSchema.parse(items);

  // Save to storage - will throw if quota exceeded
  localStorage.setItem(STORAGE_KEY, JSON.stringify(validItems));
}

export function loadPortfolio(): LocalPortfolioItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    const result = LocalPortfolioSchema.safeParse(parsed);

    if (result.success) {
      return result.data;
    } else {
      console.warn("Local portfolio data corrupted, resetting:", result.error);
      return [];
    }
  } catch (error) {
    console.error("Failed to load portfolio from local storage:", error);
    return [];
  }
}
