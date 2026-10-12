import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { Reveal } from '../../../core/reveal.directive';

/**
 * The last screen of the home page: the call to start planning. When it scrolls into
 * view (Reveal adds `is-in`) it plays one entrance: two rings draw themselves behind
 * the title and keep turning slowly, the title rises word by word, the account
 * benefits pop in with their ticks drawing, the button arrives last and then glints
 * now and then. The server renders everything visible; nothing moves under reduced
 * motion (Reveal never arms itself there).
 */
@Component({
  selector: 'app-final-call',
  imports: [RouterLink, TranslatePipe, Reveal],
  templateUrl: './final-call.html',
  styleUrl: './final-call.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinalCall {
  /** Where the button goes and its label; follows who is signed in (see Home.heroCta). */
  readonly cta = input.required<{ link: string; key: string }>();

  /** i18n keys: home.trust.get<n> */
  protected readonly gets = ['1', '2', '3'];

  protected words(title: string): string[] {
    return title.split(/\s+/).filter(Boolean);
  }
}
