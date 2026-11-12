import {
  Component,
  ElementRef,
  Injector,
  PLATFORM_ID,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';

import {
  AdminContent as AdminContentPage,
  AdminContentRow,
  AdminContentService,
  ContentCredit,
  SaveContent,
} from '../../core/admin-content.service';
import {
  CONTENT_KINDS,
  CONTENT_TOPICS,
  ContentKind,
  ContentPhoto,
  LEGAL_SLUGS,
} from '../../core/content.models';
import { AdminService, AdminVendor } from '../../core/admin.service';
import { CATEGORIES } from '../../core/catalog';
import { ConfirmService } from '../../core/confirm.service';
import { formatDate } from '../../core/dates';
import { focusFirstInvalid } from '../../core/forms';
import { renderMarkdown } from '../../core/markdown';
import { ToastService } from '../../core/toast.service';
import { LanguageService } from '../../i18n/language.service';
import ka from '../../i18n/ka.json';
import en from '../../i18n/en.json';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Ready-made "related action" buttons. Labels are page content, so both languages are stored. */
interface ActionPreset {
  id: string;
  path: string;
  labelKa: string;
  labelEn: string;
}

const TOOL_PRESETS: ActionPreset[] = [
  { id: 'tool:schedules', path: '/schedules', labelKa: 'ნახე განრიგის შაბლონები', labelEn: 'See schedule templates' },
  { id: 'tool:invitation', path: '/invitations', labelKa: 'შექმენი შენი მოსაწვევი', labelEn: 'Create your invitation' },
  { id: 'tool:budget', path: '/budget', labelKa: 'დაგეგმე ბიუჯეტი', labelEn: 'Plan your budget' },
  { id: 'tool:guests', path: '/guests', labelKa: 'შეადგინე სტუმრების სია', labelEn: 'Build your guest list' },
  { id: 'tool:seating', path: '/seating', labelKa: 'დაგეგმე დასხდომა', labelEn: 'Plan the seating' },
  { id: 'tool:planning', path: '/planning', labelKa: 'დაიწყე დაგეგმვა', labelEn: 'Start planning' },
];

type CategoryNames = Record<string, string>;
const CATEGORY_PRESETS: ActionPreset[] = CATEGORIES.map((c) => {
  const key = c.key.split('.')[1];
  return {
    id: `cat:${c.slug}`,
    path: `/vendors?category=${c.slug}`,
    labelKa: `ნახე: ${(ka.category as CategoryNames)[key] ?? c.slug}`,
    labelEn: `See: ${(en.category as CategoryNames)[key] ?? c.slug}`,
  };
});

/**
 * Admin content editor: articles, inspiration ideas, real weddings and the legal pages.
 * Lives as the "Content" tab of /admin. Browser-only (the token lives in localStorage).
 */
@Component({
  selector: 'app-admin-content',
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './admin-content.html',
  styleUrl: './admin-content.scss',
})
export class AdminContent {
  private readonly api = inject(AdminContentService);
  private readonly adminApi = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly lang = inject(LanguageService);
  private readonly fb = inject(FormBuilder);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly injector = inject(Injector);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly kinds = CONTENT_KINDS;
  protected readonly legalSlugs = LEGAL_SLUGS;
  protected readonly toolPresets = TOOL_PRESETS;
  protected readonly categoryPresets = CATEGORY_PRESETS;

  // ---- list ----
  protected readonly rows = signal<AdminContentRow[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly filter = signal<ContentKind | 'all'>('all');
  protected readonly visibleRows = computed(() => {
    const f = this.filter();
    return f === 'all' ? this.rows() : this.rows().filter((r) => r.type === f);
  });

  // ---- editor ----
  protected readonly editing = signal(false);
  /** The saved page being edited; null while creating a new one. */
  protected readonly current = signal<AdminContentPage | null>(null);
  protected readonly photos = signal<ContentPhoto[]>([]);
  protected readonly vendors = signal<AdminVendor[]>([]);
  protected readonly saving = signal(false);
  protected readonly uploading = signal(0);
  /** i18n key of the last save error, or null. */
  protected readonly errorKey = signal<string | null>(null);
  protected readonly attempted = signal(false);
  protected readonly previewKa = signal(false);
  protected readonly previewEn = signal(false);
  /** Mirrors the form's type control so topic/section logic can be computed. */
  protected readonly kind = signal<ContentKind>('article');
  protected readonly topics = computed(() => CONTENT_TOPICS[this.kind()]);

  protected readonly form = this.fb.nonNullable.group({
    type: ['article' as ContentKind, Validators.required],
    titleKa: ['', [Validators.required, Validators.maxLength(300)]],
    titleEn: ['', Validators.maxLength(300)],
    slug: ['', [Validators.maxLength(120), Validators.pattern(SLUG_RE)]],
    topic: [''],
    excerptKa: ['', Validators.maxLength(500)],
    excerptEn: ['', Validators.maxLength(500)],
    bodyKa: [''],
    bodyEn: [''],
    metaDescriptionKa: ['', Validators.maxLength(320)],
    metaDescriptionEn: ['', Validators.maxLength(320)],
    actionPreset: [''],
    actionPath: ['', Validators.maxLength(300)],
    actionLabelKa: ['', Validators.maxLength(80)],
    actionLabelEn: ['', Validators.maxLength(80)],
    consentNote: ['', Validators.maxLength(500)],
    isPublished: [false],
    credits: this.fb.array<FormGroup>([]),
  });

  constructor() {
    if (this.isBrowser) {
      this.load();
      this.adminApi.listVendors(false).subscribe({ next: (v) => this.vendors.set(v), error: () => {} });
    }

    this.form.controls.type.valueChanges.subscribe((type) => {
      this.kind.set(type);
      // A topic or slug that doesn't belong to the new type is cleared.
      const topic = this.form.controls.topic.value;
      if (topic && !CONTENT_TOPICS[type].includes(topic)) this.form.controls.topic.setValue('');
      if (type === 'legal' && !LEGAL_SLUGS.includes(this.form.controls.slug.value)) {
        this.form.controls.slug.setValue(LEGAL_SLUGS[0]);
      }
    });

    this.form.controls.actionPreset.valueChanges.subscribe((id) => this.applyPreset(id));
  }

  protected get credits(): FormArray<FormGroup> {
    return this.form.controls.credits;
  }

  // ---------------------------------------------------------------- list

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.api.list().subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }

  protected formatDate(iso: string | null): string {
    return formatDate(iso, this.lang.current(), 'medium');
  }

  protected startNew(type: ContentKind): void {
    this.current.set(null);
    this.photos.set([]);
    this.resetForm();
    this.form.controls.type.setValue(type);
    this.kind.set(type);
    if (type === 'legal') this.form.controls.slug.setValue(LEGAL_SLUGS[0]);
    this.form.markAsPristine();
    this.openEditor();
  }

  protected open(row: AdminContentRow): void {
    this.api.get(row.id).subscribe({
      next: (page) => {
        this.fill(page);
        this.openEditor();
      },
      error: () => this.toast.error('adminContent.errors.generic'),
    });
  }

  protected async back(): Promise<void> {
    if (!(await this.confirmDiscard())) return;
    this.editing.set(false);
    this.load();
  }

  /** Before the editor goes away ("Back", or the admin page switching tabs): true when nothing is
   * unsaved, or the admin agrees to drop it. */
  async confirmDiscard(): Promise<boolean> {
    if (!this.editing() || !this.form.dirty) return true;
    return this.confirm.confirm({
      title: 'adminContent.discardTitle',
      body: 'adminContent.discardBody',
      confirmLabel: 'adminContent.discard',
      danger: true,
    });
  }

  // ---------------------------------------------------------------- save / delete

  protected save(): void {
    if (this.form.invalid) {
      this.attempted.set(true);
      this.form.markAllAsTouched();
      focusFirstInvalid(this.host.nativeElement);
      return;
    }
    this.saving.set(true);
    this.errorKey.set(null);
    const body = this.toSave();
    const existing = this.current();
    const request = existing ? this.api.update(existing.id, body) : this.api.create(body);
    request.subscribe({
      next: (page) => {
        this.saving.set(false);
        this.attempted.set(false);
        this.fill(page);
        this.toast.success('adminContent.saved');
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.errorKey.set(this.errorFor(err));
      },
    });
  }

  protected async remove(): Promise<void> {
    const page = this.current();
    if (!page) return;
    const ok = await this.confirm.confirm({
      title: 'adminContent.deleteTitle',
      detail: page.titleKa,
      body: 'adminContent.deleteBody',
      confirmLabel: 'adminContent.deletePage',
      danger: true,
    });
    if (!ok) return;
    this.api.delete(page.id).subscribe({
      next: () => {
        this.toast.success('adminContent.deleted');
        this.form.markAsPristine();
        this.editing.set(false);
        this.load();
      },
      error: () => this.toast.error('adminContent.errors.generic'),
    });
  }

  // ---------------------------------------------------------------- credits

  protected addCredit(credit?: ContentCredit): void {
    this.credits.push(
      this.fb.nonNullable.group({
        vendorId: [credit?.vendorId != null ? String(credit.vendorId) : ''],
        name: [credit?.name ?? '', Validators.maxLength(200)],
        roleKa: [credit?.roleKa ?? '', [Validators.required, Validators.maxLength(80)]],
        roleEn: [credit?.roleEn ?? '', Validators.maxLength(80)],
      }),
    );
    this.form.markAsDirty();
  }

  protected removeCredit(i: number): void {
    this.credits.removeAt(i);
    this.form.markAsDirty();
  }

  protected moveCredit(i: number, delta: number): void {
    const j = i + delta;
    if (j < 0 || j >= this.credits.length) return;
    const ctrl = this.credits.at(i);
    this.credits.removeAt(i);
    this.credits.insert(j, ctrl);
    this.form.markAsDirty();
  }

  /** Picking a platform vendor fills an empty name with theirs. */
  protected onCreditVendor(i: number): void {
    const group = this.credits.at(i);
    const id = Number(group.value.vendorId);
    const vendor = this.vendors().find((v) => v.id === id);
    if (vendor && !group.value.name) group.patchValue({ name: vendor.name });
  }

  // ---------------------------------------------------------------- photos

  protected async upload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const page = this.current();
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!page || files.length === 0) return;

    // One at a time keeps the order the admin picked them in.
    for (const file of files) {
      this.uploading.update((n) => n + 1);
      await new Promise<void>((resolve) => {
        this.api.uploadPhoto(page.id, file).subscribe({
          next: (photo) => {
            this.photos.update((list) => [...list, photo]);
            resolve();
          },
          error: (err: HttpErrorResponse) => {
            this.toast.error(this.errorFor(err));
            resolve();
          },
        });
      });
      this.uploading.update((n) => n - 1);
    }
  }

  protected saveAlt(photo: ContentPhoto, altKa: string, altEn: string): void {
    const page = this.current();
    const ka = altKa.trim();
    const en = altEn.trim() || null;
    if (!page || !ka || (ka === photo.altKa && en === photo.altEn)) return;
    this.api.updatePhoto(page.id, photo.id, ka, en).subscribe({
      next: () =>
        this.photos.update((list) => list.map((p) => (p.id === photo.id ? { ...p, altKa: ka, altEn: en } : p))),
      error: () => this.toast.error('adminContent.errors.generic'),
    });
  }

  protected movePhoto(i: number, delta: number): void {
    const page = this.current();
    const list = [...this.photos()];
    const j = i + delta;
    if (!page || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    const previous = this.photos();
    this.photos.set(list);
    this.api.reorderPhotos(page.id, list.map((p) => p.id)).subscribe({
      error: () => {
        this.photos.set(previous);
        this.toast.error('adminContent.errors.generic');
      },
    });
  }

  protected async deletePhoto(photo: ContentPhoto): Promise<void> {
    const page = this.current();
    if (!page) return;
    const ok = await this.confirm.confirm({
      title: 'adminContent.photoDeleteTitle',
      confirmLabel: 'adminContent.photoDelete',
      danger: true,
    });
    if (!ok) return;
    this.api.deletePhoto(page.id, photo.id).subscribe({
      next: () => this.photos.update((list) => list.filter((p) => p.id !== photo.id)),
      error: (err: HttpErrorResponse) => this.toast.error(this.errorFor(err)),
    });
  }

  /** Put a Markdown image at the cursor in the Georgian text. */
  protected insertPhoto(photo: ContentPhoto): void {
    const area = this.host.nativeElement.querySelector('#ac-body-ka') as HTMLTextAreaElement | null;
    const ctrl = this.form.controls.bodyKa;
    const text = ctrl.value;
    const at = area && !this.previewKa() ? area.selectionStart : text.length;
    const snippet = `\n\n![${photo.altKa.replace(/[[\]]/g, '')}](${photo.url})\n\n`;
    ctrl.setValue(text.slice(0, at) + snippet + text.slice(at));
    ctrl.markAsDirty();
    this.previewKa.set(false);
  }

  // ---------------------------------------------------------------- view helpers

  protected preview(lang: 'ka' | 'en'): string {
    return renderMarkdown(lang === 'ka' ? this.form.controls.bodyKa.value : this.form.controls.bodyEn.value);
  }

  protected showError(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (this.attempted() || c.touched);
  }

  // ---------------------------------------------------------------- internals

  private openEditor(): void {
    this.errorKey.set(null);
    this.attempted.set(false);
    this.previewKa.set(false);
    this.previewEn.set(false);
    this.editing.set(true);
    // After the editor has rendered (a microtask runs before the @if swaps it in).
    afterNextRender(
      () => (this.host.nativeElement.querySelector('#ac-title-ka') as HTMLElement | null)?.focus(),
      { injector: this.injector },
    );
  }

  private resetForm(): void {
    this.credits.clear();
    this.form.reset();
  }

  private fill(page: AdminContentPage): void {
    this.current.set(page);
    this.photos.set(page.photos);
    this.kind.set(page.type);
    this.credits.clear();
    this.form.reset(
      {
        type: page.type,
        titleKa: page.titleKa,
        titleEn: page.titleEn ?? '',
        slug: page.slug,
        topic: page.topic ?? '',
        excerptKa: page.excerptKa ?? '',
        excerptEn: page.excerptEn ?? '',
        bodyKa: page.bodyKa ?? '',
        bodyEn: page.bodyEn ?? '',
        metaDescriptionKa: page.metaDescriptionKa ?? '',
        metaDescriptionEn: page.metaDescriptionEn ?? '',
        actionPreset: this.presetFor(page.actionPath, page.actionLabelKa),
        actionPath: page.actionPath ?? '',
        actionLabelKa: page.actionLabelKa ?? '',
        actionLabelEn: page.actionLabelEn ?? '',
        consentNote: page.consentNote ?? '',
        isPublished: page.isPublished,
      },
      { emitEvent: false },
    );
    page.credits.forEach((c) => this.addCredit(c));
    this.form.markAsPristine();
  }

  private toSave(): SaveContent {
    const v = this.form.getRawValue();
    const opt = (s: string) => (s.trim() ? s.trim() : null);
    const hasAction = !!v.actionPreset && !!v.actionPath.trim();
    return {
      type: v.type,
      slug: opt(v.slug),
      topic: opt(v.topic),
      titleKa: v.titleKa.trim(),
      titleEn: opt(v.titleEn),
      excerptKa: opt(v.excerptKa),
      excerptEn: opt(v.excerptEn),
      bodyKa: opt(v.bodyKa),
      bodyEn: opt(v.bodyEn),
      metaDescriptionKa: opt(v.metaDescriptionKa),
      metaDescriptionEn: opt(v.metaDescriptionEn),
      actionPath: hasAction ? v.actionPath.trim() : null,
      actionLabelKa: hasAction ? opt(v.actionLabelKa) : null,
      actionLabelEn: hasAction ? opt(v.actionLabelEn) : null,
      consentNote: v.type === 'real-wedding' ? opt(v.consentNote) : null,
      isPublished: v.isPublished,
      credits:
        v.type === 'real-wedding'
          ? (v.credits as { vendorId: string; name: string; roleKa: string; roleEn: string }[]).map((c) => ({
              vendorId: c.vendorId ? Number(c.vendorId) : null,
              name: c.name.trim(),
              roleKa: c.roleKa.trim(),
              roleEn: opt(c.roleEn),
            }))
          : [],
    };
  }

  private applyPreset(id: string): void {
    if (!id || id === 'custom') return; // "none" clears on save; "custom" leaves the fields to the admin
    const preset = [...TOOL_PRESETS, ...CATEGORY_PRESETS].find((p) => p.id === id);
    if (!preset) return;
    this.form.patchValue({ actionPath: preset.path, actionLabelKa: preset.labelKa, actionLabelEn: preset.labelEn });
  }

  private presetFor(path: string | null, labelKa: string | null): string {
    if (!path) return '';
    const preset = [...TOOL_PRESETS, ...CATEGORY_PRESETS].find((p) => p.path === path && p.labelKa === labelKa);
    return preset?.id ?? 'custom';
  }

  private errorFor(err: HttpErrorResponse): string {
    const code = err.error?.code as string | undefined;
    return code ? `adminContent.errors.${code}` : 'adminContent.errors.generic';
  }
}
