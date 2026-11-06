// Lifts the invitation builder and the finished invitation from the running site (local dev servers)
// for the invitation clip: transparent PNGs of each element in its real before and after states, and
// a manifest with their geometry. Run seed-invite.mjs first, fresh each time: this answers one
// invitation, so a second run would have no "before". What is changed on the way: fields are emptied
// so typing can be drawn on them, secondary fields and the buttons of the guest rows are hidden, and
// the share card shows the live domain, with a QR code that opens the real /invitations page.
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const auth = JSON.parse(readFileSync(join(here, '.demo-invite-auth.json'), 'utf8'));
const WEB = process.env.WP_WEB ?? 'http://localhost:4301';
const OUT = join(here, '..', 'public', 'cap-invite');
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const manifest = {};

const qrcode = createRequire(join(here, '..', '..', 'frontend', 'package.json'))('qrcode-generator');
const browser = await chromium.launch();

async function context(width, height, dpr) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true, locale: 'ka-GE', permissions: ['clipboard-read', 'clipboard-write'] });
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
async function sprite(page, selector, name, { nth = 0 } = {}) {
  const el = page.locator(selector).nth(nth);
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(120);
  const handle = await el.elementHandle();
  await page.evaluate((n) => n.setAttribute('data-sprite', '1'), handle);
  const style = await page.addStyleTag({ content: 'html,body{background:transparent!important} body *{visibility:hidden!important} [data-sprite],[data-sprite] *{visibility:visible!important}' });
  const box = await el.boundingBox();
  await page.screenshot({ path: join(OUT, `${name}.png`), clip: box, omitBackground: true });
  await style.evaluate((n) => n.remove());
  await page.evaluate((n) => n.removeAttribute('data-sprite'), handle);
  manifest[name] = { w: box.width, h: box.height };
}

/** Where an element sits relative to another, with what's needed to draw text in it. */
async function rect(page, selector, originSelector, { nth = 0 } = {}) {
  const r = await page.locator(selector).nth(nth).boundingBox();
  const o = await page.locator(originSelector).first().boundingBox();
  const style = await page.locator(selector).nth(nth).evaluate((n) => {
    const c = getComputedStyle(n);
    return { size: parseFloat(c.fontSize), weight: c.fontWeight, color: c.color, paddingLeft: parseFloat(c.paddingLeft) || 0, radius: parseFloat(c.borderRadius) || 0 };
  });
  return { x: r.x - o.x, y: r.y - o.y, w: r.width, h: r.height, ...style };
}

