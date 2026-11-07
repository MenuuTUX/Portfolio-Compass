import type { ETF } from "@/schemas/assetSchema";

export type { ETF };

export type PortfolioItem = ETF & {
  weight: number;
  shares: number;
};

export type Portfolio = PortfolioItem[];
