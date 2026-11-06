// Creates one fictional couple (ნინო & გიორგი) with a finished invitation in the LOCAL dev database,
// for the invitation clip. Never point this at production. Writes the login to
// capture/.demo-invite-auth.json (gitignored), which capture-invite.mjs reads.
// Run the API with Cloudinary__CloudName=" " so the photo stays on local disk.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const API = process.env.WP_API ?? 'http://localhost:5119';
if (!/^http:\/\/localhost/.test(API)) throw new Error('seed-invite.mjs only runs against a local API');

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
const email = `demo-invite-${stamp}@example.com`;
const password = `Demo!${stamp}Video`;
const auth = await api('POST', '/api/auth/register/couple', { email, password });
const t = auth.token;

await api('PUT', '/api/plan', {
  firstName: 'ნინო', lastName: 'ბერიძე', partnerFirstName: 'გიორგი', partnerLastName: 'კაპანაძე',
  weddingDate: '2027-09-18', city: 'თბილისი', region: 'tbilisi', guestCountRange: '51-100',
}, t);

// ---- guests, so the share step has personal links to show ----
const G = [['ანა', 'გელაშვილი', true], ['დავით', 'ლომიძე', false], ['მარიამ', 'ჯავახიშვილი', true], ['ლუკა', 'ხარაიშვილი', false], ['თამარ', 'ნოზაძე', false]];
for (const [firstName, lastName, hasPlusOne] of G) {
  await api('POST', '/api/planning/guests', { firstName, lastName, relationship: 'friend', attendance: 'pending', hasPlusOne, plusOneNameUnknown: hasPlusOne }, t);
}

// ---- the invitation: every place is fictional ----
const site = {
  templateKey: 'glow',
  firstName: 'ნინო', lastName: 'ბერიძე', partnerFirstName: 'გიორგი', partnerLastName: 'კაპანაძე',
  weddingDate: '2027-09-18', place: 'თბილისი', message: null, inkColor: null, accentColor: null,
  photoFocusX: 50, photoFocusY: 50, startTime: '16:00', fontKey: null,
  ceremonyName: 'წმინდა გიორგის ეკლესია', ceremonyAddress: 'თბილისი, ვარდების ქუჩა 12', ceremonyTime: '16:00', ceremonyMapUrl: null,
  receptionName: 'შატო მცხეთა', receptionAddress: 'მცხეთა, ვენახების გზა 7', receptionTime: '18:30', receptionMapUrl: null,
  dressCode: 'ღია ფერები.', transport: null, accommodation: null,
  schedule: [
    { time: '16:00', text: 'ჯვრისწერა' },
    { time: '18:30', text: 'სტუმრების მიღება' },
    { time: '19:30', text: 'ვახშამი და სადღეგრძელოები' },
    { time: '22:00', text: 'ტორტი და ცეკვა' },
  ],
  rsvpEnabled: true, rsvpDeadline: '2027-08-15', rsvpAskDiet: true, rsvpAskMessage: true, rsvpQuestion: null,
};
await api('PUT', '/api/planning/website', site, t);

// the same photo the site itself uses
const photo = readFileSync(join(here, '..', '..', 'frontend', 'public', 'media', 'hero-tall.webp'));
const form = new FormData();
form.append('file', new Blob([photo], { type: 'image/webp' }), 'photo.webp');
const up = await fetch(`${API}/api/planning/website/photo`, { method: 'POST', headers: { Authorization: `Bearer ${t}` }, body: form });
if (!up.ok) throw new Error(`photo upload: ${up.status} ${(await up.text()).slice(0, 200)}`);
const withPhoto = await up.json();
if (/cloudinary/i.test(withPhoto.photoUrl ?? '')) throw new Error(`the photo went to Cloudinary, not local disk: ${withPhoto.photoUrl}. Restart the API with Cloudinary__CloudName=" "`);
const published = await api('POST', '/api/planning/website/publish', {}, t);

writeFileSync(join(here, '.demo-invite-auth.json'), JSON.stringify({ token: t, email: auth.email, roles: auth.roles, vendorId: auth.vendorId ?? null, api: API, slug: published.slug, photoUrl: published.photoUrl, site }, null, 2));
console.log('seeded', email, 'slug', published.slug, 'photo', published.photoUrl);
