import { Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import {
  AdminService,
  ImportIssue,
  VendorImportReport,
  VendorImportRow,
} from '../../core/admin.service';
import { categoryKey } from '../../core/catalog';

/**
 * Admin → Import: loads the vendor collection spreadsheet (BUILD-PLAN A3,
 * design-system/templates/vendor-collection.xlsx). Choosing a file checks it first and shows what
 * every row would do; nothing is written until the admin confirms. Photos aren't in the file:
 * each imported vendor's row links to its editor, where they're added.
 */
@Component({
  selector: 'app-admin-import',
  imports: [TranslatePipe, RouterLink],
  templateUrl: './admin-import.html',
  styleUrl: './admin-import.scss',
})
export class AdminImport {
  private readonly admin = inject(AdminService);
  private readonly t = inject(TranslateService);

  protected readonly file = signal<File | null>(null);
  protected readonly publish = signal(false);
  protected readonly busy = signal(false);
  protected readonly report = signal<VendorImportReport | null>(null);
  /** A failure with no report to show (offline, 500, file over the server's limit). */
  protected readonly failed = signal<'tooLarge' | 'error' | null>(null);

  /** Rows that a confirmed import would write. */
  protected readonly writable = computed(() => {
    const r = this.report();
    return r && !r.applied ? r.created + r.updated : 0;
  });

  protected onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = ''; // the same file can be chosen again after it's fixed
    this.file.set(file);
    if (file) this.run(false);
  }

  protected recheck(): void {
    if (this.file()) this.run(false);
  }

  protected confirm(): void {
    if (this.file() && this.writable() > 0) this.run(true);
  }

  private run(apply: boolean): void {
    const file = this.file();
    if (!file || this.busy()) return;
    this.busy.set(true);
    this.failed.set(null);
    if (!apply) this.report.set(null);
    this.admin.importVendors(file, apply, this.publish()).subscribe({
      next: (r) => {
        this.report.set(r);
        this.busy.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(false);
        // A file-level problem comes back as a 400 with the report (fileErrors filled in).
        if (err.status === 400 && err.error?.fileErrors) this.report.set(err.error as VendorImportReport);
        else this.failed.set(err.status === 413 ? 'tooLarge' : 'error');
      },
    });
  }

  protected issueText(issue: ImportIssue): string {
    return this.t.instant(`adminImport.issue.${issue.code}`, {
      column: issue.column ?? '',
      value: issue.value ?? '',
    });
  }

  protected actionKey(row: VendorImportRow, applied: boolean): string {
    return `adminImport.${applied ? 'done' : 'plan'}.${row.action}`;
  }

  protected catKey(slug: string | null): string {
    return slug ? categoryKey(slug) : '';
  }
}
