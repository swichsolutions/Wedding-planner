import { Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { ToastService } from '../../core/toast.service';

/** The app's toast stack — rendered once in the app root, fed by ToastService. */
@Component({
  selector: 'app-toasts',
  imports: [TranslatePipe],
  templateUrl: './toasts.html',
  styleUrl: './toasts.scss',
})
export class Toasts {
  protected readonly svc = inject(ToastService);
}
