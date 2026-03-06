import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

const isElementVisible = (element) => (
  element instanceof HTMLElement
  && !element.hasAttribute('disabled')
  && element.getAttribute('aria-hidden') !== 'true'
  && element.offsetParent !== null
);

const getFocusableElements = (container) => (
  Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(isElementVisible)
);

export const useFocusTrap = ({
  active,
  containerRef,
  onEscape,
  initialFocusRef,
  restoreFocus = true,
}) => {
  const lastFocusedElementRef = useRef(null);

  useEffect(() => {
    if (!active || !containerRef?.current) return undefined;

    const container = containerRef.current;
    lastFocusedElementRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const focusInitialElement = () => {
      if (initialFocusRef?.current && isElementVisible(initialFocusRef.current)) {
        initialFocusRef.current.focus();
        return;
      }

      const focusable = getFocusableElements(container);
      if (focusable.length > 0) {
        focusable[0].focus();
      } else if (container instanceof HTMLElement) {
        container.setAttribute('tabindex', '-1');
        container.focus();
      }
    };

    focusInitialElement();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (typeof onEscape === 'function') {
          event.preventDefault();
          onEscape();
        }
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = getFocusableElements(container);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey) {
        if (activeElement === first || !container.contains(activeElement)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (activeElement === last || !container.contains(activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);

      if (restoreFocus && isElementVisible(lastFocusedElementRef.current)) {
        lastFocusedElementRef.current.focus();
      }
    };
  }, [active, containerRef, onEscape, initialFocusRef, restoreFocus]);
};

export default useFocusTrap;
