import { LangCode } from '../i18n/languages';

/**
 * Example wedding-day schedules (design-system/PROPOSALS.md P7, approved 2026-10-21): the guide's
 * three scenarios, shown on the home page and on /schedules. Times are a realistic starting point.
 * Each text carries both languages, since the rows are content rather than interface copy; B2's
 * „ქორწილის დღე“ tool starts a couple's own schedule from these.
 */
export interface LocalText {
  ka: string;
  en: string;
}

export interface ScheduleRow {
  time: string;
  activity: LocalText;
  note?: LocalText;
  /** Who's responsible. */
  who?: LocalText;
}

export interface DaySchedule {
  key: string;
  title: LocalText;
  summary: LocalText;
  /** Shown under the full schedule. */
  note?: LocalText;
  rows: ScheduleRow[];
}

export function local(text: LocalText | undefined, lang: LangCode): string {
  return text ? (text[lang] ?? text.ka) : '';
}

/** An example's rows in one language, ready to become the couple's own wedding day (B2). */
export function scheduleRows(key: string, lang: LangCode) {
  const schedule = DAY_SCHEDULES.find((s) => s.key === key);
  if (!schedule) return null;
  return schedule.rows.map((r) => ({
    time: r.time,
    activity: local(r.activity, lang),
    note: local(r.note, lang) || null,
    who: local(r.who, lang) || null,
    contact: null,
  }));
}

/** The phases of a wedding day, for the timeline views (/schedules and the home chapter). */
export type Phase = 'prep' | 'ceremony' | 'reception' | 'party';

/** Where each example's rows change phase: row index → the phase that starts there. */
const PHASES: Record<string, [number, Phase][]> = {
  'one-venue': [[0, 'prep'], [3, 'ceremony'], [6, 'party']],
  'church-restaurant': [[0, 'prep'], [3, 'ceremony'], [6, 'party']],
  'reception-only': [[0, 'prep'], [1, 'reception'], [3, 'party']],
};

export function phaseOf(key: string, i: number): Phase {
  let phase: Phase = 'prep';
  for (const [from, p] of PHASES[key] ?? []) if (i >= from) phase = p;
  return phase;
}

/** The rows that start a phase (for the key moments on the day bar). */
export function phaseStarts(key: string): number[] {
  return (PHASES[key] ?? [[0, 'prep']]).map(([i]) => i);
}

/** The icons the day views draw (components/day-icon). */
export type DayIcon =
  | 'mirror' | 'camera' | 'people' | 'rings' | 'car' | 'glasses' | 'music' | 'cake' | 'moon'
  | 'door' | 'home' | 'church' | 'arch' | 'dot';

/** A scenario's own icon (the picker cards). */
export const SCENARIO_ICON: Record<string, DayIcon> = {
  'one-venue': 'arch',
  'church-restaurant': 'church',
  'reception-only': 'glasses',
};

/** The icon for a row, from its Georgian activity text (the rows are fixed content). */
export function iconFor(activityKa: string): DayIcon {
  const a = activityKa;
  if (a.includes('მომზადება')) return 'mirror';
  if (a.includes('მაყრიონი')) return 'home';
  if (a.includes('კორტეჟი')) return 'car';
  if (a.includes('ჯვრისწერა') || a.includes('ცერემონია')) return 'rings';
  if (a.includes('ფოტო')) return 'camera';
  if (a.includes('სტუმრ')) return 'people';
  if (a.includes('შემოსვლა')) return 'door';
  if (a.includes('სუფრა')) return 'glasses';
  if (a.includes('ცეკვ') || a.includes('ანსამბლ')) return 'music';
  if (a.includes('ტორტი')) return 'cake';
  if (a.includes('დასასრული')) return 'moon';
  return 'dot';
}

/** "HH:MM" → minutes from the day's start; a time past midnight counts as the next day. */
export function minutesOf(time: string, firstMinutes = 0): number {
  const [h, m] = time.split(':').map(Number);
  const t = h * 60 + m;
  return t < firstMinutes ? t + 24 * 60 : t;
}

