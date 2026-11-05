# Build plan — from "Wedding Planner Guide final.docx" (2026-10-19)

> Source: `Wedding Planner Guide final.docx` (Downloads; Taso, last edited 2026-10-15). It replaces
> the earlier sitemap that `REDESIGN-PLAN.md` condenses; where they disagree, this plan and its
> decisions (§0, answered 2026-10-21) win. CLAUDE.md's site-structure section points here.
>
> Each step lists **Build** (what I do), **You provide** (what I need from you, Beka or Taso)
> and **Waits on** (what must be settled first).

---

## What the guide changes compared with today

| Area | Today | Guide |
|---|---|---|
| Header | 4 menu groups incl. „ჩემი ქორწილი"; CTA after sign-in „ჩემი გეგმა" | 3 menus + sign in + CTA; CTA after sign-in „ჩემი ქორწილი" |
| „დაგეგმე ქორწილი" | dropdown of 4 → `/planning`; a `/plan` page was planned | click → home; dropdown = დღის განრიგები · მოსაწვევები; no separate page |
| Home | 7 chapters, slightly different order | hero → categories → 3 steps → organizer video → 3 schedule examples → FAQ → final call |
| Catalog | 14 flat categories, style tags removed in August | 8 groups with sub-types, per-category filters, search, sort, packages + terms on profiles |
| Tips & ideas | `/guides` with mock articles | hub + blog + inspiration + real weddings, each with list and detail pages |
| Organizer | overview, checklist, budget, guests, seating, website | + tasks by stage/deadline, „ჩემი მომსახურებები" pipeline, wedding-day timeline, invitation with RSVP, settings with partner access, personalised banner |
| Onboarding | 6-step wizard, account last, all required | account first, then date · city · guests · budget, all skippable |
| Invitation | wedding website builder (`/website`, `/w/:slug`) | web invitation: places, details, RSVP, personal links, QR |
| Footer | terms/privacy links 404 | about · help & contact · for vendors · terms · privacy |

---

## 0. Decisions (answered by Rati, 2026-10-21)

