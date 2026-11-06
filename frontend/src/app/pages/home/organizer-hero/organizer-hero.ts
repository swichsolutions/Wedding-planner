import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { ClipVideo } from '../../../components/clip-video/clip-video';

/**
 * "როგორ ვაკონტროლო ყველაფერი?" — the personal-organizer block of the home page: copy
 * on the left, a tilted phone on the right playing a looping clip of the real planning tool.
 */
@Component({
  selector: 'app-organizer-hero',
  imports: [RouterLink, TranslatePipe, ClipVideo],
  templateUrl: './organizer-hero.html',
  styleUrl: './organizer-hero.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizerHero {}
