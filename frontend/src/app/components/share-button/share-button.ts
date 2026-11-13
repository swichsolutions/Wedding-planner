import { DOCUMENT } from '@angular/common';
import { Component, ElementRef, HostListener, inject, input, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { ToastService } from '../../core/toast.service';

/**
 * „გაზიარება“: one pill button that shares the open page. Where the browser has its own share
 * sheet (phones, most desktops) the button opens it; elsewhere it opens a small menu: copy the
 * link, or share on Facebook. What is shared is the page's clean address, without the visitor's
 * own query (filters, tracking parameters). Everything here runs on a click, so nothing touches
 * the browser during server rendering.
 */
@Component({
  selector: 'app-share-button',
  imports: [TranslatePipe],
  host: { '[class.is-block]': 'block()' },
  template: `
    <button type="button" class="btn btn--ghost share__btn" [attr.aria-expanded]="open() || null" (click)="share()">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 15V4" /><path d="m8 8 4-4 4 4" /><path d="M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
      </svg>
      {{ 'share.label' | translate }}
    </button>
    @if (open()) {
      <div class="share__menu">
        <button type="button" class="share__item" (click)="copy()">{{ 'share.copy' | translate }}</button>
        <a class="share__item" [href]="facebookUrl()" target="_blank" rel="noopener" (click)="open.set(false)">
          {{ 'share.facebook' | translate }}
        </a>
      </div>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: inline-block;
    }

    .share__btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
    }

    // in a column of full-width buttons (the vendor profile's contact rail)
    :host(.is-block) {
      display: block;

      .share__btn {
        width: 100%;
      }
    }

    .share__menu {
      position: absolute;
      z-index: var(--z-dropdown);
      top: calc(100% + var(--space-2));
      left: 0;
      display: grid;
      min-width: max-content;
      padding: var(--space-2);
      border: 1px solid var(--paper-line);
      border-radius: 18px;
      background: var(--paper-white);
      box-shadow: var(--shadow-md);
    }

    .share__item {
      padding: var(--space-2) var(--space-4);
      border: 0;
      border-radius: var(--radius-pill);
      background: none;
      color: var(--ink);
      font: inherit;
      font-size: var(--fs-small);
      line-height: 1.5;
      text-align: left;
      text-decoration: none;
      cursor: pointer;

      &:hover {
        background: var(--paper-deep);
      }

      &:focus-visible {
        outline: none;
        box-shadow: var(--ring);
      }
    }
  `,
})
export class ShareButton {
  private readonly doc = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly toast = inject(ToastService);

  /** What the system share sheet shows next to the link; the page's title when not given. */
  readonly title = input('');
  /** Fill the parent's width, like the buttons around it. */
  readonly block = input(false);

  protected readonly open = signal(false);
  protected readonly facebookUrl = signal('');

  private pageUrl(): string {
    const { origin, pathname } = this.doc.location;
    return origin + pathname;
  }

  protected async share(): Promise<void> {
    const url = this.pageUrl();
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: this.title() || this.doc.title, url });
        return;
      } catch (err) {
        // the visitor closed the sheet: nothing to do. Any other refusal gets the menu.
        if ((err as DOMException)?.name === 'AbortError') return;
      }
    }
    this.facebookUrl.set(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`);
    this.open.update((v) => !v);
  }

  protected async copy(): Promise<void> {
    this.open.set(false);
    try {
      await navigator.clipboard.writeText(this.pageUrl());
      this.toast.success('share.copied');
    } catch {
      this.toast.error('share.copyError');
    }
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: Event): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }

  @HostListener('keydown.escape')
  protected onEscape(): void {
    if (!this.open()) return;
    this.open.set(false);
    this.host.nativeElement.querySelector<HTMLElement>('.share__btn')?.focus();
  }
}
