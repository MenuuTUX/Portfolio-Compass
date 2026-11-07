import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Class-name helper. Kept apart from lib/utils.ts so importing it does not pull in decimal.js. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
