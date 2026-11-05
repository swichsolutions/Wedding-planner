import { Component, input } from '@angular/core';

import { DayIcon as DayIconName } from '../../core/day-schedules';

/** Line icons for the wedding-day views: one glyph per kind of moment (core/day-schedules). */
@Component({
  selector: 'app-day-icon',
  host: { class: 'day-icon' },
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      @switch (name()) {
        @case ('mirror') { <circle cx="12" cy="8.5" r="5" /><path d="M12 13.5V21M9 21h6" /> }
        @case ('camera') { <path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /> }
        @case ('people') { <circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="17" cy="9" r="2.5" /><path d="M15.5 14.5A5 5 0 0 1 22 19.5" /> }
        @case ('rings') { <circle cx="9" cy="13.5" r="5.5" /><circle cx="15" cy="13.5" r="5.5" /><path d="m15 3 1.8 2.5h-3.6z" /> }
        @case ('car') { <path d="M3 13l2-5h14l2 5v5H3z" /><path d="M3 13h18" /><circle cx="7.5" cy="18" r="1.5" /><circle cx="16.5" cy="18" r="1.5" /> }
        @case ('glasses') { <path d="M6 3h4l-.6 7.5a1.4 1.4 0 0 1-2.8 0z" /><path d="M8 12v7M6 19h4" /><path d="M14 3h4l-.6 7.5a1.4 1.4 0 0 1-2.8 0z" /><path d="M16 12v7M14 19h4" /> }
        @case ('music') { <path d="M9 18V6l10-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="16.5" cy="16" r="2.5" /> }
        @case ('cake') { <path d="M4 20h16v-5.5a2.5 2.5 0 0 0-2.5-2.5h-11A2.5 2.5 0 0 0 4 14.5z" /><path d="M4 16c2 1.6 4 1.6 6 0s4-1.6 6 0 4 1.6 4 0" /><path d="M12 12V8.5" /><path d="M12 6.5c-.9-.9.9-2.1 0-3" /> }
        @case ('moon') { <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /> }
        @case ('door') { <path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17" /><path d="M3 21h18" /><circle cx="15" cy="12" r="1" /> }
        @case ('home') { <path d="m3 11 9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /> }
        @case ('church') { <path d="M12 2.5v4M10 4.5h4" /><path d="M6 21v-9l6-5 6 5v9" /><path d="M3 21h18" /><path d="M10 21v-5h4v5" /> }
        @case ('arch') { <path d="M5 21V11a7 7 0 0 1 14 0v10" /><path d="M3 21h18" /><path d="M9 21v-4h6v4" /> }
        @default { <circle cx="12" cy="12" r="3" /> }
      }
    </svg>
  `,
  styles: `
    :host { display: inline-grid; place-items: center; width: 1em; height: 1em; }
    svg { width: 100%; height: 100%; }
  `,
})
export class DayIcon {
  readonly name = input.required<DayIconName>();
}
