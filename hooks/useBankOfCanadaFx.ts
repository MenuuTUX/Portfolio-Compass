import { useQuery } from "@tanstack/react-query";
import type { BankOfCanadaFxRate } from "@/lib/math/portfolio-returns";

interface ValetResponse {
  observations?: { d?: string; FXUSDCAD?: { v?: string } }[];
}

export function selectLatestBankOfCanadaFx(
  observations: NonNullable<ValetResponse["observations"]>,
): BankOfCanadaFxRate | null {
  const latest = observations
    .filter((row) => row.d && /^\d{4}-\d{2}-\d{2}$/.test(row.d) &&
      Number.isFinite(Number(row.FXUSDCAD?.v)) && Number(row.FXUSDCAD?.v) > 0)
    .sort((a, b) => b.d!.localeCompare(a.d!))[0];
  return latest ? { usdCad: Number(latest.FXUSDCAD!.v), date: latest.d! } : null;
}

export function useBankOfCanadaFx(enabled = true) {
  return useQuery<BankOfCanadaFxRate>({
    queryKey: ["bank-of-canada-fx", "FXUSDCAD"],
    enabled,
    queryFn: async () => {
      const response = await fetch(
        "https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json?recent=10",
      );
      if (!response.ok) throw new Error("Bank of Canada FX request failed");
      const data = await response.json() as ValetResponse;
      const rate = selectLatestBankOfCanadaFx(data.observations ?? []);
      if (!rate) throw new Error("Bank of Canada FX rate unavailable");
      return rate;
    },
    staleTime: 6 * 60 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}
