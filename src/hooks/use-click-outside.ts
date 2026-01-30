import { useEffect, useRef } from "react";

export function useClickOutside<T extends HTMLElement>(
  callback: () => void
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    function handleEvent(event: PointerEvent) {
      const el = ref.current;
      if (!el) return;

      if (!el.contains(event.target as Node)) {
        callback();
      }
    }

    // pointer = mouse + touch + pen (modern, universal)
    document.addEventListener("pointerdown", handleEvent);

    return () => {
      document.removeEventListener("pointerdown", handleEvent);
    };
  }, [callback]); // ✅ only real dependency

  return ref;
}
