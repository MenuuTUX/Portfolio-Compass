import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const openDialogs = new Set<HTMLElement>();

/**
 * Keeps keyboard users inside an open dialog and returns focus to the trigger
 * when the dialog closes. This is intentionally small so existing overlays
 * can share the same behavior without introducing a dialog dependency.
 */
export function useDialogA11y<T extends HTMLElement>(
  isOpen: boolean,
  onClose: () => void,
) {
  const dialogRef = useRef<T>(null);

  // Callers pass a new onClose on every render. Keep the latest one in a ref
  // so re-renders do not re-run the effect and move focus back to the first control.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;

    if (!dialog) return;
    openDialogs.add(dialog);

    const focusable = () =>
      Array.from(dialog?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []);

    const focusFrame = requestAnimationFrame(() => {
      focusable()[0]?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (Array.from(openDialogs).at(-1) !== dialog) return;

      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;

      const elements = focusable();
      if (elements.length === 0) {
        event.preventDefault();
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      openDialogs.delete(dialog);
      previousFocus?.focus();
    };
  }, [isOpen]);

  return dialogRef;
}
