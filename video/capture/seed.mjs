// Creates one fictional couple (ნინო & გიორგი) in the LOCAL dev database, with enough real data for
// the product clips to show a plan in progress. Never point this at production. Writes the login to
// capture/.demo-auth.json (gitignored), which capture.mjs reads.
// Run the API with Cloudinary__CloudName=" " so the floor plan stays on local disk.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const API = process.env.WP_API ?? 'http://localhost:5119';
if (!/^http:\/\/localhost/.test(API)) throw new Error('seed.mjs only runs against a local API');

async function api(method, path, body, token) {
  const r = await fetch(API + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

const stamp = Date.now().toString(36);
const email = `demo-video-${stamp}@example.com`;
const password = `Demo!${stamp}Video`;
const auth = await api('POST', '/api/auth/register/couple', { email, password });
const t = auth.token;

// ---- the plan ----
await api('PUT', '/api/plan', {
  firstName: 'ნინო', lastName: 'ბერიძე', partnerFirstName: 'გიორგი', partnerLastName: 'კაპანაძე',
  weddingDate: '2027-09-18', city: 'თბილისი', region: 'tbilisi', guestCountRange: '51-100',
}, t);

// ---- tasks: the plan is under way, the next ones are still open ----
const tasks = await api('GET', '/api/planning/checklist', null, t);
for (const task of tasks.slice(0, 9)) {
  await api('PUT', `/api/planning/checklist/${task.id}`, { title: task.title, isDone: true, stage: task.stage, dueDate: task.dueDate, who: task.who }, t);
}

// ---- budget ----
await api('PUT', '/api/planning/budget/total', { totalBudget: 25000, applyEstimates: true }, t);

// ---- guests ----
const G = [
  ['ანა', 'გელაშვილი', 'yes', true, null], ['დავით', 'ლომიძე', 'yes', false, null], ['მარიამ', 'ჯავახიშვილი', 'yes', true, 'ვეგეტარიანელი'],
  ['ლუკა', 'ხარაიშვილი', 'pending', false, null], ['თამარ', 'ნოზაძე', 'yes', false, null], ['ნიკა', 'მაისურაძე', 'yes', true, null],
  ['სალომე', 'ჩხეიძე', 'pending', false, 'მარხვა'], ['ირაკლი', 'გოგიტიძე', 'yes', false, null], ['ეკა', 'დოლიძე', 'no', false, null],
  ['ლევან', 'წერეთელი', 'yes', true, null], ['ნათია', 'კვარაცხელია', 'pending', true, null], ['გურამ', 'ბაქრაძე', 'yes', false, null],
];
const guests = [];
for (const [firstName, lastName, attendance, hasPlusOne, dietaryNeeds] of G) {
  guests.push(await api('POST', '/api/planning/guests', {
    firstName, lastName, relationship: 'friend', attendance, hasPlusOne, plusOneNameUnknown: hasPlusOne, dietaryNeeds,
  }, t));
}

// ---- seating: the venue's floor plan (fictional, drawn here) with tables on its circles ----
const browser = await chromium.launch();
const planPage = await browser.newPage({ viewport: { width: 1000, height: 1100 }, deviceScaleFactor: 2 });
await planPage.goto(pathToFileURL(join(here, 'hall-plan.html')).href);
const planPng = await planPage.screenshot();
await browser.close();
const form = new FormData();
form.append('file', new Blob([planPng], { type: 'image/png' }), 'hall-plan.png');
const up = await fetch(`${API}/api/planning/seating/floor-plan`, { method: 'POST', headers: { Authorization: `Bearer ${t}` }, body: form });
if (!up.ok) throw new Error(`floor plan upload: ${up.status}`);

const CENTRES = [[190, 300], [500, 300], [810, 300], [190, 570], [810, 570], [190, 850], [500, 850], [810, 850]];
const tables = [];
for (const [i, [cx, cy]] of CENTRES.entries()) {
  tables.push(await api('POST', '/api/planning/seating/tables', {
    name: `მაგიდა ${i + 1}`, shape: 'round', seatCount: 8, positionX: cx - 46, positionY: cy - 46, rotation: 0,
  }, t));
}
const coming = guests.filter((g) => g.attendance === 'yes');
for (const g of coming.slice(0, 3)) await api('PUT', '/api/planning/seating/seat-guest', { guestId: g.id, tableId: tables[0].id }, t);
for (const g of coming.slice(3, 5)) await api('PUT', '/api/planning/seating/seat-guest', { guestId: g.id, tableId: tables[2].id }, t);

const out = join(here, '.demo-auth.json');
writeFileSync(out, JSON.stringify({
  token: t, email: auth.email, roles: auth.roles, vendorId: auth.vendorId ?? null,
  tableIds: tables.map((x) => x.id), guestIds: guests.map((g) => g.id), api: API,
}, null, 2));
console.log('seeded', email, '->', out);
