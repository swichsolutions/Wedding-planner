# Redesign plan — from the Georgian sitemap (2026-10-07)

> Source of truth: `Wedding_Planner_Sitemap_GE_Updated.docx` on the user's Desktop (OneDrive).
> The user will keep editing it. When it changes, re-read it and update this file — do not
> carry old decisions forward silently.
>
> This is a **full redesign**. Nothing from the previous "Editorial Georgian / pink" UI is
> preserved on purpose: not colors, not layout, not copy. The old pages still exist and still
> build; they get redesigned one by one in the order below.

---

## 1. What the sitemap says (condensed)

**Promise.** Plan your own wedding with a clear plan, the right people, and everything in one
place. The platform answers three pains: the cost of hiring a planner, hunting for services
one by one, and not knowing how to sequence the wedding day.

**Three needs that shape the structure:** help me start · help me find the people · help me
organize everything. Public site = discover + search. Personal organizer ("ჩემი ქორწილი") =
turn choices into a plan.

**Header (keep it short):**

| Item | Purpose | Route (now → final) |
|---|---|---|
| Logo | back to home | `/` |
| დაგეგმე ქორწილი | where to start, planning stages, day-schedule examples, organizer intro | `/planning` now → `/plan` when built |
| სივრცეები და მომსახურებები | catalog of venues/services/shops by category | `/vendors` |
| რჩევები და იდეები | practical tips, inspiration, real weddings | `/guides` |
| შესვლა | sign in | login modal |
| **დაიწყე დაგეგმვა** (CTA) | registration; after sign-in becomes **ჩემი ქორწილი** | `/signup` → `/planning` |

**Footer:** ჩვენ შესახებ · დახმარება და კონტაქტი · მომწოდებლებისთვის · წესები და პირობები ·
კონფიდენციალურობა. If paid packages exist, they must be easy to find.

**Navigation rules.** Budget, tasks, guest list live inside the organizer, not the menu.
Service categories live in the catalog, not the menu. Everything public is browsable
without an account; an account is required only to save a vendor or create a plan, and
the user must see clearly what registration gives them.

**Home page, section by section** (each = one heading, short explanation, one visual, one
link deeper; one *example wedding* runs through the whole page: its first plan → chosen
venue → budget → day schedule; Revolut-style progressive disclosure):

| # | Stage / question | Content | CTA |
|---|---|---|---|
| 01 | დაპირება — "შევძლებ თავად ორგანიზებას?" | strong visual + short text: clear plan, the vendors you need, all in one place | **დაიწყე დაგეგმვა** + link: სივრცეები და მომსახურებები |
| 02 | დასაწყისი — "საიდან დავიწყო?" | the process in short: define your wedding, pick the essentials, plan details; the plan adapts to date, guest count, budget | ნახე, როგორ მუშაობს დაგეგმვა |
| 03 | ადამიანები და ადგილი — "სად ვიპოვო ყველაფერი?" | a few category cards: venues, photo/video, decor, music, cake, attire & beauty | ნახე ყველა კატეგორია |
| 04 | ორგანიზება — "როგორ ვაკონტროლო ყველაფერი?" | one clear organizer example: tasks, budget, saved vendors together | შექმენი შენი ქორწილის გეგმა |
| 05 | დღის მიმდინარეობა — "რა რის შემდეგ უნდა მოხდეს?" | editable schedule example: guests arrive, optional ceremony, dinner, speeches, dancing | ნახე ქორწილის დღის გეგმები |
| 06 | ნდობა — "ნამდვილად დამეხმარება?" | real experiences *when available*; a few practical Q&A | დაიწყე დაგეგმვა |

Feeling arc: შევძლებ → ვიცი საიდან დავიწყო → ვიპოვი → თავს მოვუყრი → უკვე წარმომიდგენია ჩემი დღე.
Wedding-day planning (templates) is a core product feature, not a nice-to-have.

**Still open in the sitemap (do not claim on the site):** free vs paid organizer; contact
on- or off-platform; confirmed bookings; which reviews / real weddings exist at launch.
Therefore: no testimonials are invented, no "booking" wording, "შეამოწმე თარიღის
ხელმისაწვდომობა" instead of "book".

---

## 2. Design direction — "Program on Paper" (საქორწილო პროგრამა)

The landing reads like a well-set wedding program booklet: numbered chapters, hairlines,
dotted leaders (`ცერემონია ........ 17:00`), big condensed Georgian headlines, serif body
text, one couple's wedding told from first plan to the dance floor. Calm, organized,
confident — the feeling the product promises.

Full spec in `MASTER.md`. Summary:

