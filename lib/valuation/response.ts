import type { DcfInputs } from "./dcf";
import type { Described } from "./summarize";

/** What /api/stock/dcf sends. Inputs travel with the answer so the panel can re-solve when the user edits one. */
export type DcfResponse =
  | {
      status: "ok";
      ticker: string;
      name: string | null;
      price: number;
      priceAsOf: string | null;
      fiscalYearEnd: string;
      /** Primary answer: return on new capital from the company's own history. */
      inputs: DcfInputs;
      /** Same model with return on new capital equal to the cost of capital (growth adds no value). */
      neutralInputs: DcfInputs;
      headline: Described;
      neutral: Described;
      impliedReturn: string | null;
      rows: { label: string; value: string; note: string }[];
      warnings: string[];
    }
  | { status: "refused"; ticker: string; reasons: string[] };
