import { useCallback, useEffect, useRef, useState } from "react";

type FlashState = "success" | "error" | null;

const FLASH_MS = 500;

/** Per-ticker success/error flash that clears itself; pending timers are dropped on unmount. */
export function useFlash() {
  const [flashStates, setFlashStates] = useState<Record<string, FlashState>>({});
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  const triggerFlash = useCallback((ticker: string, type: "success" | "error") => {
    setFlashStates((prev) => ({ ...prev, [ticker]: type }));
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setFlashStates((prev) => ({ ...prev, [ticker]: null }));
    }, FLASH_MS);
    timers.current.add(timer);
  }, []);

  return { flashStates, triggerFlash };
}
