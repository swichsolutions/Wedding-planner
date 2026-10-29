/**
 * Dates for display, independent of the browser's locale data. Browsers don't reliably ship
 * Georgian (`ka-GE` can come out as "October 19, 2026" or "2026 M10 19"), and the server and the
 * browser disagreeing also rewrites server-rendered text on hydration. So Georgian month names
 * are spelled out here, and the calendar day is always Tbilisi's, wherever the code runs.
 */
const KA_MONTHS = [
  'იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი',
  'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი',
];
const KA_MONTHS_SHORT = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'];

const TZ = 'Asia/Tbilisi';
// Numeric parts only — these never depend on locale data.
const PARTS = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric' });

/** "19 ოქტომბერი, 2026" / "19 ოქტ. 2026" in Georgian; "October 19, 2026" / "Oct 19, 2026" in English. */
export function formatDate(value: string | Date | null | undefined, lang: string, style: 'long' | 'medium' = 'long'): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';

  if (lang === 'en') return new Intl.DateTimeFormat('en-US', { timeZone: TZ, dateStyle: style }).format(date);

  const parts = Object.fromEntries(PARTS.formatToParts(date).map((p) => [p.type, p.value]));
  const day = Number(parts['day']);
  const month = Number(parts['month']) - 1;
  return style === 'long'
    ? `${day} ${KA_MONTHS[month]}, ${parts['year']}`
    : `${day} ${KA_MONTHS_SHORT[month]}. ${parts['year']}`;
}

/** A month's name (0 = January): spelled out in Georgian, from the browser in English. */
export function monthName(month: number, lang: string): string {
  if (lang === 'en') return new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(Date.UTC(2026, month, 1));
  return KA_MONTHS[month] ?? '';
}

/** Today's calendar day in Tbilisi as 'yyyy-MM-dd' (the value of a date input). */
export function todayIso(now: Date = new Date()): string {
  const parts = Object.fromEntries(PARTS.formatToParts(now).map((p) => [p.type, p.value]));
  return `${parts['year']}-${parts['month'].padStart(2, '0')}-${parts['day'].padStart(2, '0')}`;
}