const T = (ka: string, en: string): LocalText => ({ ka, en });

const STYLIST = T('სტილისტი', 'Stylist');
const PHOTOGRAPHER = T('ფოტოგრაფი', 'Photographer');
const TAMADA = T('თამადა', 'Tamada');
const CAKE_MAKER = T('საკონდიტრო', 'Cake maker');
const DJ = T('DJ', 'DJ');
const ENSEMBLE = T('ანსამბლი', 'Ensemble');
const VENUE_MANAGER = T('სივრცის მენეჯერი', 'Venue manager');

export const DAY_SCHEDULES: DaySchedule[] = [
  {
    key: 'one-venue',
    title: T('ცერემონია და წვეულება ერთ სივრცეში', 'Ceremony and party in one place'),
    summary: T(
      'ცერემონიაც და სუფრაც ერთ სივრცეშია, ამიტომ სტუმრებს არსად გადაადგილება არ სჭირდებათ. ცერემონია საზეიმო რეგისტრაციაა ან სიმბოლური.',
      'The ceremony and the supra are at the same venue, so guests never have to move. The ceremony is a civil registration on site or a symbolic one.',
    ),
    rows: [
      { time: '11:00', activity: T('პატარძლის მომზადება', 'The bride gets ready'), note: T('მაკიაჟი და ვარცხნილობა', 'Makeup and hair'), who: STYLIST },
      { time: '13:30', activity: T('ფოტოგრაფი და ვიდეოგრაფი იწყებენ', 'Photographer and videographer start'), note: T('დეტალები, ჩაცმა', 'Details, getting dressed'), who: PHOTOGRAPHER },
      { time: '14:30', activity: T('წყვილის პირველი შეხვედრა და ფოტოსესია', 'First look and the couple’s photo session'), note: T('სივრცეში ან ახლოს', 'At the venue or nearby'), who: PHOTOGRAPHER },
      { time: '16:30', activity: T('სტუმრების მოსვლა', 'Guests arrive'), note: T('მისასალმებელი სასმელი', 'Welcome drinks'), who: VENUE_MANAGER },
      { time: '17:00', activity: T('ცერემონია', 'Ceremony'), note: T('საზეიმო რეგისტრაცია ან სიმბოლური ცერემონია', 'Civil registration on site or a symbolic ceremony'), who: T('წამყვანი', 'Host') },
      { time: '17:30', activity: T('მილოცვები და ჯგუფური ფოტოები', 'Congratulations and group photos'), note: T('ოჯახები, მეგობრები', 'Families, friends'), who: PHOTOGRAPHER },
      { time: '18:30', activity: T('სუფრა', 'Supra'), note: T('თამადის პირველი სადღეგრძელოები', 'The tamada’s first toasts'), who: TAMADA },
      { time: '19:30', activity: T('პირველი ცეკვა', 'First dance'), who: T('ბენდი / DJ', 'Band / DJ') },
      { time: '20:00', activity: T('ცეკვები და ანსამბლის გამოსვლა', 'Dancing and the ensemble’s performance'), who: ENSEMBLE },
      { time: '21:30', activity: T('ტორტი', 'Cake'), who: CAKE_MAKER },
      { time: '22:00', activity: T('ცეკვები გრძელდება', 'Dancing continues'), who: DJ },
      { time: '00:00', activity: T('დასასრული', 'End'), note: T('სტუმრების ტრანსპორტი', 'Transport for guests'), who: T('კოორდინატორი', 'Coordinator') },
    ],
  },
  {
    key: 'church-restaurant',
    title: T('ჯვრისწერა ეკლესიაში, ქორწილი რესტორანში', 'Church wedding, then the restaurant'),
    summary: T(
      'მაყრიონი, ჯვრისწერა ეკლესიაში, კორტეჟი და საღამოს სუფრა რესტორანში. დღე ადრე იწყება და ორ ადგილას მიმდინარეობს.',
      'Makrioni, a church wedding, the motorcade and an evening supra at a restaurant. The day starts early and moves between two places.',
    ),
    note: T(
      'სამოქალაქო რეგისტრაცია (იუსტიციის სახლში) ხშირად სხვა დღეს ტარდება.',
      'The civil registration (at the Public Service Hall) often happens on a different day.',
    ),
    rows: [
      { time: '10:00', activity: T('პატარძლის მომზადება', 'The bride gets ready'), note: T('მაკიაჟი, ვარცხნილობა, ჩაცმა', 'Makeup, hair, the dress'), who: STYLIST },
      { time: '12:30', activity: T('მაყრიონი პატარძლის სახლში', 'Makrioni at the bride’s home'), note: T('სიძე და მაყრიონი პატარძალს მშობლების სახლიდან გამოიყვანენ', 'The groom and his party take the bride from her parents’ home'), who: T('სიძე, მეჯვარე', 'The groom, the best man') },
      { time: '13:30', activity: T('ფოტოსესია', 'Photo session'), note: T('ქალაქში ან ბუნებაში', 'In the city or outdoors'), who: PHOTOGRAPHER },
      { time: '15:30', activity: T('ჯვრისწერა', 'Church wedding'), note: T('ეკლესიასთან და მღვდელთან წინასწარ შეთანხმებული დრო', 'At a time agreed in advance with the church and the priest'), who: T('მეჯვარეები', 'The witnesses (mejvare)') },
      { time: '16:30', activity: T('კორტეჟი რესტორნისკენ', 'Motorcade to the restaurant'), who: T('ტრანსპორტი', 'Transport') },
      { time: '18:00', activity: T('სტუმრების მიღება', 'Welcoming the guests'), who: T('რესტორნის მენეჯერი', 'Restaurant manager') },
      { time: '18:30', activity: T('წყვილის შემოსვლა და სუფრა', 'The couple’s entrance and the supra'), note: T('თამადის სადღეგრძელოები', 'The tamada’s toasts'), who: TAMADA },
      { time: '19:30', activity: T('პირველი ცეკვა', 'First dance'), who: T('ბენდი', 'Band') },
      { time: '20:30', activity: T('ანსამბლის გამოსვლა', 'The ensemble’s performance'), who: ENSEMBLE },
      { time: '22:00', activity: T('ტორტი', 'Cake'), who: CAKE_MAKER },
      { time: '23:30', activity: T('დასასრული', 'End') },
    ],
  },
  {
    key: 'reception-only',
    title: T('მხოლოდ მიღება და წვეულება', 'Reception and party only'),
    summary: T(
      'ცერემონიის გარეშე, ან როცა ის სხვა დღეს იყო: საღამო ფოტოსესიით იწყება და სუფრით, ცეკვითა და ტორტით გრძელდება.',
      'No ceremony, or one held on another day: the evening starts with a photo session and goes on with the supra, dancing and cake.',
    ),
    rows: [
      { time: '17:00', activity: T('წყვილის ფოტოსესია', 'The couple’s photo session'), who: PHOTOGRAPHER },
      { time: '18:30', activity: T('სტუმრების მოსვლა', 'Guests arrive'), note: T('ფურშეტი', 'Buffet'), who: VENUE_MANAGER },
      { time: '19:00', activity: T('წყვილის შემოსვლა', 'The couple’s entrance'), who: T('წამყვანი', 'Host') },
      { time: '19:15', activity: T('სუფრა', 'Supra'), note: T('თამადა ან წამყვანი', 'With a tamada or a host'), who: TAMADA },
      { time: '20:00', activity: T('პირველი ცეკვა', 'First dance'), who: DJ },
      { time: '20:15', activity: T('ცეკვები', 'Dancing'), who: DJ },
      { time: '22:00', activity: T('ტორტი', 'Cake'), who: CAKE_MAKER },
      { time: '23:30', activity: T('დასასრული', 'End') },
    ],
  },
];