async function call(method, path, body) {
  const r = await fetch(auth.api + path, { method, headers: { Authorization: `Bearer ${auth.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

const PHONE = [430, 932, 3];
const HERO_H = 390;
const guestPath = `/w/${auth.slug}`;

// ---------------------------------------------------------------- 1. design: three real picks, each redrawing the invitation
{
  const page = await context(...PHONE);
  const guest = await context(...PHONE);
  // Their places in WEDDING_TEMPLATES: only these four stay on the grid, in this order on the page.
  const SHOWN = { glow: 0, sunrise: 9, pardagi: 11, tbilisi: 13 };
  const keep = Object.values(SHOWN).map((i) => `:not(:nth-child(${i + 1}))`).join('');
  await open(page, '/planning/invitation?step=design', `.ib-designs li${keep}{display:none!important}`);
  await sprite(page, '.ib-panel__title', 'title-design');
  manifest.designs = { buttons: {} };
  for (const [key, nth] of Object.entries(SHOWN)) manifest.designs.buttons[key] = await rect(page, '.ib-design', '.ib-designs', { nth });
  // the picks in the clip: it ends on glow, the design the later scenes show
  for (const [state, key] of ['tbilisi', 'sunrise', 'pardagi', 'glow'].entries()) {
    const nth = SHOWN[key];
    await page.locator('.ib-design').nth(nth).click();
    await page.waitForResponse((r) => r.url().includes('/api/planning/website') && r.request().method() === 'PUT').catch(() => {});
    await page.evaluate(() => document.activeElement?.blur());
    await page.waitForTimeout(500);
    await sprite(page, '.ib-designs', `designs-${state}`);
    await open(guest, guestPath);
    await guest.evaluate(() => window.scrollTo(0, 0));
    await guest.screenshot({ path: join(OUT, `hero-${key}.png`), clip: { x: 0, y: 0, width: 430, height: HERO_H } });
    manifest[`hero-${key}`] = { w: 430, h: HERO_H };
  }
  await page.context().close();
  await guest.context().close();
  console.log('design ok');
}

// ---------------------------------------------------------------- the finished invitation (glow)
{
  const page = await context(...PHONE);
  await open(page, guestPath, '.ws__names,.ws__meta,.ws__count{visibility:hidden!important}');
  await page.screenshot({ path: join(OUT, 'hero-bare.png'), clip: { x: 0, y: 0, width: 430, height: HERO_H } });
  manifest['hero-bare'] = { w: 430, h: HERO_H };
  await open(page, guestPath);
  manifest.heroBits = {};
  for (const [sel, name] of [['.ws__names', 'ws-names'], ['.ws__meta', 'ws-meta'], ['.ws__count', 'ws-count']]) {
    manifest.heroBits[name] = await rect(page, sel, '.ws');
    await sprite(page, sel, name);
  }
  await page.locator('article.ws-place').first().screenshot({ path: join(OUT, 'place-card.png') });
  const card = await page.locator('article.ws-place').first().boundingBox();
  manifest['place-card'] = { w: card.width, h: card.height };
  await page.context().close();

  const tall = await context(430, 932, 2);
  await open(tall, guestPath);
  const stops = {};
  for (const [key, sel] of [['places', '.ws-places'], ['schedule', '.ws-sec:has(.ws-sched)'], ['rsvp', 'app-rsvp-form']]) stops[key] = (await rect(tall, sel, '.ws')).y;
  await tall.evaluate(() => window.scrollTo(0, 0));
  await tall.screenshot({ path: join(OUT, 'guest-full.png'), fullPage: true });
  const size = await tall.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight]);
  manifest['guest-full'] = { w: size[0], h: size[1], stops };
  await tall.context().close();
  console.log('invitation ok', size, stops);
}

// ---------------------------------------------------------------- 2. info: only the fields the clip fills in
{
  const page = await context(...PHONE);
  await open(page, '/planning/invitation?step=info', '.ib-field:has(#ib-last),.ib-field:has(#ib-plast),.ib-field:has(#ib-message){display:none!important}');
  await sprite(page, '.ib-panel__title', 'title-info');
  manifest.info = {
    first: await rect(page, '#ib-first', '.ib-form'),
    partner: await rect(page, '#ib-pfirst', '.ib-form'),
    date: await rect(page, '#ib-date', '.ib-form'),
    time: await rect(page, '#ib-time', '.ib-form'),
  };
  // the capture browser would print these the American way: hide it, the clip draws 18.09.2027 and 16:00
  await page.addStyleTag({ content: '#ib-date::-webkit-datetime-edit,#ib-time::-webkit-datetime-edit{opacity:0!important}' });
  await page.evaluate(() => { for (const id of ['ib-first', 'ib-pfirst', 'ib-date', 'ib-time']) document.getElementById(id).value = ''; });
  await sprite(page, '.ib-form', 'info-empty');
  await page.context().close();
  console.log('info ok');
}

// ---------------------------------------------------------------- 3. places: the ceremony, without the map link
{
  const page = await context(...PHONE);
  await open(page, '/planning/invitation?step=places', '.ib-field:has(input[type=url]){display:none!important}');
  await sprite(page, '.ib-panel__title', 'title-places');
  const F = 'fieldset.ib-place';
  await page.locator(F).first().evaluate((n) => n.setAttribute('data-target', '1'));
  const T = '[data-target]';
  manifest.places = {
    name: await rect(page, '#ib-ceremony-name', T),
    addr: await rect(page, '#ib-ceremony-addr', T),
    time: await rect(page, '#ib-ceremony-time', T),
  };
  await page.addStyleTag({ content: '#ib-ceremony-time::-webkit-datetime-edit{opacity:0!important} #ib-ceremony-name::placeholder{color:transparent!important}' });
  await page.evaluate(() => { for (const id of ['ib-ceremony-name', 'ib-ceremony-time', 'ib-ceremony-addr']) document.getElementById(id).value = ''; });
  await sprite(page, T, 'places-empty');
  await page.context().close();
  console.log('places ok');
}

// ---------------------------------------------------------------- 7. share: the link, the code, one real reply
{
  const page = await context(...PHONE);
  const qr = qrcode(0, 'M');
  qr.addData('https://weddingplanner.ge/invitations');
  qr.make();
  const n = qr.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  const css = '.ib-general .ib-note,.ib-general .ib-quiet,.ib-qr figcaption{display:none!important} .ib-party__actions{display:none!important} .ib-party:nth-child(n+4){display:none!important}';
  const dress = () => page.evaluate(({ n, d }) => {
    document.querySelector('.ib-link').textContent = 'weddingplanner.ge/w/nino-giorgi';
    const svg = document.querySelector('.ib-qr svg');
    svg.setAttribute('viewBox', `-2 -2 ${n + 4} ${n + 4}`);
    svg.querySelector('rect').setAttribute('width', n + 4);
    svg.querySelector('rect').setAttribute('height', n + 4);
    svg.querySelector('path').setAttribute('d', d);
  }, { n, d });
  await open(page, '/planning/invitation?step=share', css);
  await page.locator('.ib-qr svg').waitFor();
  await dress();
  await sprite(page, '.ib-panel__title', 'title-share');
  await sprite(page, '.ib-general', 'share-general');
  const copy = await rect(page, '.ib-general .btn--primary', '.ib-general');
  await sprite(page, '.ib-count', 'count-0');
  await sprite(page, '.ib-parties', 'parties-0');
  const first = await rect(page, '.ib-party', '.ib-parties');
  manifest.share = { copy, first };
  await page.locator('.ib-general .btn--primary').click();
  await page.locator('.toast').first().waitFor();
  await sprite(page, '.toast', 'share-toast');

  const parties = await call('GET', '/api/planning/website/parties');
  const party = parties[0];
  const r = await fetch(`${auth.api}/api/sites/${auth.slug}/rsvp/${party.code ?? party.inviteCode}`);
  if (!r.ok) throw new Error(`rsvp read: ${r.status}`);
  const rsvp = await r.json();
  const post = await fetch(`${auth.api}/api/sites/${auth.slug}/rsvp/${party.code ?? party.inviteCode}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ guests: rsvp.guests.map((g) => ({ id: g.id, attendance: 'yes', dietaryNeeds: null, plusOneName: null })), message: null, answer: null }),
  });
  if (!post.ok) throw new Error(`rsvp answer: ${post.status} ${(await post.text()).slice(0, 200)}`);

  await open(page, '/planning/invitation?step=share', css);
  await page.locator('.ib-count').waitFor();
  await sprite(page, '.ib-count', 'count-1');
  await sprite(page, '.ib-parties', 'parties-1');
  await page.context().close();
  console.log('share ok', party.name);
}

await browser.close();
writeFileSync(join(here, '..', 'src', 'cap-invite.json'), JSON.stringify(manifest, null, 1));
console.log('done', Object.keys(manifest).length);
