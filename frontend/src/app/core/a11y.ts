/**
 * Shared modal a11y helpers. Every dialog in the app owes the same contract:
 * focus moves in on open, Tab cycles inside, and focus returns to the trigger
 * on close — these helpers keep the Tab part identical everywhere.
 */

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Visible, tabbable elements inside a container, in DOM order. */
function focusables(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0,
  );
}

/**
 * Keep Tab / Shift+Tab cycling inside `container`. Call from a keydown handler
 * on the dialog (or its overlay); non-Tab keys pass through untouched. If focus
 * somehow left the container, the next Tab pulls it back to an edge element.
 */
export function trapTabKey(container: HTMLElement, event: KeyboardEvent): void {
  if (event.key !== 'Tab') return;

  const items = focusables(container);
  if (items.length === 0) {
    event.preventDefault();
    return;
  }

  const first = items[0];
  const last = items[items.length - 1];
  const active = container.ownerDocument.activeElement;

  if (event.shiftKey) {
    if (active === first || !container.contains(active)) {
      event.preventDefault();
      last.focus();
    }
  } else if (active === last || !container.contains(active)) {
    event.preventDefault();
    first.focus();
  }
}
