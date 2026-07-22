import { Component, ElementRef, effect, inject, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { ConfirmService } from '../../core/confirm.service';

/**
 * The app's single confirmation dialog, driven by ConfirmService. Rendered once
 * in the app root; pages never embed their own confirm UI.
 */
@Component({
  selector: 'app-confirm-dialog',
  imports: [TranslatePipe],
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.scss',
  host: { '(document:keydown.escape)': 'onEscape()' },
})
export class ConfirmDialog {
  protected readonly svc = inject(ConfirmService);
  private readonly cancelBtn = viewChild<ElementRef<HTMLButtonElement>>('cancelBtn');

  constructor() {
    // Move focus into the dialog when it opens; cancel is the safe default.
    effect(() => {
      if (this.svc.request()) this.cancelBtn()?.nativeElement.focus();
    });
  }

  protected onEscape(): void {
    if (this.svc.request()) this.svc.settle(false);
  }

  protected onOverlay(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.svc.settle(false);
  }
}
