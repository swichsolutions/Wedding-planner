import { LangCode } from '../i18n/languages';

/**
 * Example wedding-day schedules (design-system/PROPOSALS.md P7, approved 2026-10-21): the guide's
 * three scenarios, shown on the home page and on /ganrigebi. Times are a realistic starting point.
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

/** The phases of a wedding day, for the timeline views (/ganrigebi and the home chapter). */
export type Phase = 'prep' | 'ceremony' | 'reception' | 'party';

/** Where each example's rows change phase: row index → the phase that starts there. */
const PHASES: Record<string, [number, Phase][]> = {
  'one-venue': [[0, 'prep'], [2, 'ceremony'], [6, 'party']],
  'church-restaurant': [[0, 'prep'], [2, 'ceremony'], [5, 'party']],
  'reception-only': [[0, 'prep'], [2, 'reception'], [3, 'party']],
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
  if (a.includes('სუფრ')) return 'glasses'; // სუფრა, სუფრის გახსნა
  if (a.includes('ცეკვ') || a.includes('ანსამბლ') || a.includes('კვარტეტ')) return 'music';
  if (a.includes('ტორტი')) return 'cake';
  if (a.includes('დასასრული') || a.includes('დასრულება')) return 'moon';
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

// The three example days and their moments follow the site texts of 2026-11-12 („Homepage
// texts“, section 5). The times are a starting point of ours, not from that file.
export const DAY_SCHEDULES: DaySchedule[] = [
  {
    key: 'one-venue',
    title: T('ხელის მოწერა + წვეულება', 'Signing ceremony + party'),
    summary: T(
      'ხელმოწერაც და წვეულებაც ერთ სივრცეშია, ამიტომ სტუმრებს სხვადასხვა ლოკაციაზე გადაადგილება არ სჭირდებათ.',
      'The signing ceremony and the party are at the same venue, so guests never have to move from place to place.',
    ),
    rows: [
      { time: '11:00', activity: T('წყვილის მომზადება', 'The couple gets ready'), note: T('მაკიაჟი და ვარცხნილობა', 'Makeup and hair'), who: STYLIST },
      { time: '14:30', activity: T('წყვილის ფოტოსესია', 'The couple’s photo session'), note: T('სივრცეში ან ახლოს', 'At the venue or nearby'), who: PHOTOGRAPHER },
      { time: '16:30', activity: T('სტუმრების მიღება', 'Welcoming the guests'), note: T('მისასალმებელი სასმელი', 'Welcome drinks'), who: VENUE_MANAGER },
      { time: '16:45', activity: T('კვარტეტი', 'String quartet') },
      { time: '17:00', activity: T('ხელის მოწერის ცერემონია', 'Signing ceremony'), note: T('საზეიმო რეგისტრაცია ან სიმბოლური ცერემონია', 'Civil registration on site or a symbolic ceremony'), who: T('წამყვანი', 'Host') },
      { time: '17:30', activity: T('მილოცვები და საერთო ფოტოები', 'Congratulations and group photos'), note: T('ოჯახები, მეგობრები', 'Families, friends'), who: PHOTOGRAPHER },
      { time: '18:30', activity: T('სუფრის გახსნა', 'The supra opens'), note: T('თამადის პირველი სადღეგრძელოები', 'The tamada’s first toasts'), who: TAMADA },
      { time: '19:30', activity: T('წყვილის პირველი ცეკვა', 'The couple’s first dance'), who: T('ბენდი / DJ', 'Band / DJ') },
      { time: '21:30', activity: T('ტორტის გაჭრა', 'Cutting the cake'), who: CAKE_MAKER },
      { time: '00:00', activity: T('წვეულების დასრულება', 'The party ends'), note: T('სტუმრების ტრანსპორტი', 'Transport for guests'), who: T('კოორდინატორი', 'Coordinator') },
    ],
  },
  {
    key: 'church-restaurant',
    title: T('ჯვრისწერა + წვეულება', 'Church wedding + party'),
    summary: T(
      'ჯვრისწერა ეკლესიაში და საღამოს წვეულება სხვა სივრცეში. დღე ადრე იწყება და ორ ადგილას მიმდინარეობს.',
      'A church wedding, then an evening party at another venue. The day starts early and moves between two places.',
    ),
    note: T(
      'სამოქალაქო რეგისტრაცია (იუსტიციის სახლში) ხშირად სხვა დღეს ტარდება.',
      'The civil registration (at the Public Service Hall) often happens on a different day.',
    ),
    rows: [
      { time: '10:00', activity: T('წყვილის მომზადება', 'The couple gets ready'), note: T('მაკიაჟი, ვარცხნილობა, ჩაცმა', 'Makeup, hair, getting dressed'), who: STYLIST },
      { time: '13:30', activity: T('სტუმრების შეკრება ეკლესიასთან', 'Guests gather at the church') },
      { time: '14:00', activity: T('ჯვრისწერა', 'Church wedding'), note: T('ეკლესიასთან და მღვდელთან წინასწარ შეთანხმებული დრო', 'At a time agreed in advance with the church and the priest'), who: T('მეჯვარეები', 'The witnesses (mejvare)') },
      { time: '15:00', activity: T('წყვილის ფოტოსესია', 'The couple’s photo session'), note: T('ქალაქში ან ბუნებაში', 'In the city or outdoors'), who: PHOTOGRAPHER },
      { time: '18:00', activity: T('სტუმრების მიღება წვეულების სივრცეში', 'Welcoming the guests at the party venue'), who: VENUE_MANAGER },
      { time: '18:30', activity: T('სუფრის გახსნა', 'The supra opens'), note: T('თამადის სადღეგრძელოები', 'The tamada’s toasts'), who: TAMADA },
      { time: '19:30', activity: T('წყვილის პირველი ცეკვა', 'The couple’s first dance'), who: T('ბენდი', 'Band') },
      { time: '22:00', activity: T('ტორტის გაჭრა', 'Cutting the cake'), who: CAKE_MAKER },
      { time: '23:30', activity: T('წვეულების დასრულება', 'The party ends') },
    ],
  },
  {
    key: 'reception-only',
    title: T('მხოლოდ წვეულება', 'Party only'),
    summary: T(
      'ცერემონიის გარეშე, ან როცა ის სხვა დღეს იყო: საღამო ფოტოსესიით იწყება და სუფრით, ცეკვითა და ტორტით გრძელდება.',
      'No ceremony, or one held on another day: the evening starts with a photo session and goes on with the supra, dancing and cake.',
    ),
    rows: [
      { time: '14:30', activity: T('წყვილის მომზადება', 'The couple gets ready'), who: STYLIST },
      { time: '17:00', activity: T('წყვილის ფოტოსესია', 'The couple’s photo session'), who: PHOTOGRAPHER },
      { time: '18:30', activity: T('სტუმრების მიღება წვეულების სივრცეში', 'Welcoming the guests at the party venue'), note: T('ფურშეტი', 'Buffet'), who: VENUE_MANAGER },
      { time: '19:00', activity: T('წყვილის შემოსვლა და სუფრის გახსნა', 'The couple’s entrance and the supra opens'), note: T('თამადა ან წამყვანი', 'With a tamada or a host'), who: TAMADA },
      { time: '20:00', activity: T('წყვილის პირველი ცეკვა', 'The couple’s first dance'), who: DJ },
      { time: '22:00', activity: T('ტორტის გაჭრა', 'Cutting the cake'), who: CAKE_MAKER },
      { time: '23:30', activity: T('წვეულების დასრულება', 'The party ends') },
    ],
  },
];
