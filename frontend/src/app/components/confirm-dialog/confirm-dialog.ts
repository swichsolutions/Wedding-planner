import { Component, ElementRef, PLATFORM_ID, effect, inject, viewChild } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';

import { ConfirmService } from '../../core/confirm.service';
import { trapTabKey } from '../../core/a11y';

/**
 * The app's single confirmation dialog, driven by ConfirmService. Rendered once
 * in the app root; pages never embed their own confirm UI.
 */
@Component({
  selector: 'app-confirm-dialog',
  imports: [TranslatePipe],
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.scss',
  host: { '(document:keydown.escape)': 'onEscape($event)' },
})
export class ConfirmDialog {
  protected readonly svc = inject(ConfirmService);
  private readonly cancelBtn = viewChild<ElementRef<HTMLButtonElement>>('cancelBtn');
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Whatever had focus when the confirm opened — focus returns there on settle. */
  private trigger: HTMLElement | null = null;
  /**
   * The confirm can open on top of another dialog that already owns the body
   * scroll lock — save and restore the previous overflow value instead of
   * blindly resetting to '', or settling would unlock the dialog underneath.
   */
  private prevOverflow = '';
  private wasOpen = false;

  constructor() {
    // Move focus into the dialog when it opens; cancel is the safe default.
    // (Re-runs when the viewChild resolves after the @if renders.)
    effect(() => {
      if (this.svc.request()) this.cancelBtn()?.nativeElement.focus();
    });

    // Open/close transitions: capture the trigger + lock scroll, then undo both.
    effect(() => {
      const open = !!this.svc.request();
      if (!this.isBrowser || open === this.wasOpen) return;
      this.wasOpen = open;
      if (open) {
        this.trigger = document.activeElement as HTMLElement | null;
        this.prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = this.prevOverflow;
        const trigger = this.trigger;
        this.trigger = null;
        if (trigger?.isConnected) {
          trigger.focus();
        } else {
          // A confirmed delete usually removes the triggering button from the
          // DOM — focusing a disconnected node silently drops focus to <body>.
          // Land on the main landmark instead (it carries tabindex="-1").
          document.getElementById('main')?.focus();
        }
      }
    });
  }

  /** Keep Tab cycling inside the dialog (the overlay wraps the panel). */
  protected onKeydown(event: KeyboardEvent): void {
    trapTabKey(event.currentTarget as HTMLElement, event);
  }

  protected onEscape(event: Event): void {
    if (!this.svc.request()) return;
    // Topmost layer owns this Esc: without this, page-level document listeners
    // (e.g. the budget planner's) fire on the same press and also close the
    // popup underneath the confirm.
    event.stopImmediatePropagation();
    this.svc.settle(false);
  }

  protected onOverlay(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.svc.settle(false);
  }
}
