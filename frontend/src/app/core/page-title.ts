import { inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { TranslateService } from '@ngx-translate/core';

/**
 * Sets the tab title to "<the key's text> | <brand>" and writes it again whenever the language
 * changes. For pages the language switch leaves open because they hold a half-filled form (see
 * App.redrawPublicPage): nothing reopens them, so their title has to follow on its own.
 * Call from a constructor.
 */
export function pageTitle(key: string): void {
  const t = inject(TranslateService);
  const title = inject(Title);
  const set = () => title.setTitle(`${t.instant(key)} | ${t.instant('brand.name')}`);
  set();
  t.onLangChange.pipe(takeUntilDestroyed()).subscribe(set);
}
