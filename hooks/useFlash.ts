import { useCallback, useState } from "react";
import { useLater } from "@/hooks/useLater";

type FlashState = "success" | "error" | null;

const FLASH_MS = 500;

/** Per-ticker success/error flash that clears itself; pending timers are dropped on unmount. */
export function useFlash() {
  const [flashStates, setFlashStates] = useState<Record<string, FlashState>>({});
  const later = useLater();

  const triggerFlash = useCallback((ticker: string, type: "success" | "error") => {
    setFlashStates((prev) => ({ ...prev, [ticker]: type }));
    later(() => setFlashStates((prev) => ({ ...prev, [ticker]: null })), FLASH_MS);
  }, [later]);

  return { flashStates, triggerFlash };
}