- **Canvas:** limestone paper `#F1EDE4`, deeper paper bands `#E7E1D4`, white cards.
- **Ink:** `#15171A`. **Dark band:** spruce `#1F3D33` (hero bottom, organizer, footer).
- **One accent:** clay `#C2451F` (CTA, markers); `#F0906A` for accents on spruce.
- **Display type:** Noto Sans Georgian, width axis 70, weight 700–800, tight tracking.
- **Body type:** Noto Serif Georgian 400. UI labels: Noto Sans Georgian 500/600.
- Both fonts are already loaded in `index.html`; no new font dependency.
- Mobile-first; 16px side gutter; no horizontal scroll; hero fits 375px.
- Motion: one staggered hero reveal on load + scroll reveals (IntersectionObserver,
  browser-only, SSR renders everything visible); `prefers-reduced-motion` disables all.

**Avoided on purpose:** pink/garnet from v1, cream+serif "AI wedding" look, uniform card
grids, emoji icons, invented reviews, fake logos.

---

## 3. Build order

### Step 1 — Landing page (THIS STEP, done)
- `styles/_tokens.scss` rewritten for the new system. Legacy token names kept as aliases
  (mapped onto the new palette) so untouched pages keep building until each is redesigned.
- App shell (`app.html/scss/ts`): new header and footer exactly per sitemap.
- `pages/home/*` rewritten: 6 chapters above, example wedding (ნინო & გიორგი, 12.09.2027,
  კახეთი, 120 სტუმარი, 28 000 ₾) threaded through hero → start → venue → organizer → day.
- i18n: `nav`, `footer`, `home` blocks replaced in `ka.json` + `en.json`.
- Trust section = practical FAQ + "what you get with an account". Real-weddings slot is
  left as a commented placeholder until real content exists.
- Verified: `ng build` passes, SSR renders Georgian, screenshots at 375 / 768 / 1280.

### Step 2 — დაგეგმე ქორწილი (`/plan`)
Public page: საიდან დავიწყო · დაგეგმვის ეტაპები · ქორწილის დღის შაბლონები (editable
template preview) · პირადი ორგანიზატორის გაცნობა. Re-point header + home CTAs to it.

### Step 3 — სივრცეები და მომსახურებები (rebuild `/vendors`)
One page: 8 category groups on top, results + per-category filters swap in place, sort,
list cards (photo, name, location, starting price, save). Vendor profile page: answers
first (what, work samples, where, starting price, contact / check date, save).

### Step 4 — რჩევები და იდეები (rebuild `/guides`)
Three sections (practical tips · inspiration · real weddings), card → article page with
related action ("ნახე ფოტოგრაფები") and related content.

### Step 5 — ჩემი ქორწილი (organizer)
Sections 01–07 per sitemap, first-login questions (date / city / guests / budget, all
skippable), personalized overview background, seating plan linked to guest list.
Existing budget / guests / seating features move under this roof.

### Step 6 — Static pages
`/terms`, `/privacy` (new), about / contact / for-vendors restyled. Footer links already
point to these routes.

---

## 4. Header dropdowns (added 2026-10-07)
Four groups, each a dropdown (sitemap §02 allows details on hover). Data in `app.ts` `navGroups`,
labels in `nav.g.*`. Items whose page does not exist yet point at the nearest existing page:
- დაგეგმე ქორწილი → საიდან დავიწყო · დაგეგმვის ეტაპები · ქორწილის დღის შაბლონები · ორგანიზატორის გაცნობა
  (all → `/planning` until `/plan` exists)
- სივრცეები და მომსახურებები → 8 category groups (`/vendors?category=…`, mapped to today's slugs) + all
- რჩევები და იდეები → პრაქტიკული რჩევები · შთაგონება · რეალური ქორწილები (all → `/guides` until sections exist)
- ჩემი ქორწილი → მიმოხილვა, დავალებები (→ `/planning`), ბიუჯეტი `/budget`, სტუმრები `/guests`,
  დასხდომის გეგმა `/seating`, ქორწილის ვებგვერდი `/website` — the older tool pages live here.

## 5. Known temporary links (fix in the step that builds the page)
- Header "დაგეგმე ქორწილი" → `/planning` (should be `/plan`).
- Home 02 CTA → `/planning` (should be `/plan#how-it-works`).
- Home 03 category cards → `/vendors` with `?category=` (should be the in-page category).
- Home 05 CTA → `/planning` (should be `/plan#day-templates`).
- Footer "წესები და პირობები" → `/terms`, "კონფიდენციალურობა" → `/privacy` (404 until Step 6).
