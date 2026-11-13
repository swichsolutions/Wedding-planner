import { groupPath } from './catalog';
import { SCHEDULES_PATH } from './schedule-addresses';

/** A page of the site an article leads on to: its address and the i18n key of its link text. */
export interface RelatedPage {
  path: string;
  key: string;
}

const page = (path: string, name: string): RelatedPage => ({ path, key: `guides.relatedPages.${name}` });

const PLANNING = page('/planning', 'planning');
const BUDGET = page('/budget', 'budget');
const GUESTS = page('/guests', 'guests');
const SEATING = page('/seating', 'seating');
const SCHEDULES = page(SCHEDULES_PATH, 'schedules');
const INVITATIONS = page('/invitations', 'invitations');
const VENDORS = page('/vendors', 'vendors');
const VENUES = page(groupPath('venues'), 'venues');

/** An article's topic (CONTENT_TOPICS.article) → the tool and catalog pages it is about, the
 * closest first. */
const BY_TOPIC: Record<string, RelatedPage[]> = {
  start: [PLANNING, BUDGET, SCHEDULES],
  budget: [BUDGET, VENDORS, PLANNING],
  guests: [GUESTS, SEATING, INVITATIONS],
  day: [SCHEDULES, PLANNING],
  invitation: [INVITATIONS, GUESTS],
  vendors: [VENDORS, BUDGET],
};

/** An article about choosing the venue („როგორ ავირჩიოთ დარბაზი“) is about that group, not the whole catalog. */
const ABOUT_VENUES = /darbaz|sivrts|restoran/;
const FOR_VENUES = [VENUES, SEATING, BUDGET];

/**
 * „დაკავშირებული გვერდები“ at the end of an article (SEO round, 2026-11-13): the pages its topic
 * matches, so a reader (and a crawler) goes on from the advice to the tools and the vendors. None
 * for a topic without pages, and not the one the article's own action button already opens.
 */
export function relatedPages(topic: string | null | undefined, slug: string, actionPath?: string | null): RelatedPage[] {
  const pages =
    topic === 'vendors' && ABOUT_VENUES.test(slug) ? FOR_VENUES : topic && Object.hasOwn(BY_TOPIC, topic) ? BY_TOPIC[topic] : [];
  const action = actionPath?.split(/[?#]/)[0];
  return pages.filter((p) => p.path !== action);
}
