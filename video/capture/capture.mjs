// Lifts real interface elements from the running site (local dev servers) for the clips: each element
// as a transparent PNG in its before and after states, plus a manifest with its geometry and text
// styles. Run seed.mjs first. The clips animate these captures; only numbers, bars and the reply menu are redrawn.
import { chromium } from 'playwright';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const auth = JSON.parse(readFileSync(join(here, '.demo-auth.json'), 'utf8'));
const WEB = process.env.WP_WEB ?? 'http://localhost:4301';
const API = auth.api;
const OUT = join(here, '..', 'public', 'cap');
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const manifest = {};

const browser = await chromium.launch();
const site = join(here, '..', '..', 'frontend', 'public');
for (const [from, to] of [['media/hero-tall.webp', 'hero-tall.webp'], ['media/hero-wide.webp', 'hero-wide.webp'], ['fonts/FiraGO-Medium.woff2', 'FiraGO-Medium.woff2']]) copyFileSync(join(site, from), join(OUT, to));

async function context(width, height, dpr, mobile) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile });
  await ctx.addInitScript(({ token, user }) => {
    localStorage.setItem('weddingplanner.auth.token', token);
    localStorage.setItem('weddingplanner.auth.user', JSON.stringify(user));
  }, { token: auth.token, user: { email: auth.email, roles: auth.roles, vendorId: auth.vendorId } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  pageerror', e.message));
  return page;
}

async function open(page, path, css = '') {
  await page.goto(WEB + path, { waitUntil: 'networkidle', timeout: 120000 });
  await page.addStyleTag({ content: `html{scroll-behavior:auto!important} *,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important} ${css}` });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
}

/** A transparent PNG of one element: everything else on the page is hidden, backgrounds included. */
async function sprite(page, selector, name, { pad = 0, nth = 0 } = {}) {
  const el = page.locator(selector).nth(nth);
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(120);
  const handle = await el.elementHandle();
  await page.evaluate((n) => n.setAttribute('data-sprite', '1'), handle);
  const style = await page.addStyleTag({ content: `html,body{background:transparent!important} body *{visibility:hidden!important} [data-sprite],[data-sprite] *{visibility:visible!important}` });
  const box = await el.boundingBox();
  const clip = { x: box.x - pad, y: box.y - pad, width: box.width + pad * 2, height: box.height + pad * 2 };
  await page.screenshot({ path: join(OUT, `${name}.png`), clip, omitBackground: true });
  await style.evaluate((n) => n.remove());
  await page.evaluate((n) => n.removeAttribute('data-sprite'), handle);
  manifest[name] = { w: clip.width, h: clip.height, pad };
  return box;
}

/** Where an element sits relative to another, with the text styles needed to redraw a number on it. */
async function rect(page, selector, originSelector, { nth = 0 } = {}) {
  const r = await page.locator(selector).nth(nth).boundingBox();
  const o = await page.locator(originSelector).first().boundingBox();
  const style = await page.locator(selector).nth(nth).evaluate((n) => {
    const c = getComputedStyle(n);
    return { font: c.fontFamily, size: parseFloat(c.fontSize), weight: c.fontWeight, color: c.color, bg: c.backgroundColor, radius: parseFloat(c.borderRadius) || 0, align: c.textAlign, lineHeight: parseFloat(c.lineHeight) || 0, paddingLeft: parseFloat(c.paddingLeft) || 0, text: String(n.tagName === 'INPUT' ? n.value : n.textContent).trim() };
  });
  return { x: r.x - o.x, y: r.y - o.y, w: r.width, h: r.height, ...style };
}

async function call(method, path, body) {
  const r = await fetch(API + path, { method, headers: { Authorization: `Bearer ${auth.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

const PHONE = [430, 932, 3, true];

// ---------------------------------------------------------------- overview banner + wordmark
{
  const page = await context(...PHONE);
  await open(page, '/planning', '.ovb__actions{display:none!important}');
  const radius = await page.locator('.ovb').evaluate((n) => parseFloat(getComputedStyle(n).borderRadius));
  const bg = await page.locator('.ovb__bg').evaluate((n) => { const c = getComputedStyle(n); return { src: n.getAttribute('src'), fit: c.objectFit, pos: c.objectPosition }; });
  const days = await rect(page, '.ovb__count .num', '.ovb');
  await page.addStyleTag({ content: '.ovb__count .num{color:transparent!important}' });
  await sprite(page, '.ovb', 'banner');
  await page.evaluate(() => { document.querySelector('.ovb__text').style.setProperty('display', 'none', 'important'); });
  await sprite(page, '.ovb', 'banner-notext');
  manifest.banner.radius = radius;
  manifest.banner.bg = bg;
  manifest.banner.days = days;
  await sprite(page, '.hdr .wordmark', 'wordmark', { pad: 2 });
  await page.context().close();
  console.log('banner ok', bg, 'radius', radius);
}

// ---------------------------------------------------------------- tasks: two real ticks
{
  const page = await context(...PHONE);
  const css = '.tk-actions,.tk-add-here{display:none!important} .tk-head .btn,.tk-head button{display:none!important} .tk-bar>*{opacity:0!important} .tk-bar{background:transparent!important}';
  await open(page, '/planning/tasks', css);
  await page.locator('.tk-filter button').nth(1).click(); // "all", so ticked rows stay in place
  await page.waitForTimeout(300);
  const groups = page.locator('.tk-stage');
  const count = await groups.count();
  let target = 0;
  for (let i = 0; i < count; i++) {
    if ((await groups.nth(i).locator('.tk-item.is-done').count()) === 0) { target = i; break; }
  }
  await page.locator('.tk-stage').nth(target).evaluate((n) => n.setAttribute('data-target', '1'));
  const G = '[data-target]';
  manifest.tasks = { checks: [], bar: [] };
  for (let state = 0; state < 3; state++) {
    await sprite(page, '.tk-head', `tasks-head-${state}`);
    await sprite(page, G, `tasks-stage-${state}`);
    manifest.tasks.bar.push(await rect(page, '.tk-bar > *', '.tk-head'));
    if (state === 0) {
      manifest.tasks.barTrack = await rect(page, '.tk-bar', '.tk-head');
      manifest.tasks.stageRadius = await page.locator(G).evaluate((n) => parseFloat(getComputedStyle(n).borderRadius));
      for (let i = 0; i < 2; i++) manifest.tasks.checks.push(await rect(page, `${G} .tk-check__box`, G, { nth: i }));
    }
    if (state < 2) {
      await page.locator(`${G} .tk-check input`).nth(state).check({ force: true });
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(400);
    }
  }
  await page.context().close();
  console.log('tasks ok, stage', target, 'bar', manifest.tasks.bar.map((b) => Math.round(b.w)));
}

// ---------------------------------------------------------------- budget: the total splits into services
{
  const hide = '.bsum__recalc{display:none!important} .bsum{border:0!important}';
  const page = await context(...PHONE);
  await open(page, '/budget', hide);
  manifest.budget = { total: await rect(page, '#bt-total', '.bsum'), values: [], fills: [], tracks: [], tabs: [] };
  const statCount = await page.locator('.bsum__stat').count();
  const meterCount = await page.locator('.bsum__meter').count();
  for (let i = 0; i < statCount; i++) manifest.budget.values.push(await rect(page, '.bsum__stat dd', '.bsum', { nth: i }));
  for (let i = 0; i < meterCount; i++) {
    manifest.budget.tracks.push(await rect(page, '.bsum__meter', '.bsum', { nth: i }));
    manifest.budget.fills.push(await rect(page, '.bsum__fill', '.bsum', { nth: i }));
  }
  await sprite(page, '.bguide__tabs', 'budget-tabs');
  for (let i = 0; i < (await page.locator('.bguide__tab').count()); i++) {
    const name = `budget-tab-${i}`;
    await sprite(page, '.bguide__tab', name, { nth: i });
    manifest.budget.tabs.push({ name, ...(await rect(page, '.bguide__tab', '.bguide__tabs', { nth: i })) });
  }
  const hidden = await page.addStyleTag({ content: '.bsum__stat dd,#bt-total{color:transparent!important;-webkit-text-fill-color:transparent!important} .bsum__fill{opacity:0!important}' });
  await sprite(page, '.bsum', 'budget-sum');
  await hidden.evaluate((n) => n.remove());

  // the venue's price is agreed and a deposit paid, through the real API; the page reports the result
  const budget = await call('GET', '/api/planning/budget');
  const venue = budget.items[0];
  await call('PUT', `/api/planning/budget/items/${venue.id}`, { name: venue.name, estimate: venue.estimate, actualCost: 10000 });
  await call('POST', `/api/planning/budget/items/${venue.id}/payments`, { amount: 3000 });
  await open(page, '/budget', hide);
  manifest.budget.final = {
    values: await page.locator('.bsum__stat dd').allTextContents(),
    fills: [],
  };
  for (let i = 0; i < meterCount; i++) manifest.budget.final.fills.push((await page.locator('.bsum__fill').nth(i).boundingBox()).width);
  await page.context().close();
  console.log('budget ok', manifest.budget.values.map((v) => v.text), '->', manifest.budget.final.values, manifest.budget.tabs.length, 'tabs');
}

// ---------------------------------------------------------------- guests: one reply comes in
{
  const page = await context(...PHONE);
  await open(page, '/guests', '.grow__select,.grow__count,.grow__table,.grow__invited,.grow__actions{display:none!important}');
  const rows = page.locator('.grow');
  let pending = 0;
  for (let i = 0; i < (await rows.count()); i++) {
    if ((await rows.nth(i).locator('.gselect').first().inputValue()) === 'pending') { pending = i; break; }
  }
  await rows.nth(pending).evaluate((n) => n.setAttribute('data-target', '1'));
  manifest.guests = { stats: [] };
  await sprite(page, '.guests__stats', 'guests-stats-0');
  for (let i = 0; i < 2; i++) manifest.guests.stats.push(await rect(page, '.guests__stat', '.guests__stats', { nth: i + 1 }));
  await sprite(page, '[data-target]', 'guests-row-0');
  await sprite(page, '.grow', 'guests-row-b', { nth: pending + 1 });
  await sprite(page, '.grow', 'guests-row-c', { nth: pending + 2 });
  manifest.guests.select = await rect(page, '[data-target] .gselect', '[data-target]');
  manifest.guests.options = await page.locator('[data-target] .gselect').first().evaluate((n) => [...n.options].map((o) => ({ value: o.value, text: o.textContent.trim() })));
  await page.locator('[data-target] .gselect').first().selectOption('yes');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.waitForTimeout(100);
  await sprite(page, '.guests__stats', 'guests-stats-1');
  await sprite(page, '[data-target]', 'guests-row-1');
  await page.context().close();
  console.log('guests ok, pending row', pending, manifest.guests.options);
}

// ---------------------------------------------------------------- seating on the floor plan (desktop layout)
{
  const css = '.seat-canvas-wrap{max-height:none!important;overflow:visible!important;border:0!important;background:transparent!important} .seat-canvas{min-height:1100px!important;width:1000px!important} .seat-table__grip,.seat-chip__remove,.seat-table__toolbar{display:none!important} .seat-plan{opacity:.85!important}';
  const page = await context(1520, 1400, 2, false);
  await open(page, '/seating', css);
  const tables = page.locator('.seat-table');
  const n = await tables.count();
  manifest.seating = { tables: [], plan: { w: 1000, h: 1100 } };
  const canvas = await page.locator('.seat-canvas').boundingBox();
  for (let i = 0; i < n; i++) {
    const box = await sprite(page, '.seat-table', `table-${i}`, { nth: i, pad: 48 });
    manifest.seating.tables.push({ x: box.x - canvas.x, y: box.y - canvas.y, w: box.width, h: box.height, pad: 48 });
  }
  await sprite(page, '.seat-pool .seat-chip', 'guest-chip', { nth: 0 });
  manifest.seating.chipName = (await page.locator('.seat-pool .seat-chip').first().textContent()).trim();
  // the plan alone, as the chart shows it
  await page.addStyleTag({ content: '.seat-table{display:none!important}' });
  await page.locator('.seat-canvas').first().evaluate((n2) => { n2.style.setProperty('min-height', '1100px', 'important'); });
  await sprite(page, '.seat-plan', 'plan');
  await page.context().close();

  // the guest takes a seat at table 2: capture that table again, with the real seat filled
  const list = await call('GET', '/api/planning/guests');
  const name = manifest.seating.chipName.replace(/[^\p{L}\s]/gu, '').trim();
  const seat = list.find((g) => `${g.firstName} ${g.lastName}` === name) ?? list.find((g) => g.attendance === 'pending');
  await call('PUT', '/api/planning/seating/assign', { tableId: auth.tableIds[1], seatIndex: 0, guestId: seat.id, attendeeKind: 'primary' });
  const page2 = await context(1520, 1400, 2, false);
  await open(page2, '/seating', css);
  await sprite(page2, '.seat-table', 'table-1-seated', { nth: 1, pad: 48 });
  const dot = await page2.locator('.seat-table').nth(1).locator('.seat-dot').first().boundingBox();
  const t1 = await page2.locator('.seat-table').nth(1).boundingBox();
  manifest.seating.seat = { x: dot.x - t1.x + dot.width / 2, y: dot.y - t1.y + dot.height / 2 };
  await page2.context().close();
  await call('DELETE', `/api/planning/seating/assign/${auth.tableIds[1]}/0`);
  console.log('seating ok', n, 'tables, chip', manifest.seating.chipName, 'seat', manifest.seating.seat);
}

await browser.close();
writeFileSync(join(here, '..', 'src', 'cap-manifest.json'), JSON.stringify(manifest, null, 1));
console.log('done', Object.keys(manifest).length, 'entries');