| # | Question | Decision |
|---|---|---|
| D1 | CTA after sign-in | **„ჩემი გეგმა"** (stays as shipped in 0519a8a) |
| D2 | „ჩემი ქორწილი" header dropdown | **Removed.** The CTA opens the organizer, which has its own inner menu |
| D3 | A separate `/plan` page | **None.** „დაგეგმე ქორწილი" opens home; its dropdown is დღის განრიგები · მოსაწვევები |
| D4 | Onboarding | **The guide's flow:** account first, then a short form (names, date, city/region, guests, budget), every field skippable with „ჯერ არ ვიცი" |
| D5 | Catalog | **8 groups as navigation, sub-types as vendor categories**, per PROPOSALS.md P1 (existing URLs kept) |
| D6 | Vendor contact | **Both:** on-site message form + vendor inbox, and phone / Instagram / WhatsApp |
| D7 | Invitation | **Evolve the wedding-website builder** into the guide's invitation (keep its designs and public links) |
| D8 | Partner access | **Yes.** One shared wedding record for both accounts, built first in Phase B |
| D9 | RSVP per family | **Yes:** families in the guest list, one personal link per family |
| D10 | Design process | **No mockups first.** Build in the brand theme (CLAUDE.md „Brand palette & type"); Taso reviews afterwards |

All drafts in `PROPOSALS.md` (P1–P11) are approved as written (2026-10-21).

**Defaults I'll use unless you say otherwise (no answer needed):**
- Pricing (guide §9 open item): everything free, no paid packages shown, the Featured flag stays
  dormant (CLAUDE.md §4).
- No booking. Saving or choosing a vendor never means booked; the site says to check the date
  with the vendor.
- Floor plans: a venue's own plan (a PDF, an image or a screenshot of the tables) is uploaded on
  its editor, shown on its profile and offered to couples who saved that venue; the seating chart
  takes a copy. Until a venue provides one, seating uses a generic layout marked as not exact
  (guide §7).
- Real weddings section stays hidden until real stories exist.
- „პასუხისმგებელი" on tasks and the day timeline: free text, with the partner and saved vendors
  suggested.
- URL names for new public pages: I propose them in each step; you approve.

---

## Phase A — Public site (brings couple traffic, CLAUDE.md §3)

### A1. Header, footer, legal pages
- **Status (2026-10-21): done.** Legal text: short default terms + privacy seeded on startup when missing (`LegalPagesSeeder`, 2026-11-05); edit further in the admin content editor. Header per D1–D3: three sections
  whose titles open home, the catalog and the tips hub; dropdowns on hover (desktop), on the arrow
  (phones, keyboards); no „ჩემი ქორწილი" group. The organizer got a minimal inner menu instead
  (B1 builds it out). `/terms` and `/privacy` show their text once it's published in the admin
  content editor. The brand theme now also covers the header and footer on brand pages.
- **Temporary links:** none left. დღის განრიგები opens `/schedules` (2026-10-24), მოსაწვევები
  opens `/invitations` (2026-10-28, B6). In the organizer's inner menu every tab opens its own page
  (ქორწილის დღე B2, დავალებები B3, ჩემი მომსახურებები B4, მოსაწვევი B6).
- **Build:** header per guide §1; dropdowns: დაგეგმე ქორწილი → განრიგები, მოსაწვევები ·
  სივრცეები და მომსახურებები → 8 groups · რჩევები და იდეები → ბლოგი, შთაგონება, რეალური
  ქორწილები. Footer per guide. New `/terms` and `/privacy` pages.
- **You provide:** Terms and Privacy text (from a lawyer, or I draft a starting version for a
  lawyer to check against Georgia's personal-data law); legal entity details (company name, ID
  code, address); support email, phone and social links for „დახმარება და კონტაქტი".
- **Waits on:** D1, D2, D3.

### A2. Catalog + vendor profile
- **Status (2026-10-24): done.** 8 groups / 27 categories (synced from code on every API start),
  `/vendors` with search, group tabs, category chips, per-group filters + „მეტი ფილტრი", price
  sort, per-unit prices; vendor attributes (unit, region, regions served, also offers, styles,
  features, venue fields, terms, up to 5 packages) edited in the vendor dashboard; profile shows
  details, packages, terms, „შეინახე ჩემს ქორწილში", and is on the brand theme (as is `/vendors`).
  Profile JSON-LD gains areaServed + makesOffer. Header/home links open groups.
- **Build:** one `/vendors` page: title + search (name or service) → 8 groups → filters that
  change with the category, extra ones under „მეტი ფილტრი" → sort by price → cards (photo, name,
  location, starting price, save). Switching category happens in place. Profile: name, photos,
  service, location, price; below: portfolio, packages, terms, contact; „შეინახე ჩემს ქორწილში"
  and „დაკავშირება". Vendor dashboard and admin get the new fields. Old URLs redirect if a slug
  changes.
- **You provide:** D5; filters for the 6 groups the guide doesn't specify (it gives photo/video
  and venues only; I can propose); the style list (the guide's photo/video filter needs style tags
  back); the full city/region list (today: 5 cities, while many venues are in Kakheti, Mtskheta,
  etc.); confirm what a package and terms contain (my proposal: package = name, price, what's
  included; terms = deposit, cancellation, travel cost).
- **Waits on:** D5, D6.

### A3. Real vendor profiles (30–50)
- **Status (2026-10-19):** the collection spreadsheet is ready:
  `design-system/templates/vendor-collection.xlsx` (PROPOSALS.md P6). Collecting can start now.
- **Status (2026-10-24): import built; waits on the filled-in spreadsheet.** Admin → „იმპორტი“
  (`/admin?tab=import`): choosing the file checks it and lists what each row will do (add, update,
  skip, error) with reasons in Georgian. Nothing is written until confirmed, optionally published at
  once. Vendors are matched by Instagram, so a fixed sheet can be uploaded again (it updates the
  same profiles, slugs unchanged). Rows without permission (who, when, how) are refused, and the
  permission is stored on the vendor. Photos aren't in the file: each vendor's „რედაქტირება“
  (`/admin/vendors/:id`) opens the vendor editor (profile + photos) for the admin. The admin vendor
  list shows „მფლობელის გარეშე“ and „ფოტოს გარეშე“ badges. Imported profiles have no owner
  account, so they show phone and links but **no message form** (a message would go unread).
  Not imported yet: the English description and the notes column. Deploy: migration
  `VendorConsent`.
