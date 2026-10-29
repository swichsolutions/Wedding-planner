import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../environments/environment';

/** The design theme keys — must match WebsiteController.TemplateKeys. */
export const WEDDING_TEMPLATES = [
  'glow',
  'calligraphy',
  'garnet',
  'forest',
  'seaside',
  'minimal',
  'blush',
  'vineyard',
  'midnight',
  'sunrise',
  'minankari',
  'pardagi',
  'pearl',
  'tbilisi',
] as const;

export type WeddingTemplateKey = (typeof WEDDING_TEMPLATES)[number];

/** Typefaces for the names besides the design's own — must match InviteRules.FontKeys. */
export const INVITE_FONTS = ['classic', 'plain', 'capitals', 'modern'] as const;

/** One line of the invitation's short schedule for guests. */
export interface SiteScheduleItem {
  time: string | null; // 'HH:mm'
  text: string;
}

export interface SitePhoto {
  id: number;
  url: string;
}

/** What the invitation renderer needs — shared by the builder preview and the public page. */
export interface WeddingSiteData {
  firstName: string | null;
  partnerFirstName: string | null;
  weddingDate: string | null; // 'yyyy-MM-dd'
  place: string | null;
  message: string | null;
  inkColor: string | null; // '#rrggbb'; null = the design's own text color
  accentColor: string | null; // '#rrggbb'; null = the design's own accent
  photoUrl: string | null;
  /** Photo focal point in percent (50/50 = center) — kept in frame by every design's crop. */
  photoFocusX: number | null;
  photoFocusY: number | null;
  startTime: string | null; // 'HH:mm'
  /** null = the design's own typeface for the names. */
  fontKey: string | null;
  ceremonyName: string | null;
  ceremonyAddress: string | null;
  ceremonyTime: string | null;
  ceremonyMapUrl: string | null;
  receptionName: string | null;
  receptionAddress: string | null;
  receptionTime: string | null;
  receptionMapUrl: string | null;
  /** Extra details: null = not on the invitation. */
  dressCode: string | null;
  transport: string | null;
  accommodation: string | null;
  schedule: SiteScheduleItem[];
  photos: SitePhoto[];
  rsvpEnabled: boolean;
  rsvpDeadline: string | null; // 'yyyy-MM-dd', inclusive
}

/** The parts of WeddingSiteData a sample or a fresh invitation leaves empty. */
export const EMPTY_INVITE_EXTRAS: Omit<
  WeddingSiteData,
  'firstName' | 'partnerFirstName' | 'weddingDate' | 'place' | 'message' | 'photoUrl'
> = {
  inkColor: null,
  accentColor: null,
  photoFocusX: null,
  photoFocusY: null,
  startTime: null,
  fontKey: null,
  ceremonyName: null,
  ceremonyAddress: null,
  ceremonyTime: null,
  ceremonyMapUrl: null,
  receptionName: null,
  receptionAddress: null,
  receptionTime: null,
  receptionMapUrl: null,
  dressCode: null,
  transport: null,
  accommodation: null,
  schedule: [],
  photos: [],
  rsvpEnabled: false,
  rsvpDeadline: null,
};

/** The couple's own invitation — full editable state + publish status. */
export interface WeddingSite extends WeddingSiteData {
  templateKey: string;
  lastName: string | null;
  partnerLastName: string | null;
  isPublished: boolean;
  slug: string | null;
  rsvpAskDiet: boolean;
  rsvpAskMessage: boolean;
  rsvpQuestion: string | null;
}

export interface WeddingSiteUpdate {
  templateKey: string;
  firstName: string | null;
  lastName: string | null;
  partnerFirstName: string | null;
  partnerLastName: string | null;
  weddingDate: string | null;
  place: string | null;
  message: string | null;
  inkColor: string | null;
  accentColor: string | null;
  /** null = keep the stored focal point. */
  photoFocusX: number | null;
  photoFocusY: number | null;
  startTime: string | null;
  fontKey: string | null;
  ceremonyName: string | null;
  ceremonyAddress: string | null;
  ceremonyTime: string | null;
  ceremonyMapUrl: string | null;
  receptionName: string | null;
  receptionAddress: string | null;
  receptionTime: string | null;
  receptionMapUrl: string | null;
  dressCode: string | null;
  transport: string | null;
  accommodation: string | null;
  /** null = keep. */
  schedule: SiteScheduleItem[] | null;
  /** null = keep. */
  rsvpEnabled: boolean | null;
  rsvpDeadline: string | null;
  rsvpAskDiet: boolean | null;
  rsvpAskMessage: boolean | null;
  rsvpQuestion: string | null;
}

export interface PublicSite extends WeddingSiteData {
  templateKey: string;
  /** RSVP is on and the deadline hasn't passed. */
  rsvpOpen: boolean;
}

