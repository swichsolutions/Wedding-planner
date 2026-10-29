/**
 * Amounts in lari for display, independent of the runtime's locale data. Node (server render)
 * and browsers disagree on Georgian number formatting ("8000" vs "8,000"), which made the
 * server-rendered titles and prices differ from the hydrated page. The digits are grouped here:
 * a no-break space between thousands in Georgian ("8 000 ₾"), commas in English ("8,000 ₾").
 * A no-break space also keeps ₾ on the same line as its number.
 */
const GROUPS = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export function formatGel(amount: number | null | undefined, lang: string): string {
  // `|| 0` turns -0 (a small negative rounded, e.g. -0.3) into 0, so it never shows as "-0".
  const digits = GROUPS.format(Math.round(amount ?? 0) || 0);
  return (lang === 'en' ? digits : digits.replace(/,/g, ' ')) + ' ₾';
}
