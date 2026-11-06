import { Component, ElementRef, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Meta, Title } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { EMPTY, catchError, concat, defer, last, of, Observable, forkJoin, switchMap } from 'rxjs';

import { safeReturnUrl } from '../../core/auth.service';
import { estimatorEdits } from '../../core/budget';
import { BudgetService, clearGuestBudgetDraft, readGuestBudgetDraft } from '../../core/budget.service';
import { CoupleService } from '../../core/couple.service';
import { focusFirstInvalid } from '../../core/forms';
import { GoldRing } from '../../components/gold-ring/gold-ring';
import { PlanDetailsFields, patchPlanDetails, planDetailsForm, toPlanDetails } from './plan-details-fields';

/**
 * „საწყისი ინფორმაცია“ (guide §3, decision D4): right after the account is made, a short form —
 * names, date, city or region, guests, budget — every answer skippable with „ჯერ არ ვიცი“ or the
 * skip button. Then the overview, or the action that started the sign-up (returnUrl).
 */
@Component({
  selector: 'app-plan-start',
  imports: [ReactiveFormsModule, TranslatePipe, GoldRing, PlanDetailsFields],
  templateUrl: './plan-start.html',
  styleUrl: './plan-start.scss',
  host: { class: 'theme-brand' },
})
export class PlanStart {
  private readonly fb = inject(FormBuilder);
  private readonly couple = inject(CoupleService);
  private readonly budget = inject(BudgetService);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly returnUrl = safeReturnUrl(inject(ActivatedRoute).snapshot.queryParamMap.get('returnUrl'));

  protected readonly form = planDetailsForm(this.fb);
  protected readonly budgetForm = this.fb.group({
    amount: [null as number | null, [Validators.min(0), Validators.max(10_000_000)]],
    unknown: [false],
  });
  protected readonly iAmPartner = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal(false);
  /** The total a guest typed into the public budget estimator before signing up. */
  private readonly draft = isPlatformBrowser(inject(PLATFORM_ID)) ? readGuestBudgetDraft() : null;
  private readonly draftTotal = this.draft?.total ?? null;

  constructor() {
    const t = inject(TranslateService);
    inject(Title).setTitle(`${t.instant('plan.startTitle')} | ${t.instant('brand.name')}`);
    inject(Meta).updateTag({ name: 'robots', content: 'noindex' });

    if (this.draftTotal) this.budgetForm.patchValue({ amount: this.draftTotal });
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      // A Google sign-up already brings the name; anything saved before is shown again.
      this.couple.me().subscribe({
        next: (p) => {
          this.iAmPartner.set(!!p.iAmPartner);
          patchPlanDetails(this.form, p);
          if (p.totalBudget != null) this.budgetForm.patchValue({ amount: p.totalBudget });
        },
        error: () => {},
      });
    }
  }

  protected toggleBudgetUnknown(event: Event): void {
    const unknown = (event.target as HTMLInputElement).checked;
    this.budgetForm.patchValue({ unknown });
    const amount = this.budgetForm.controls.amount;
    if (unknown) {
      amount.setValue(null);
      amount.disable();
    } else {
      amount.enable();
    }
  }

  protected save(): void {
    if (this.form.invalid || this.budgetForm.invalid) {
      this.form.markAllAsTouched();
      this.budgetForm.markAllAsTouched();
      focusFirstInvalid(this.host.nativeElement);
      return;
    }
    this.saving.set(true);
    this.error.set(false);
    const amount = this.budgetForm.getRawValue().amount;
    const total = amount != null && amount > 0 ? amount : null;
    // Details first, then the total (the budget tool reseeds its split from it).
    concat(
      this.couple.update(toPlanDetails(this.form)),
      defer(() => (total != null ? this.applyTotal(total) : of(null))),
    )
      .pipe(last())
      .subscribe({
        next: () => this.continue(),
        error: () => {
          this.saving.set(false);
          this.error.set(true);
        },
      });
  }

  /** Nothing now — but a total typed into the public estimator before signing up isn't lost. */
  protected skip(): void {
    if (this.draftTotal) {
      this.saving.set(true);
      this.applyTotal(this.draftTotal)
        .pipe(catchError(() => EMPTY))
        .subscribe({ complete: () => this.continue() });
      return;
    }
    this.continue();
  }

  /** Sets the total and, if it's the one from the public estimator, the row amounts changed there. */
  private applyTotal(total: number): Observable<unknown> {
    const amounts = total === this.draftTotal ? this.draft?.amounts : undefined;
    return this.budget.updateTotal(total, true).pipe(
      // asked again: the rows may only just have been created
      switchMap((saved) => (amounts ? this.budget.get() : of(saved))),
      switchMap((budget) => {
        const updates = (amounts ? estimatorEdits(total, amounts) : []).flatMap((edit) => {
          const item = budget.items.find((i) => i.categorySlug === edit.slug);
          if (!item) return [];
          return [
            this.budget
              .updateItem(item.id, {
                name: item.name,
                vendorId: item.vendor?.id ?? null,
                merchantName: item.merchantName,
                estimate: edit.estimate,
                actualCost: item.actualCost,
                note: item.note,
                reminderDate: item.reminderDate ?? null,
              })
              .pipe(catchError(() => of(null))),
          ];
        });
        return updates.length ? forkJoin(updates) : of(budget);
      }),
    );
  }

  private continue(): void {
    clearGuestBudgetDraft();
    void this.router.navigateByUrl(this.returnUrl ?? '/planning');
  }
}
