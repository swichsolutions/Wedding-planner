import { UrlSegment, UrlSegmentGroup } from '@angular/router';
import { describe, expect, it } from 'vitest';

import { catalogAddress, routes, schedulesAddress } from './app.routes';
import { CATEGORIES, GROUPS, GROUP_SLUGS } from './core/catalog';
import { GUIDES_PATH, KIND_SECTION } from './core/content.models';

const segments = (path: string) => path.split('/').filter(Boolean).map((s) => new UrlSegment(s, {}));
const match = (matcher: typeof catalogAddress, path: string) =>
  matcher(segments(path), new UrlSegmentGroup([], {}), {});

describe('the route table', () => {
  it('has no page whose address is also a category’s or a group’s', () => {
    const taken = new Set(routes.map((r) => r.path).filter((p): p is string => !!p && !p.includes('/') && !p.startsWith(':')));
    expect(taken.size).toBeGreaterThan(15);
    for (const slug of [...CATEGORIES.map((c) => c.slug), ...GROUPS.map((g) => GROUP_SLUGS[g]), 'ganrigebi']) {
      expect(taken.has(slug), slug).toBe(false);
    }
  });

  it('has the tips pages at the addresses the links are built from', () => {
    const paths = new Set(routes.map((r) => `/${r.path}`));
    expect(paths.has(GUIDES_PATH)).toBe(true);
    for (const section of Object.values(KIND_SECTION)) {
      expect(paths.has(section), section).toBe(true);
      expect(paths.has(`${section}/:slug`), section).toBe(true);
    }
  });
});

describe('catalogAddress', () => {
  it('matches the catalog, a group and a category', () => {
    expect(match(catalogAddress, '/vendors')?.posParams).toBeUndefined();
    expect(match(catalogAddress, '/vendors')?.consumed.length).toBe(1);
    expect(match(catalogAddress, '/foto-da-video')?.posParams?.['slug'].path).toBe('foto-da-video');
    expect(match(catalogAddress, '/fotografi')?.posParams?.['slug'].path).toBe('fotografi');
  });

  it('leaves an unknown word to the 404, and longer addresses to their own routes', () => {
    expect(match(catalogAddress, '/zzz')).toBeNull();
    expect(match(catalogAddress, '/constructor')).toBeNull();
    expect(match(catalogAddress, '/fotografi/tbilisi')).toBeNull();
    expect(match(catalogAddress, '/')).toBeNull();
  });
});

describe('schedulesAddress', () => {
  it('matches the schedules page and each example', () => {
    expect(match(schedulesAddress, '/ganrigebi')?.posParams).toBeUndefined();
    expect(match(schedulesAddress, '/ganrigebi/jvristsera')?.posParams?.['slug'].path).toBe('jvristsera');
  });

  it('matches nothing else', () => {
    expect(match(schedulesAddress, '/ganrigebi/zzz')).toBeNull();
    expect(match(schedulesAddress, '/ganrigebi/jvristsera/x')).toBeNull();
    expect(match(schedulesAddress, '/schedules')).toBeNull();
  });
});
