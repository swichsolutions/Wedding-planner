/**
 * Where the example day schedules live (2026-11-13; was /schedules and /schedules?s=<key>):
 * /ganrigebi shows the first one, and each has its own page at /ganrigebi/<slug>, the scenario's
 * Georgian name in Latin letters. Kept apart from day-schedules.ts (the examples' full text) so
 * the router can know the addresses without loading the text. The API's sitemap lists the same
 * three (SiteAddresses.cs): keep the two equal.
 */
export const SCHEDULES_PATH = '/ganrigebi';

/** Example key (core/day-schedules.ts) → its address segment. */
export const SCHEDULE_SLUGS: Record<string, string> = {
  'one-venue': 'khelis-motsera',
  'church-restaurant': 'jvristsera',
  'reception-only': 'mkholod-tsveuleba',
};

/** An example's page; the schedules page itself for a key that has none. */
export const schedulePath = (key: string | null | undefined): string =>
  key && Object.hasOwn(SCHEDULE_SLUGS, key) ? `${SCHEDULES_PATH}/${SCHEDULE_SLUGS[key]}` : SCHEDULES_PATH;

export const scheduleBySlug = (slug: string | null | undefined): string | undefined =>
  Object.keys(SCHEDULE_SLUGS).find((key) => SCHEDULE_SLUGS[key] === slug);
