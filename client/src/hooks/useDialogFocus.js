import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Focus trap + Escape to close for a mounted dialog. Attach ref to role="dialog" element.
 */
export function useDialogFocus(isActive, onClose) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isActive || typeof onClose !== 'function') return;
    const root = containerRef.current;
    if (!root) return;

    const getFocusable = () =>
      Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );

    const focusables = getFocusable();
    const first = focusables[0];
    const prevActive = document.activeElement;
    if (first) {
      first.focus();
    }

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const list = getFocusable();
      if (list.length === 0) return;
      const f = list[0];
      const l = list[list.length - 1];
      if (!root.contains(document.activeElement)) return;

      if (e.shiftKey) {
        if (document.activeElement === f) {
          e.preventDefault();
          l.focus();
        }
      } else if (document.activeElement === l) {
        e.preventDefault();
        f.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      if (prevActive && typeof prevActive.focus === 'function' && document.body.contains(prevActive)) {
        try {
          prevActive.focus();
        } catch {
          /* ignore */
        }
      }
    };
  }, [isActive, onClose]);

  return containerRef;
}