- **Done (2026-11-05): takeover.** The vendor sign-up form offers imported listings matching the typed
  name (`GET /api/vendors/claimable`); picking one registers the account with `claimVendorId` and no
  category. The account has no vendor until an admin approves the request on the admin „მოთხოვნები“
  tab (`/api/admin/claims`, approve/reject; the dashboard shows the request's state meanwhile, and the
  vendor signs in again after approval). Original note: a way for a vendor to take over their imported
  profile (e.g. the admin enters their email, the platform links an account and sends a
  set-password link). Until then, a vendor who signs up themselves gets a second profile, and the
  import skips rows that match a vendor who manages their own profile.
- **Build:** admin import from a spreadsheet, so profiles load fast; manual editing stays.
- **You provide:** the vendors, using a spreadsheet template I'll give you: name, category, city,
  Instagram/phone, bio, starting price, packages, terms, photos **with the vendor's permission**;
  for venues also capacity, indoor/outdoor and a floor plan if they have one.
- **Waits on:** A2.

### A4. Tips & ideas + content editor
- **Status (2026-10-21): built; waits on real content.** Admin editor (`/admin?tab=content`) and
  the public pages: hub `/guides`, lists `/guides/blog|inspiration|real-weddings` (topic chips),
  detail pages (title, intro, text, photos, vendor credits, related action, related items,
  Article JSON-LD), old `/guides/<slug>` → 301 to `/guides/blog/<slug>`, sitemap entries. Empty
  sections hide; an empty hub or list is noindex until something is published.
- **Build:** hub with 3 sections → blog (by topic), inspiration and real-weddings pages → detail
  page (title + intro, full content, one related action such as „ნახე ფოტოგრაფები", related
  items). Vendor names in a story link to their profiles. An admin content editor (text, photos,
  SEO title and description, topic, linked category), so content goes live without a developer.
  Each page gets its own URL, title, meta description and Article structured data.