/** Who one personal link is for: a family (D9) or a guest invited on their own. */
export interface InviteeParty {
  kind: 'family' | 'guest';
  id: number;
  name: string;
  people: number;
  code: string;
  yes: number;
  no: number;
  pending: number;
  rsvpAt: string | null;
}

/** One guest row of a party on its RSVP form: the guest with their plus-one and child. */
export interface RsvpGuest {
  id: number;
  name: string;
  hasPlusOne: boolean;
  /** null when the couple didn't know the name. */
  plusOneName: string | null;
  hasChild: boolean;
  childName: string | null;
  attendance: 'pending' | 'yes' | 'no';
  dietaryNeeds: string | null;
}

/** What a personal link shows: only this party's names and answers. */
export interface RsvpParty {
  familyName: string | null;
  guests: RsvpGuest[];
  respondedAt: string | null;
  message: string | null;
  answer: string | null;
  enabled: boolean;
  open: boolean;
  deadline: string | null;
  askDiet: boolean;
  askMessage: boolean;
  question: string | null;
}

export interface RsvpReply {
  guests: { id: number; attendance: 'yes' | 'no'; dietaryNeeds: string | null; plusOneName: string | null }[];
  message: string | null;
  answer: string | null;
}

/** A guest's personal invitation link: the public page plus the party's code. */
export function personalPath(slug: string, code: string): string {
  return `/w/${slug}/${code}`;
}

/** Couple invitation API + the anonymous public read side and RSVP. */
@Injectable({ providedIn: 'root' })
export class WebsiteService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  /** The couple's site, or null when they haven't started one (API replies 204). */
  get(): Observable<WeddingSite | null> {
    return this.http
      .get<WeddingSite | null>(`${this.base}/api/planning/website`)
      .pipe(map((s) => s ?? null));
  }

  update(payload: WeddingSiteUpdate): Observable<WeddingSite> {
    return this.http.put<WeddingSite>(`${this.base}/api/planning/website`, payload);
  }

  uploadPhoto(file: File): Observable<WeddingSite> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<WeddingSite>(`${this.base}/api/planning/website/photo`, form);
  }

  removePhoto(): Observable<WeddingSite> {
    return this.http.delete<WeddingSite>(`${this.base}/api/planning/website/photo`);
  }

  /** One more gallery photo (up to six; 409 when full). */
  addGalleryPhoto(file: File): Observable<WeddingSite> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<WeddingSite>(`${this.base}/api/planning/website/photos`, form);
  }

  removeGalleryPhoto(id: number): Observable<WeddingSite> {
    return this.http.delete<WeddingSite>(`${this.base}/api/planning/website/photos/${id}`);
  }

  publish(): Observable<WeddingSite> {
    return this.http.post<WeddingSite>(`${this.base}/api/planning/website/publish`, {});
  }

  unpublish(): Observable<WeddingSite> {
    return this.http.post<WeddingSite>(`${this.base}/api/planning/website/unpublish`, {});
  }

  /** Families and lone guests with their personal link codes (handed out on first call). */
  parties(): Observable<InviteeParty[]> {
    return this.http.get<InviteeParty[]>(`${this.base}/api/planning/website/parties`);
  }

  /** A published site by public slug (anonymous). */
  publicSite(slug: string): Observable<PublicSite> {
    return this.http.get<PublicSite>(`${this.base}/api/sites/${encodeURIComponent(slug)}`);
  }

  /** The party a personal link answers for (anonymous). */
  rsvp(slug: string, code: string): Observable<RsvpParty> {
    return this.http.get<RsvpParty>(
      `${this.base}/api/sites/${encodeURIComponent(slug)}/rsvp/${encodeURIComponent(code)}`,
    );
  }

  answerRsvp(slug: string, code: string, reply: RsvpReply): Observable<RsvpParty> {
    return this.http.post<RsvpParty>(
      `${this.base}/api/sites/${encodeURIComponent(slug)}/rsvp/${encodeURIComponent(code)}`,
      reply,
    );
  }

  /**
   * Guest site finder — name + year are required (the API refuses broad browsing),
   * month optionally tightens the ordering.
   */
  findSites(
    firstName: string,
    lastName: string,
    year: number,
    month?: number,
  ): Observable<SiteSearchResult[]> {
    let params = new HttpParams()
      .set('firstName', firstName)
      .set('lastName', lastName)
      .set('year', String(year));
    if (month) params = params.set('month', String(month));
    return this.http.get<SiteSearchResult[]>(`${this.base}/api/sites/search`, { params });
  }
}

export interface SiteSearchResult {
  firstName: string | null;
  lastName: string | null;
  partnerFirstName: string | null;
  partnerLastName: string | null;
  weddingDate: string; // yyyy-MM-dd
  place: string | null;
  slug: string;
}
