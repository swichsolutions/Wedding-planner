import { DOCUMENT, Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';

import { DEFAULT_LANG, LANG_STORAGE_KEY, LangCode, SUPPORTED_LANGS } from './languages';

/**
 * Owns the active UI language: applies it to ngx-translate, persists the choice in the
 * browser, and keeps <html lang="…"> in sync (accessibility + SEO).
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly current = signal<LangCode>(DEFAULT_LANG);
  readonly supported = SUPPORTED_LANGS;

  /** Called once at app startup. Picks the stored language, else the default. */
  init(): void {
    const stored = this.isBrowser
      ? (localStorage.getItem(LANG_STORAGE_KEY) as LangCode | null)
      : null;
    const lang = stored && this.isSupported(stored) ? stored : DEFAULT_LANG;
    this.translate.addLangs(SUPPORTED_LANGS.map((l) => l.code));
    this.use(lang);
  }

  use(lang: LangCode): void {
    if (!this.isSupported(lang)) return;
    this.translate.use(lang);
    this.current.set(lang);
    this.document.documentElement.lang = lang;
    if (this.isBrowser) {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    }
  }

  private isSupported(lang: string): lang is LangCode {
    return SUPPORTED_LANGS.some((l) => l.code === lang);
  }
}
