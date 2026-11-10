# Drafts for approval (2026-10-19)

> **Status: all sections approved by Rati on 2026-10-21 ("approve all of them for now").** They
> are the working spec; anyone may still correct a section in place, and the code follows.
>
> These are the drafts `BUILD-PLAN.md` promised ("I can propose / draft, you approve").
>
> Georgian content (tasks, schedules, FAQ) needs a check by someone who knows real Georgian
> weddings. Where I'm unsure of a custom, the section says so.

| # | Draft | Unblocks |
|---|---|---|
| P1 | Catalog categories, names and URL slugs | A2 catalog, A3 vendor import |
| P2 | Filters per group | A2 |
| P3 | Style list | A2 (photo/video and decor filters) |
| P4 | Cities and regions | A2, A3 |
| P5 | What a package and the terms contain | A2 profile, A3 |
| P6 | Vendor collection spreadsheet | A3: you can start collecting vendors now |
| P7 | Day-schedule scenarios | A5 home section 5, B2 |
| P8 | Starter task list | B3 |
| P9 | FAQ answers | A5 |
| P10 | RSVP food options | B6 |
| P11 | URL names for new public pages | A4, B2, B6 |

---

## P1. Catalog categories (decision D5)

The 8 groups from the guide are the catalog's navigation. Inside each group, a vendor picks one
**sub-type**, which keeps a public URL like `/fotografi/tbilisi/<vendor>`. The 14 existing slugs
stay exactly as they are (they're live URLs); 13 sub-types are new (27 in all). New slugs follow the site's
transliteration (ც → ts, ხ → kh, ყ → q, ჭ → ch), except the loanword ქეითერინგი, which reads
better as `keiteringi` than the helper's `qeiteringi`.

| Group | Sub-type (ka) | English | Slug | |
|---|---|---|---|---|
| **სივრცეები და კვება** | სივრცეები (რესტორნები, დარბაზები, ღია სივრცეები, მარნები, სასტუმროები) | Venues | `darbazi` | existing |
| | ქეითერინგი | Catering | `keiteringi` | new |
| **ფოტო და ვიდეო** | ფოტოგრაფი | Photographer | `fotografi` | existing |
| | ვიდეოგრაფი | Videographer | `videografi` | existing |
| **დეკორი და ყვავილები** | დეკორატორი | Decorator | `dekori` | existing |
| | ფლორისტი | Florist | `floristi` | existing |
| | ავეჯისა და ინვენტარის გაქირავება | Furniture & equipment rental | `inventari` | new |
| **მუსიკა და გართობა** | ბენდი და DJ | Band & DJ | `musika` | existing |
| | თამადა | Tamada | `tamada` | new |
| | წამყვანი | Host / MC | `tsamqvani` | new |
| | გასართობი პროგრამა (ანსამბლი, შოუ) | Entertainment (ensembles, shows) | `gasartobi` | new |
| **ტორტი და ტკბილეული** | საქორწილო ტორტი | Wedding cake | `torti` | existing |
| | დესერტები და ტკბილეულის მაგიდა | Desserts & sweet table | `tkbileuli` | new |
| **სამოსი და აქსესუარები** | საქორწილო კაბა | Wedding dress | `kaba` | existing |
| | კოსტიუმი | Suit | `kostiumi` | existing |
| | ფეხსაცმელი | Shoes | `pekhsatsmeli` | new |
| | აქსესუარები | Accessories | `aksesuarebi` | new |
| | ბეჭდები და სამკაული | Rings & jewellery | `bechdebi` | existing |
| **სილამაზე და მომზადება** | მაკიაჟი | Makeup | `makiaji` | existing |
| | თმის სტილისტი | Hair | `tmis-stili` | existing |
| | მანიკიური | Nails | `manikiuri` | existing |
| | სილამაზის სალონი | Beauty salon | `saloni` | new |
| | მოვლის მომსახურებები (სპა, კანის მოვლა) | Care (spa, skincare) | `movla` | new |
| **სხვა მომსახურებები** | ტრანსპორტი | Transport | `transporti` | existing |
| | ბეჭდური მოსაწვევები | Printed invitations | `bechduri-mosatsvevebi` | new |
| | ~~სტუმრების განთავსება~~ | Guest accommodation | `gantavseba` | removed 2026-11-10 (hotels list as venues) |
| | ქორწილის დღის კოორდინატორი | Day-of coordinator | `koordinatori` | new |

**Vendors that do two things** (a photographer who also films, a decorator who does flowers): one
main sub-type, plus "also offers" any other sub-types in the same group. They then show up under
both, and the photo/video filter's "both" option works.

**Check:** missing or unneeded sub-types; the Georgian names; whether wineries (მარანი) deserve
their own sub-type instead of being a venue type (P2).

---

## P2. Filters per group

Every group gets **location** (P4), **price** and **sort by price**, plus the page-wide search by
name or service. Group-specific filters, the first ones visible and the rest under „მეტი ფილტრი":

| Group | Filters |
|---|---|
| სივრცეები და კვება | guest capacity (up to 100 · 100–200 · 200–350 · 350+) · indoor / outdoor / both · venue type (restaurant, hall, open-air, winery, hotel) · *more:* on-site accommodation, parking |
| ფოტო და ვიდეო | photo / video / both · style (P3) · *more:* drone, album, same-day edit |
| დეკორი და ყვავილები | decor / flowers / rental · style (P3) |
| მუსიკა და გართობა | band / DJ / tamada / host / ensemble or show · *more:* music style (Georgian folk, pop, jazz…) |
| ტორტი და ტკბილეული | cake / desserts / sweet table · *more:* delivery |
| სამოსი და აქსესუარები | dress / suit / shoes / accessories / rings · buy / rent (dress rental is common) |
| სილამაზე და მომზადება | makeup / hair / nails / salon / care · comes to you (გამოძახებით) |
| სხვა მომსახურებები | transport / printed invitations / accommodation / coordinator |

**Prices need a unit** to be comparable: venues and catering price per guest, cakes per kilo,
most others per event. Proposed units: ერთ ღონისძიებაზე · ერთ სტუმარზე · საათში · კილოგრამზე ·
ერთეულზე. The card then reads e.g. „80 ₾-დან / სტუმარი".

**Check:** the filters couples actually ask about; anything to cut so the bar stays short.

---

## P3. Style list

For photo/video and decor/flowers (style tags were removed in August; the guide's photo filter
needs them back). Eight, so the filter stays readable:

კლასიკური · თანამედროვე · მინიმალისტური · რუსტიკული · ტრადიციული ქართული · რომანტიკული ·
ბოჰო · დოკუმენტური (photo/video only)

---

## P4. Cities and regions

Today the site knows 5 cities. Many venues are outside them, and photographers and decorators
travel. Proposal:

- **Location filter** = Tbilisi + regions: თბილისი · კახეთი · მცხეთა-მთიანეთი · იმერეთი ·
  აჭარა · ქვემო ქართლი · შიდა ქართლი · სამცხე-ჯავახეთი · სამეგრელო-ზემო სვანეთი · გურია ·
  რაჭა-ლეჩხუმი და ქვემო სვანეთი.
- **Venues** have one exact place (city or village, plus its region). The URL keeps the
  city/village: `/darbazi/sighnaghi/<venue>`.
- **Service vendors** have a base city plus the regions they serve. A Tbilisi photographer who
  serves Kakheti shows up when a couple filters by Kakheti. (The old "areas served" field becomes
  this list.)

**Check:** the region list; whether couples think in regions (კახეთი) or towns (სიღნაღი) when
looking for a venue.

---

## P5. Packages and terms (vendor profile)

**Package** (up to 5 per vendor): name · price + unit (P2) · what's included (a short list) ·
duration, when it applies (e.g. „8 საათი").

**Terms** (a few short fields, all optional):
- deposit: amount or %, and when it's due;
- cancellation or date change (free text);
- working outside the base city: included / extra cost / not available;
- how far ahead to book (e.g. „3–6 თვით ადრე").

Payments stay between couple and vendor (CLAUDE.md §4): terms are information only.

---

## P6. Vendor collection spreadsheet

`design-system/templates/vendor-collection.xlsx`: one row per vendor, a sheet for packages,
dropdowns for sub-type, region, price unit and style, and an instructions sheet in Georgian. You
can start filling it now; columns for anything still under review (P1–P5) can be adjusted
later without losing what's entered. Every row records **who gave permission to use the photos
and when**.

---

## P7. Day-schedule scenarios (draft, Georgian)

The guide's three scenarios. Times are a realistic starting point; couples edit everything.
Columns: time · activity · note · who's responsible.

**Please check:** whether the მაყრიონი still usually comes before the church; the usual time of
ჯვრისწერა; whether a registrar can come to the venue (საზეიმო რეგისტრაცია) and how it's booked.

### 1. ცერემონია და წვეულება ერთ სივრცეში

| დრო | აქტივობა | შენიშვნა | პასუხისმგებელი |
|---|---|---|---|
| 11:00 | პატარძლის მომზადება | მაკიაჟი და ვარცხნილობა | სტილისტი |
| 13:30 | ფოტოგრაფი და ვიდეოგრაფი იწყებენ | დეტალები, ჩაცმა | ფოტოგრაფი |
| 14:30 | წყვილის პირველი შეხვედრა და ფოტოსესია | სივრცეში ან ახლოს | ფოტოგრაფი |
| 16:30 | სტუმრების მოსვლა | მისასალმებელი სასმელი | სივრცის მენეჯერი |
| 17:00 | ცერემონია | საზეიმო რეგისტრაცია ან სიმბოლური ცერემონია | წამყვანი |
| 17:30 | მილოცვები და ჯგუფური ფოტოები | ოჯახები, მეგობრები | ფოტოგრაფი |
| 18:30 | სუფრა | თამადის პირველი სადღეგრძელოები | თამადა |
| 19:30 | პირველი ცეკვა | | ბენდი / DJ |
| 20:00 | ცეკვები და ანსამბლის გამოსვლა | | ანსამბლი |
| 21:30 | ტორტი | | საკონდიტრო |
| 22:00 | ცეკვები გრძელდება | | DJ |
| 00:00 | დასასრული | სტუმრების ტრანსპორტი | კოორდინატორი |

### 2. ჯვრისწერა ეკლესიაში, ქორწილი რესტორანში

| დრო | აქტივობა | შენიშვნა | პასუხისმგებელი |
|---|---|---|---|
| 10:00 | პატარძლის მომზადება | მაკიაჟი, ვარცხნილობა, ჩაცმა | სტილისტი |
| 12:30 | მაყრიონი პატარძლის სახლში | სიძე და მაყრიონი პატარძალს მშობლების სახლიდან გამოიყვანენ | სიძე, მეჯვარე |
| 13:30 | ფოტოსესია | ქალაქში ან ბუნებაში | ფოტოგრაფი |
| 15:30 | ჯვრისწერა | ეკლესიასთან და მღვდელთან წინასწარ შეთანხმებული დრო | მეჯვარეები |
| 16:30 | კორტეჟი რესტორნისკენ | | ტრანსპორტი |
| 18:00 | სტუმრების მიღება | | რესტორნის მენეჯერი |
| 18:30 | წყვილის შემოსვლა და სუფრა | თამადის სადღეგრძელოები | თამადა |
| 19:30 | პირველი ცეკვა | | ბენდი |
| 20:30 | ანსამბლის გამოსვლა | | ანსამბლი |
| 22:00 | ტორტი | | საკონდიტრო |
| 23:30 | დასასრული | | |

Civil registration (იუსტიციის სახლი) is often on a different day; the template can offer it as an
optional first row.

### 3. მხოლოდ მიღება და წვეულება

| დრო | აქტივობა | შენიშვნა | პასუხისმგებელი |
|---|---|---|---|
| 17:00 | წყვილის ფოტოსესია | | ფოტოგრაფი |
| 18:30 | სტუმრების მოსვლა | ფურშეტი | სივრცის მენეჯერი |
| 19:00 | წყვილის შემოსვლა | | წამყვანი |
| 19:15 | სუფრა | თამადა ან წამყვანი | თამადა |
| 20:00 | პირველი ცეკვა | | DJ |
| 20:15 | ცეკვები | | DJ |
| 22:00 | ტორტი | | საკონდიტრო |
| 23:30 | დასასრული | | |

---

## P8. Starter task list (draft, Georgian)

Replaces today's 10 tasks. Due dates count back from the wedding date; without a date, tasks
show by stage only. Plural („დაჯავშნეთ") as today, since the couple plans together. „→" is
where the task opens.

| ეტაპი | დავალება | → |
|---|---|---|
| 12+ თვით ადრე | განსაზღვრეთ საერთო ბიუჯეტი | ბიუჯეტი |
| | შეადგინეთ სტუმრების სავარაუდო სია | სტუმრები |
| | აირჩიეთ თარიღი ან თარიღების ვარიანტები | პარამეტრები |
| | შეარჩიეთ და დაჯავშნეთ სივრცე | კატალოგი: სივრცეები |
| | თუ ჯვრისწერა გექნებათ, შეუთანხმდით ეკლესიასა და მღვდელს | |
| 10–12 თვე | შეარჩიეთ ფოტოგრაფი | კატალოგი: ფოტოგრაფი |
| | შეარჩიეთ ვიდეოგრაფი | კატალოგი: ვიდეოგრაფი |
| | შეარჩიეთ თამადა ან წამყვანი | კატალოგი: თამადა |
| | შეარჩიეთ ბენდი ან DJ | კატალოგი: ბენდი და DJ |
| 8–10 თვე | შეარჩიეთ დეკორატორი | კატალოგი: დეკორატორი |
| | შეარჩიეთ ან შეუკვეთეთ კაბა | კატალოგი: კაბა |
| | დაგეგმეთ გასართობი პროგრამა | კატალოგი: გასართობი პროგრამა |
| | თუ ქორწილი სხვა ქალაქშია, მოძებნეთ სტუმრების განთავსება | კატალოგი: განთავსება |
| 6–8 თვე | შეარჩიეთ ფლორისტი | კატალოგი: ფლორისტი |
| | შეარჩიეთ კოსტიუმი | კატალოგი: კოსტიუმი |
| | შეარჩიეთ ბეჭდები | კატალოგი: ბეჭდები |
| | შეარჩიეთ მაკიაჟისა და თმის სტილისტი | კატალოგი: მაკიაჟი |
| | დაგეგმეთ ტრანსპორტი და კორტეჟი | კატალოგი: ტრანსპორტი |
| 4–6 თვე | შექმენით მოსაწვევი | მოსაწვევი |
| | შეარჩიეთ ტორტი და ტკბილეული | კატალოგი: ტორტი |
| | გაიარეთ მენიუს დეგუსტაცია სივრცეში | |
| | დაასრულეთ სტუმრების სია | სტუმრები |
| 2–3 თვე | გააგზავნეთ მოსაწვევები | მოსაწვევი |
| | დაჯავშნეთ ქორწინების რეგისტრაცია | |
| | შეადგინეთ ქორწილის დღის განრიგი | ქორწილის დღე |
| | გაიარეთ მაკიაჟისა და ვარცხნილობის საცდელი ვარიანტი | |
| 1 თვე | შეაგროვეთ სტუმრების პასუხები | სტუმრები |
| | შეადგინეთ დასხდომის გეგმა | დასხდომის გეგმა |
| | დაგეგმეთ დარჩენილი გადახდები | ბიუჯეტი |
| | დაუდასტურეთ დეტალები ყველა მომწოდებელს | ჩემი მომსახურებები |
| 1 კვირა | შეატყობინეთ სივრცეს სტუმრების საბოლოო რაოდენობა | |
| | გაუზიარეთ დღის განრიგი მომწოდებლებს | ქორწილის დღე |
| ქორწილის შემდეგ | შეაფასეთ მომწოდებლები | ჩემი მომსახურებები |
| | მადლობა გადაუხადეთ სტუმრებს | |

**Check:** the order and timing (e.g. dresses are often sewn, so 8–10 months may be late);
anything typical that's missing.

---

## P9. FAQ answers (home section 6)

The home page already has 5 questions (account, no date yet, contacting a vendor, partner, own
vendor). The guide also wants **the invitation** and **prices**. Two existing answers promise
things not built yet: packages (a3, comes with A2) and partner access (a4, depends on D8). Keep
or reword them until those exist.

New, draft:

- **„როგორ შევქმნა მოსაწვევი?"** — „ჩემს ქორწილში აირჩიე დიზაინი, შეავსე დეტალები და
  გამოაქვეყნე. სტუმრები მოსაწვევს ბმულით ან QR კოდით ხსნიან და იქვე ადასტურებენ დასწრებას —
  პასუხები შენს სტუმრების სიაში ჩნდება."
- **„რა ღირს?"** — „მომწოდებლების დათვალიერება და დაგეგმვის ხელსაწყოები უფასოა. ფასს
  მომწოდებელთან პირდაპირ თანხმდები." *Publish only after the pricing decision (guide §9); until
  then this question stays off the page.*

---

## P10. RSVP food options

Guests tick any that apply: ვეგეტარიანული · ვეგანური · მარხვის მენიუ · ბავშვის მენიუ ·
ალერგია (მიუთითე) · სხვა (მიუთითე).

---

## P11. URL names for new public pages

Today's app pages use English paths (`/vendors`, `/guides`, `/planning`); vendor pages use
transliterated Georgian. Proposal: keep that split. Section pages in English, individual items
by their transliterated title, so each article has its own readable URL.

| Page | URL |
|---|---|
| Tips & ideas hub | `/guides` (stays) |
| Blog list / article | `/guides/blog` · `/guides/blog/<slug>` |
| Inspiration list / idea | `/guides/inspiration` · `/guides/inspiration/<slug>` |
| Real weddings list / story | `/guides/real-weddings` · `/guides/real-weddings/<slug>` |
| Day schedules | `/schedules` |
| Invitations (public intro) | `/invitations` |
| Terms / privacy | `/terms` · `/privacy` (already linked from the footer) |

Today's `/guides/<slug>` article URLs would redirect to `/guides/blog/<slug>`.

The admin content editor already uses these addresses (`ContentRules.PublicPath` in the API). If
you change them, that one function changes too.
