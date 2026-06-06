import { useEffect } from 'react';

/**
 * Listens for ← / → arrow keys at window level and calls the matching callback.
 * Skips when focus is in an input/textarea/select/contenteditable, or when
 * modifier keys are pressed.
 */
export function useArrowKeyNav(onLeft: () => void, onRight: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (target?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onLeft();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onRight();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onLeft, onRight]);
}
