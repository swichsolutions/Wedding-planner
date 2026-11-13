import { Component, computed, inject, input, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { ToastService } from '../../../core/toast.service';
import {
  BADGE_HEIGHT,
  BADGE_WIDTH,
  BadgeLang,
  BadgeTheme,
  BadgeVendor,
  badgePath,
  badgeSnippet,
  profileUrl,
} from './badge-snippet';

/**
 * „ბეჯი შენი ვებსაიტისთვის": the overview's block where an approved vendor picks a badge (light or
 * dark, Georgian or English) and copies the HTML that puts it on their own site, or just the
 * profile's address for places that take no images (an Instagram bio, Linktree). Until the profile
 * is approved it isn't public, so there is nothing to link to yet: one muted line says so.
 */
@Component({
  selector: 'app-site-badge',
  imports: [TranslatePipe],
  templateUrl: './site-badge.html',
  styleUrl: './site-badge.scss',
})
export class SiteBadge {
  private readonly toast = inject(ToastService);

  readonly vendor = input.required<BadgeVendor>();
  readonly approved = input(false);

  protected readonly themes: BadgeTheme[] = ['light', 'dark'];
  protected readonly langs: BadgeLang[] = ['ka', 'en'];
  protected readonly width = BADGE_WIDTH;
  protected readonly height = BADGE_HEIGHT;

  protected readonly lang = signal<BadgeLang>('ka');
  protected readonly theme = signal<BadgeTheme>('light');

  protected readonly url = computed(() => profileUrl(this.vendor()));
  protected readonly snippet = computed(() => badgeSnippet(this.vendor(), this.lang(), this.theme()));
  protected readonly src = (theme: BadgeTheme) => badgePath(this.lang(), theme);

  protected copyCode(): Promise<void> {
    return this.copy(this.snippet(), 'dash.badgeCopied');
  }

  protected copyLink(): Promise<void> {
    return this.copy(this.url(), 'dash.badgeLinkCopied');
  }

  /** Select the whole field on focus, so copying by hand is one keystroke when the clipboard is refused. */
  protected selectAll(event: Event): void {
    (event.target as HTMLInputElement | HTMLTextAreaElement).select();
  }

  private async copy(text: string, done: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.toast.success(done);
    } catch {
      this.toast.error('dash.badgeCopyError');
    }
  }
}
