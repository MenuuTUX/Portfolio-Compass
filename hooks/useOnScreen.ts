import { useEffect, useState, useRef, RefObject } from "react";

export function useOnScreen(
  options?: IntersectionObserverInit,
): [RefObject<HTMLElement | null>, boolean] {
  const ref = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.disconnect(); // Only trigger once
      }
    }, options);

    const element = ref.current;
    if (element) {
      observer.observe(element);
    }

    return () => observer.disconnect();
  }, [options]);

  return [ref, isVisible];
}