- **You provide:** launch articles in Georgian, at least one per guide topic (starting, budget,
  choosing vendors, guests, day schedule, invitation), with photos you have rights to; inspiration
  sets (photos + short text: colours, decor, flowers, tables, lighting, cakes, invitation designs);
  real weddings only when real (story, photos, vendor list, the couple's written consent); who
  writes. I can draft, but CLAUDE.md requires real content, so someone who knows the subject
  edits every draft.
- **Waits on:** nothing for the build; the content gates launch.

### A5. Home page alignment
- **Status (2026-10-24): done**, apart from the organizer video (C1; the animated phone demo stands
  in) and the prices question (waits on the pricing decision). The home page follows the guide's
  seven sections: hero → categories → three steps → organizer → day schedules → FAQ → final call.
  The day section shows the three P7 schedules as cards with „ნახე განრიგი“ (the full schedule in
  a dialog) and „ნახე ყველა განრიგი“ → `/schedules` (built now: B2's public half). The FAQ gains
  the invitation question, with P9's answer (link or QR code, replies in the guest list) since B6. The own-vendor answer points to
  „ჩემი მომსახურებები“ since B4. Since B1 (2026-10-27) the date can be
  skipped and partners share the plan, so those two answers hold now.
- **Build:** reorder to the guide's 7 sections; FAQ on starting, adding your own vendor, the
  invitation and prices; the day section shows 3 scenario cards with „ნახე განრიგი" (modal) and
  „ნახე ყველა განრიგი".
- **You provide:** FAQ answers (I draft, you approve); the 3 schedule scenarios (see B2); the
  organizer video (see C1; a poster image stands in until then).
- **Waits on:** schedule scenario content.

---

## Phase B — „ჩემი ქორწილი" organizer

### B1. Foundation: shared plan, onboarding, settings, return-after-sign-in
- **Status (2026-10-27): done.** One shared plan per couple (the `Couples` row) with up to two
  people (`CoupleMembers`); checklist, budget, guests, seating, invitation and saved vendors all
  belong to it. Migration `SharedPlan` moved every existing account's data onto its plan and can't
  be rolled back (restore a backup instead). Partner access: one invitation link at a time,
  single-use, 14 days, shown once (`/partner/<token>`), also emailed when mail is set up (link
  only until then); either person can remove the other or leave (they get a new, empty plan).
  Joining while having a plan with content asks first. Sign-up is account first (`/signup`), then
  the start form (`/planning/start`: names, date, city + region, guests, budget, each with
  „ჯერ არ ვიცი“, or skip it all); a first Google sign-in goes there too; someone invited skips it.
  `/planning/settings` edits the details and partner access. A guest's „შეინახე“ on a vendor is
  remembered through sign-up and done on return; „გამოიყენე ეს განრიგი“ comes with B2. The inner
  menu has all nine tabs (one still points at the nearest page, see A1). Existing pages keep
  their empty states. The gold ring video (`public/media/gold-ring.webm`) plays in the home page's
  final section (in place of the drawn rings), on the start form and on the invitation page (a
  still in Safari, on iPhones and under reduced motion; the video loads only near the screen). `/join`
  redirects to `/signup`.
- **Build:** shared wedding record (D8), with existing organizer data moved onto it; onboarding per
  D4; Settings (basic info, date, place, guest estimate, partner access); after sign-in or
  registration the site returns to the action that started it (save vendor, use a schedule, start
  an invitation) with the choice kept. Inner menu: მიმოხილვა · დავალებები · ბიუჯეტი · ჩემი
  მომსახურებები · სტუმრები · დასხდომის გეგმა · ქორწილის დღე · მოსაწვევი · პარამეტრები. Empty
  sections show one clear action („დაამატე პირველი სტუმარი").
- **You provide:** D4, D8; how the partner is invited: a copy-paste link (works today) or email
  (needs an email service, see C3).
- **Waits on:** D4, D8.

### B2. Day schedules (public) + „ქორწილის დღე" tool
- **Status (2026-10-24): public half done** with A5: `/schedules` (cards, the full schedule in a
  dialog, in the server HTML and the sitemap), data in `frontend/src/app/core/day-schedules.ts`
  (ka + en). Still to build: „გამოიყენე ეს განრიგი“ and the organizer's „ქორწილის დღე“ tool.
- **Status (2026-10-27): done.** `/planning/day` („ქორწილის დღე“, in the organizer menu, shared by
  both partners): activities in time order (after-midnight times last, no time at the end), each
  with time, activity, note, who's responsible and contact (a phone becomes a call link). Start
  from one of the three examples or blank; add, edit, delete, clear; changing a time moves the
  activity, and activities at the same time can be moved up or down. "Who" suggests the two of
  them and their saved vendors, and picking a vendor fills in its phone. „გამოიყენე ეს განრიგი“ in
  every example dialog (home and `/schedules`): a couple goes straight to their day with it; a
  guest signs up (start form first) or signs in and lands there with it; a day that already has
  activities asks before replacing them; vendors and admins don't see the button. Migration
  `WeddingDay`.
- **Build:** public page with every scenario as a card (short description + a piece of the
  timeline) → full example in a modal (times, activities, „გამოიყენე ეს განრიგი"); no page per
  example. Using one saves it into Wedding day, going through sign-in or registration first if
  needed (guide §3). Wedding day: activities by time, each with time, responsible person and
  contact; start from a template or blank; edit, reorder, add, delete.
- **You provide:** the scenarios, at least the guide's three (ceremony and party in one place;
  different places; reception and party only), each as time · activity · short note · who's
  responsible, true to Georgian practice (church ceremony, civil registration, supra with tamada…).
  I can draft them; Beka or Taso confirms they're realistic.
- **Waits on:** B1.

### B3. Tasks
- **Status (2026-10-27): done.** `/planning/tasks` („დავალებები“, in the organizer menu, shared by
  both partners): tasks by stage (12+ months … 1 week, after the wedding, and "other" for the
  couple's own), progress, a filter (to do / all / done), add (also straight into a stage), edit,
  tick off, delete. Deadlines count back from the wedding date (the start of each stage's window;
  31 March − 1 month = 28 February), or the couple sets their own; overdue tasks are marked in
  peach. Without a date, tasks show by stage only, with a link to add the date. "Who" suggests the
  two names. Tasks open the right place: catalog categories (venue → `/vendors?category=darbazi`),
  budget, guests, settings, invitation, wedding day, seating, „ჩემი მომსახურებები“. New plans get the P8
  starter list (34 tasks) in the couple's language; plans made earlier keep their tasks, the old
  ten defaults get a stage and link (migration `Tasks`). The overview shows the five next tasks
  with a link to all. Not done: the organizer overview's redesign is B7.
- **Build:** tasks by stage with due dates counted back from the wedding date, status, responsible
  person; add, edit, complete; tasks that open the right place („შეარჩიე სივრცე" → catalog
  venues).
- **You provide:** the starter task list: stages, tasks, when each is due relative to the date
  (e.g. "12 months before"), and which catalog category each links to. I can draft it from today's
  10 tasks; you verify.
- **Waits on:** B1.

### B4. Budget + „ჩემი მომსახურებები"
- **Status (2026-10-27): done.** `/planning/services` („ჩემი მომსახურებები“, in the organizer menu,
  shared by both partners; `/saved` redirects there): every vendor the couple is considering, in
  sections არჩეული · მოკლე სიაში · შენახული with a status filter. The catalog heart adds a vendor
  as „შენახული“; „+ საკუთარი მომწოდებლის დამატება“ adds one found elsewhere (name, category,
  phone, email, Instagram). Each card shows photo or initial, category, city, price from, contacts
  (taps on a catalog vendor count as contact clicks in its stats), the offer (price + what it
  includes) and a note, with a three-way status switch. Choosing a vendor offers to put the agreed
  price into the budget with the next payment's due date: it fills the line that already has the
  vendor, else an empty line of its category, else a new one, and never overwrites another
  vendor's line. A heart tap won't drop a vendor that is shortlisted, chosen or has an offer or
  note (it says to remove it from the list instead). Budget (now on the brand theme): planned ·
  agreed · paid · left to pay, the next payment due, and payments recorded per line (amount, date,
  note: deposit, instalments, "mark the rest as paid"); paid is their sum and is no longer typed in.
  Lines paid in full drop out of the reminders. Migration `ServicesAndPayments` turns saved vendors
  into „შენახული“ services and each line's earlier paid amount into one payment. The home FAQ's
  own-vendor answer now points to „ჩემი მომსახურებები“.
- **Build:** budget shows total, planned vs agreed costs, deposits, remaining amounts and due
  dates; record payments. My services: saved → shortlisted → chosen; contacts and offers per
  vendor; add a vendor found elsewhere by hand. Agreeing a price offers to add the amount and
  payment dates to the budget.
- **You provide:** nothing beyond approving wording.
- **Waits on:** B1, A2.

### B5. Guests + seating (extends what exists)
- **Status (2026-11-05): done.** Floor plans from venues since 2026-11-05: the venue (or an admin
  finishing an imported profile) uploads its plan on the editor's venue fieldset — a PDF, an image
  or a screenshot of the tables; a PDF's first page is drawn to a PNG in the browser (pdf.js,
  loaded only then; its worker is an angular.json asset at `/pdfjs/`), so the API stores images
  only. The profile links it („გეგმის ნახვა“). The seating chart offers it by name to a couple who
  saved, shortlisted or chose that venue („გამოიყენე X-ის გეგმა“, the chosen one first) and copies
  the image (`IPhotoStorage.CopyAsync`), so the venue replacing or removing theirs never blanks a
  chart laid out on it; the couple's own upload (now also PDF) replaces the copy. Migration
  `VendorFloorPlan` (additive). No scale or dimensions: tables are placed by eye.
  Both pages are on the brand theme. Guests: whether each party is coming (მოდის · პასუხს
  ველოდებით · არ მოდის, changed right in the row), dietary needs (typed or quick picks, shown as a
  small tag), the table each party sits at (picked in the row: the whole party takes free seats
  together; tables without room are greyed out), and families (D9): select guests → „ოჯახში
  დამატება“ or a new family; the list is grouped by family with rename/delete (deleting keeps the
  guests). Counts: guests, coming, awaiting reply, not coming, children, dietary needs; a filter by
  attendance. Seating: the counts (tables, seats, free seats, unseated guests), the unseated pool
  grouped by family, guests who said no left out; tables and zones turn in 15° steps; zones take
  their own name and size; the couple can upload the venue's floor plan as the canvas background
  (show/hide, replace, remove); download as an image (the drawing plus the names table by table),
  a printable list per table with dietary needs (print or save as PDF), and the phone's share
  sheet where available. Guest changes reach the seating: declining, or dropping a plus-one or
  child, frees their seats. Migration `GuestsAndSeating` (additive). Families get their one RSVP
  link in B6.
- **Build:** guests: attendance, dietary needs, table/seat, families (D9). Seating: the venue's
  floor plan when one exists; tables (shape, size, seats; add, move, rotate, delete); zones (dance
  floor, band, cake…); drag guests onto a table or seat; counts (tables, seats, free seats,
  unseated guests); download and share. Guest changes show up in seating automatically.
- **You provide:** D9; who collects floor plans from venues (guide §9 open item). Any PDF, image
  or screenshot works now; room size in metres would allow a true scale later.
- **Waits on:** B1.

### B6. Invitation + public „მოსაწვევები" page
- **Status (2026-10-28): done**, apart from the creation video (C1). The wedding-website builder
  became the invitation (D7) and moved into the organizer at `/planning/invitation` (`/website`
  redirects; public links stay `/w/<slug>`). Seven steps with a live preview: design (14 designs,
  a typeface for the names, colours, main photo with focal point, up to 6 more photos) → info
  (names, date, start time, greeting; prefilled from the plan, place line from its city) → places
  (ceremony and reception: name, address, time, the couple's map link or a map search) → extras
  (short schedule, copyable from „ქორწილის დღე“ without contacts; dress code; transport;
  accommodation; only ticked ones show) → RSVP (on/off, deadline, food needs with P10's options,
  a message, one question of their own) → phone and desktop preview, publish → share (general link
  with QR; a personal link per family and per guest invited alone, with copy link, a ready message,
  the phone's share sheet, and a QR PNG captioned with the family's name). A personal link
  (`/w/<slug>/<code>`, noindex) shows only that family's names; each guest row answers coming or
  not, food needs, the plus-one's name when unknown. Answers land in Guests (a mark, the message
  and the answer on the family) and a "no" frees seats. The general link only explains personal
  links. Fonts on invitations stay the OFL faces already on the site (Noto Serif/Sans Georgian,
  FiraGO) until the GF Aisi licence is confirmed for them. Public `/invitations`: an example in a
  phone, all designs, what it does, the steps, „შექმენი მოსაწვევი“; `/invitations/find` is the
  old site finder. Guest-list food picks now use P10's words. Migration `Invitation` (additive).
- **Build (D7):** 7 steps: design (template, colours, fonts, photos) → info (names, date, time,
  text, prefilled) → places (ceremony and reception addresses, map links) → extra details (short
  schedule, dress code, transport, accommodation; only chosen ones show) → RSVP (deadline,
  questions such as dietary needs) → phone and desktop preview, publish → share link or QR code;
  later edits update the same link. Guests: personal link per guest or family, a general link for
  viewing; replies land in Guests and are ready for seating; budget, tasks and the full guest list
  never show. Public page: design examples, a short creation video, a finished preview,
  „შექმენი მოსაწვევი".
- **You provide:** D7; invitation designs (reuse the 10 existing ones, or Taso sends new ones);
  confirmation that the GF Aisi licence covers fonts on couples' published invitations (otherwise,
  which fonts to use); the RSVP dietary options (e.g. vegetarian, vegan, fasting, allergies);
  the creation video (C1).
- **Waits on:** B1, B5.

### B7. Overview + personalised banner
- **Status (2026-10-28): done**, apart from the default banner visual and Taso's palettes (first
  versions in place, see "You provide"). `/planning` is on the brand theme. The banner follows the
  couple's choices: the standard visual (for now the home hero, `/media/hero-wide.webp`) → the photo
  of the venue chosen in „ჩემი მომსახურებები“ → their palette (8 first palettes in
  `core/palettes.ts`; it tints the scrim and shows as swatches) → the décor, flower, cake and table
  photos they marked, laid out by count (a mosaic on wide screens, a strip on phones). Photos are
  marked with a button on venue, décor, florist, rental and cake profiles and on inspiration ideas
  (topics décor, colours, lighting, flowers, tables, cakes); up to 24, gone if the source photo is
  deleted. „ბანერის მორგება“ shows the four stages, the palette picker and the marked photos. Then
  the next step (budget → venue → late tasks → guests → invitation → seating → day) and one block per
  tool: tasks (progress, overdue, the next five, tick in place), budget and payments (total,
  agreed, paid, left, next three dated payments), services (counts, chosen list), guests and replies
  (people by answer, food needs, replies to the invitation with the latest messages), seating,
  invitation, wedding day, planning together. One summary read (`/api/planning/overview`) feeds it.
  „დეტალების შეცვლა“ opens settings; „დაიწყე თავიდან“ stays in the tasks block. Migration `Overview`
  (additive).
- **Build:** overview: names, date, optional countdown; progress, next tasks, budget and payments;
  each block opens its tool. The banner background changes as choices are made: standard visual →
  chosen venue's photo → the couple's palette → marked decor, flower, cake and table photos, laid
  out automatically; no separate moodboard tab; text stays readable.
- **You provide:** the default banner visual; a set of colour palettes couples can pick from
  (Taso).
- **Waits on:** B3, B4.

---

## Phase C — Finish and launch

### C1. Videos
- Organizer preview (home §4) and invitation creation (invitations page). I can record clean
  screen captures of the real app once Phase B is done; Taso edits and brands them.
- **You provide:** who produces them; the final files (MP4/WebM, under ~3 MB each, plus a poster
  image).

### C2. Review passes
- **Status (2026-10-29): first round done.** The `web-design-guidelines` and `impeccable` skills weren't
  available, so axe-core (WCAG 2.1 A/AA + best practice) ran on 43 surfaces as visitor, couple,
  vendor and admin, plus phone widths and screenshots. From 5 rule types on 9 pages to none, apart
  from two accepted: the calligraphy design's decorative monogram in thumbnails, and axe not seeing
  the photo behind the signed-out `/planning` hero. Fixes: home carousel dots; invitation designs'
  muted text raised to 4.5:1 (9 of 14 designs), countdown and labels off the accent colour; links in
  text charcoal and underlined; nested asides; the dashboard's progress label; the warning badge
  colour; long arrow links wrap on phones. Look: every page is on the brand theme now (login,
  about, contact, 404, category × city, for vendors, account, vendor dashboard, admin), applied on
  `<body>`; no pink buttons left; ivory page background. SEO/SSR: every public page arrives
  server-rendered (title, one h1, content); numbers and dates format the same on server and browser
  (`core/money.ts`, `core/dates.ts`); about and contact have their own descriptions; login, sign-up,
  vendor sign-up, dashboard and admin are noindex; descriptions no longer carry over between pages.
  Speed: English loads on demand (first load 860 → 778 kB, 155 kB transferred). Code review (high)
  of the C2 changes: 9 findings, all fixed; the committed B1–B7 code was only spot-checked (a full
  review of the branch is the `max`/`ultra` level). Left for C3: canonical links and the sitemap
  line in robots.txt need the domain.
- `web-design-guidelines` (accessibility) and `impeccable` (generic look) per surface, code
  review, tests, SSR and SEO checks. Nothing needed from you.

### C3. Launch (CLAUDE.md §10)
- **You provide:** final brand name, logo (SVG) and favicon; domain; hosting account
  (`render.yaml` targets Render); production Postgres; Cloudinary production keys; Google OAuth
  client ID; admin email and password; an SMTP email service account and a verified sender
  domain (any provider on port 587; "forgot password" is built (2026-10-19) and sends through it,
  and email partner invites would too); Google Search Console access, plus analytics if you want
  it (the privacy page must then cover cookies).
