// Mock vendor dataset — PLACEHOLDER until the .NET vendor API is wired. Bios are real
// Georgian copy so profile pages carry genuine SEO substance (CLAUDE.md SEO rules).
// Photography uses stable Unsplash URLs; replace with real vendor portfolios later.
import { img } from './catalog';
import { Vendor } from './vendor.models';

export const MOCK_VENDORS: Vendor[] = [
  {
    id: 1, name: 'სტუდია ნათელი', slug: 'studia-nateli',
    categorySlug: 'fotografi', categoryKey: 'category.photographer',
    city: 'თბილისი', citySlug: 'tbilisi', areasServed: 'თბილისი, მცხეთა, კახეთი',
    priceFrom: 1500, priceRange: '1500–4000 ₾',
    bio: 'დოკუმენტური სტილის საქორწინო ფოტოგრაფია, რომელიც ბუნებრივ ემოციას იჭერს. ვმუშაობთ წყვილებთან მთელი დღის განმავლობაში — მზადებიდან ცეკვებამდე. გვაქვს 8 წლის გამოცდილება და 200-ზე მეტი გადაღებული ქორწილი.',
    instagram: 'studia_nateli', phone: '+995 599 12 34 56',
    isFeatured: true,
    photos: [
      { url: img('photo-1583939003579-730e3918a45a', 1200), alt: 'წყვილი საქორწინო ცერემონიაზე', isRealWedding: true },
      { url: img('photo-1519741497674-611481863552', 1200), alt: 'საქორწინო ბეჭდები და დეტალები' },
      { url: img('photo-1465495976277-4387d4b0b4c6', 1200), alt: 'საქორწინო ცერემონია ღია ცის ქვეშ', isRealWedding: true },
      { url: img('photo-1511285560929-80b456fea0bc', 1200), alt: 'საქორწინო მიღება' },
    ],
  },
  {
    id: 2, name: 'თეთრი დარბაზი', slug: 'tetri-darbazi',
    categorySlug: 'darbazi', categoryKey: 'category.venue',
    city: 'თბილისი', citySlug: 'tbilisi', areasServed: 'თბილისი',
    priceFrom: 8000, priceRange: '8000–20000 ₾',
    bio: 'ელეგანტური საქორწინო დარბაზი თბილისის ცენტრში, 300 სტუმრამდე. მაღალი ჭერი, ბუნებრივი განათება და დიდი ტერასა ცერემონიისთვის. სრული კეთერინგი და ტექნიკური უზრუნველყოფა.',
    instagram: 'tetri_darbazi', phone: '+995 599 22 33 44',
    isFeatured: true,
    photos: [
      { url: img('photo-1464366400600-7168b8af9bc3', 1200), alt: 'საქორწინო დარბაზის ინტერიერი', isRealWedding: true },
      { url: img('photo-1519167758481-83f550bb49b3', 1200), alt: 'გაწყობილი სუფრა დარბაზში' },
      { url: img('photo-1470229722913-7c0e2dbbafd3', 1200), alt: 'საქორწინო მიღების სივრცე' },
    ],
  },
  {
    id: 3, name: 'ლილე მაკიაჟი', slug: 'lile-makiaji',
    categorySlug: 'makiaji', categoryKey: 'category.makeup',
    city: 'ბათუმი', citySlug: 'batumi', areasServed: 'ბათუმი, ქობულეთი',
    priceFrom: 400, priceRange: '400–900 ₾',
    bio: 'საქორწინო მაკიაჟი და ვარცხნილობა, რომელიც მთელი დღე ძლებს. ვმუშაობ ბუნებრივ, ნატურალურ სტილში და ვითვალისწინებ თითოეული პატარძლის ინდივიდუალურ ნაკვთებს. შესაძლებელია გასვლითი მომსახურება.',
    instagram: 'lile_makeup', phone: '+995 577 55 66 77',
    isFeatured: true,
    photos: [
      { url: img('photo-1457972729786-0411a3b2b626', 1200), alt: 'პატარძლის მაკიაჟი', isRealWedding: true },
      { url: img('photo-1522335789203-aabd1fc54bc9', 1200), alt: 'საქორწინო ვარცხნილობა' },
      { url: img('photo-1487412947147-5cebf100ffc2', 1200), alt: 'მაკიაჟის პროცესი' },
    ],
  },
  {
    id: 4, name: 'ფლორა დეკორი', slug: 'flora-dekori',
    categorySlug: 'floristi', categoryKey: 'category.florist',
    city: 'ქუთაისი', citySlug: 'kutaisi', areasServed: 'ქუთაისი, იმერეთი',
    priceFrom: 1200, priceRange: '1200–5000 ₾',
    bio: 'ცოცხალი ყვავილების საქორწინო დეკორი — თაიგულებიდან არქებამდე. ვქმნით სეზონურ კომპოზიციებს და ვმუშაობთ ადგილობრივ მებაღეებთან. თითოეული ქორწილი უნიკალურია.',
    instagram: 'flora_dekori', phone: '+995 591 88 99 00',
    isFeatured: true,
    photos: [
      { url: img('photo-1522673607200-164d1b6ce486', 1200), alt: 'საქორწინო ყვავილების დეკორი', isRealWedding: true },
      { url: img('photo-1507504031003-b417219a0fde', 1200), alt: 'საქორწინო თაიგული' },
      { url: img('photo-1519225421980-715cb0215aed', 1200), alt: 'ყვავილებით გაფორმებული მაგიდა' },
    ],
  },
  {
    id: 5, name: 'გიო ბერიძე ფოტო', slug: 'gio-beridze-foto',
    categorySlug: 'fotografi', categoryKey: 'category.photographer',
    city: 'ბათუმი', citySlug: 'batumi', areasServed: 'ბათუმი, აჭარა',
    priceFrom: 1300, priceRange: '1300–3500 ₾',
    bio: 'მხატვრული საქორწინო ფოტოგრაფია ზღვისპირა ფონზე. მიყვარს ბუნებრივ განათებაში გადაღება და გულწრფელი მომენტების დაჭერა. ვაწვდი სრულ ციფრულ გალერეას და ნაბეჭდ ალბომს.',
    instagram: 'gio_beridze_photo', phone: '+995 593 11 22 33',
    photos: [
      { url: img('photo-1606800052052-a08af7148866', 1200), alt: 'წყვილი ზღვის ფონზე', isRealWedding: true },
      { url: img('photo-1537633552985-df8429e8048b', 1200), alt: 'საქორწინო პორტრეტი' },
      { url: img('photo-1465495976277-4387d4b0b4c6', 1200), alt: 'საქორწინო დეტალები' },
    ],
  },
  {
    id: 6, name: 'ათელიე დეკორი', slug: 'atelie-dekori',
    categorySlug: 'dekori', categoryKey: 'category.decor',
    city: 'თბილისი', citySlug: 'tbilisi', areasServed: 'თბილისი, მცხეთა',
    priceFrom: 2500, priceRange: '2500–9000 ₾',
    bio: 'საქორწინო სივრცის სრული გაფორმება — კონცეფციიდან რეალიზაციამდე. განათება, ტექსტილი, ავეჯი და ფლორისტიკა ერთ ხელწერაში. ვქმნით ატმოსფეროს, რომელიც თქვენს ისტორიას ჰყვება.',
    instagram: 'atelie_dekori', phone: '+995 599 44 55 66',
    photos: [
      { url: img('photo-1478146896981-b80fe463b330', 1200), alt: 'საქორწინო დეკორი და განათება', isRealWedding: true },
      { url: img('photo-1530103862676-de8c9debad1d', 1200), alt: 'გაფორმებული ცერემონიის სივრცე' },
      { url: img('photo-1464366400600-7168b8af9bc3', 1200), alt: 'საქორწინო მაგიდის გაფორმება' },
    ],
  },
  {
    id: 7, name: 'კადრი ფილმსი', slug: 'kadri-films',
    categorySlug: 'videografi', categoryKey: 'category.videographer',
    city: 'თბილისი', citySlug: 'tbilisi', areasServed: 'მთელი საქართველო',
    priceFrom: 2000, priceRange: '2000–6000 ₾',
    bio: 'საქორწინო ვიდეოგრაფია კინემატოგრაფიულ სტილში. ვიღებთ მოკლე ფილმსაც და სრულ ვერსიასაც, საჰაერო კადრებით. თქვენი დღე ისე, როგორც ფილმში.',
    instagram: 'kadri_films', phone: '+995 595 77 88 99',
    photos: [
      { url: img('photo-1492691527719-9d1e07e534b4', 1200), alt: 'ვიდეოგრაფი მუშაობის პროცესში', isRealWedding: true },
      { url: img('photo-1606216794074-735e91aa2c92', 1200), alt: 'საქორწინო გადაღების კადრი' },
    ],
  },
  {
    id: 8, name: 'ტკბილი სახლი', slug: 'tkbili-sakhli',
    categorySlug: 'torti', categoryKey: 'category.cake',
    city: 'თბილისი', citySlug: 'tbilisi', areasServed: 'თბილისი',
    priceFrom: 300, priceRange: '300–1500 ₾',
    bio: 'ხელნაკეთი საქორწინო ტორტები ნატურალური ინგრედიენტებით. ვამზადებთ მრავალსართულიან ტორტებსა და დესერტების მაგიდას თქვენი გემოვნებით. შესაძლებელია დეგუსტაცია.',
    instagram: 'tkbili_sakhli', phone: '+995 568 12 12 12',
    photos: [
      { url: img('photo-1535254973040-607b474cb50d', 1200), alt: 'მრავალსართულიანი საქორწინო ტორტი', isRealWedding: true },
      { url: img('photo-1464349095431-e9a21285b5f3', 1200), alt: 'საქორწინო დესერტები' },
    ],
  },
  {
    id: 9, name: 'ბენდი ჰარმონია', slug: 'bandi-harmonia',
    categorySlug: 'musika', categoryKey: 'category.music',
    city: 'თბილისი', citySlug: 'tbilisi', areasServed: 'მთელი საქართველო',
    priceFrom: 1800, priceRange: '1800–5000 ₾',
    bio: 'ცოცხალი მუსიკა და DJ თქვენი ქორწილისთვის — ქართული პოლიფონიიდან თანამედროვე ჰიტებამდე. ვირჩევთ რეპერტუარს თქვენთან ერთად და ვუზრუნველყოფთ ხმის სრულ აპარატურას.',
    instagram: 'bandi_harmonia', phone: '+995 577 34 34 34',
    photos: [
      { url: img('photo-1511671782779-c97d3d27a1d4', 1200), alt: 'ცოცხალი მუსიკალური შესრულება', isRealWedding: true },
      { url: img('photo-1470229722913-7c0e2dbbafd3', 1200), alt: 'საქორწინო წვეულება' },
    ],
  },
  {
    id: 10, name: 'თეთრი ვარდი', slug: 'tetri-vardi',
    categorySlug: 'floristi', categoryKey: 'category.florist',
    city: 'თბილისი', citySlug: 'tbilisi', areasServed: 'თბილისი',
    priceFrom: 900, priceRange: '900–3500 ₾',
    bio: 'მინიმალისტური ფლორისტიკა მონოქრომულ ტონებში. ვქმნით ნატიფ თაიგულებსა და დეკორს თეთრი და მწვანე პალიტრით. იდეალურია თანამედროვე ქორწილებისთვის.',
    instagram: 'tetri_vardi', phone: '+995 599 90 90 90',
    photos: [
      { url: img('photo-1519225421980-715cb0215aed', 1200), alt: 'მინიმალისტური საქორწინო თაიგული', isRealWedding: true },
      { url: img('photo-1507504031003-b417219a0fde', 1200), alt: 'თეთრი ყვავილების კომპოზიცია' },
    ],
  },
];
