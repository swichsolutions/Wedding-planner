// Mock content — PLACEHOLDER until a ContentPage API/CMS exists. Real Georgian copy so
// pages carry genuine SEO substance (CLAUDE.md SEO rules). Replace with real articles.
import { img } from './catalog';
import { ContentArticle } from './content.models';

export const MOCK_ARTICLES: ContentArticle[] = [
  {
    slug: 'rogor-avirchiot-fotografi',
    type: 'guide',
    titleKa: 'როგორ ავირჩიოთ საქორწინო ფოტოგრაფი',
    titleEn: 'How to choose your wedding photographer',
    excerptKa: 'ფოტოები რჩება მაშინაც, როცა დღე დასრულდება. აი, რას უნდა მიაქციოთ ყურადღება არჩევისას.',
    excerptEn: 'The photos remain long after the day ends. Here is what to look for.',
    bodyKa: [
      'საქორწინო ფოტოგრაფი ერთ-ერთი ყველაზე მნიშვნელოვანი არჩევანია — სწორედ მისი ნამუშევარი დაგრჩებათ მთელი ცხოვრების განმავლობაში. ამიტომ ღირს დროის დათმობა და რამდენიმე ფაქტორის გათვალისწინება.',
      'პირველ რიგში, დაათვალიერეთ სრული ალბომები და არა მხოლოდ რჩეული კადრები. რეალური ქორწილის სრული გადაღება გაჩვენებთ, როგორ მუშაობს ფოტოგრაფი მთელი დღის განმავლობაში, სხვადასხვა განათებასა და მომენტში.',
      'მეორე — დარწმუნდით, რომ მისი სტილი თქვენს გემოვნებას ემთხვევა. დოკუმენტური, ნატურალური თუ უფრო პოზირებული — სტილი წინასწარ უნდა შეთანხმდეს. და ბოლოს, შეხვდით პირადად ან ვიდეო-ზარით: კომფორტი ფოტოგრაფთან პირდაპირ აისახება კადრებზე.',
    ],
    bodyEn: [
      'Your wedding photographer is one of the most important choices you will make — their work is what stays with you for life. It is worth taking the time and weighing a few factors.',
      'First, view full albums, not just highlight reels. A complete real-wedding gallery shows how a photographer works across the whole day, in different light and moments.',
      'Second, make sure their style matches your taste — documentary, natural, or more posed should be agreed in advance. Finally, meet in person or on a video call: feeling comfortable with your photographer shows directly in the photos.',
    ],
    metaKa: 'პრაქტიკული გზამკვლევი საქორწინო ფოტოგრაფის ასარჩევად საქართველოში.',
    metaEn: 'A practical guide to choosing a wedding photographer in Georgia.',
    image: img('photo-1537633552985-df8429e8048b', 1400),
    imageAlt: 'საქორწინო ფოტოგრაფი მუშაობის პროცესში',
    date: '2026-02-10',
  },
  {
    slug: '12-tviani-sakorwino-gegma',
    type: 'checklist',
    titleKa: '12-თვიანი საქორწინო გეგმა',
    titleEn: 'The 12-month wedding plan',
    excerptKa: 'ნაბიჯ-ნაბიჯ ჩეკლისტი, რომელიც სტრესს ამცირებს და არაფერს გამოგრჩებათ.',
    excerptEn: 'A step-by-step checklist that lowers stress and keeps you on track.',
    bodyKa: [
      'კარგი დაგეგმვა ქორწილის წარმატების ნახევარია. 12 თვით ადრე დაწყება საშუალებას გაძლევთ, ყველაზე მოთხოვნადი მომწოდებლები დაიჯავშნოთ და ბიუჯეტი მშვიდად გაანაწილოთ.',
      '9–12 თვემდე: განსაზღვრეთ ბიუჯეტი და სტუმრების სავარაუდო რაოდენობა, დაჯავშნეთ დარბაზი და ფოტოგრაფი. 6–9 თვე: ჩაცმულობა, დეკორი, მუსიკა. 3–6 თვე: მენიუ, ტორტი, მოწვევები.',
      'ბოლო თვეებში დარჩება მხოლოდ დეტალები — სქემა, განრიგი და მცირე შესწორებები. სწორად განაწილებული დრო ნიშნავს, რომ ბოლო კვირას დასვენებას მოასწრებთ.',
    ],
    bodyEn: [
      'Good planning is half the success of a wedding. Starting 12 months ahead lets you book the most in-demand vendors and pace your budget calmly.',
      '9–12 months out: set your budget and rough guest count, book the venue and photographer. 6–9 months: attire, decor, music. 3–6 months: menu, cake, invitations.',
      'The final months leave only details — the seating, the schedule, and small adjustments. Time spread well means you actually get to rest the last week.',
    ],
    metaKa: '12-თვიანი ჩეკლისტი ქართული ქორწილის დასაგეგმად, ნაბიჯ-ნაბიჯ.',
    metaEn: 'A 12-month checklist for planning a Georgian wedding, step by step.',
    image: img('photo-1469371670807-013ccf25f16a', 1400),
    imageAlt: 'საქორწინო დაგეგმვის ჩანაწერები',
    date: '2026-01-22',
  },
  {
    slug: 'nino-da-giorgi-kakheti',
    type: 'realWedding',
    titleKa: 'ნინო და გიორგი — ქორწილი კახეთში',
    titleEn: 'Nino & Giorgi — a Kakheti wedding',
    excerptKa: 'ვენახებში გადაშლილი ცერემონია, ოჯახური სუფრა და ღამის ცეკვები ვარსკვლავების ქვეშ.',
    excerptEn: 'A ceremony among the vines, a family feast, and dancing under the stars.',
    bodyKa: [
      'ნინომ და გიორგიმ ქორწილი მშობლიურ კახეთში გადაწყვიტეს — იქ, სადაც ოჯახის ვენახებია. ცერემონია მზის ჩასვლისას ჩატარდა, ვაზის რიგებს შორის.',
      'სუფრა კლასიკური ქართული იყო: ადგილობრივი ღვინო, საოჯახო რეცეპტები და თამადა, რომელმაც სტუმრები გათენებამდე ააცეკვა. დეკორი მინიმალისტური დარჩა — ბუნებამ თავად შეასრულა მთავარი როლი.',
      'წყვილის რჩევა მომავალ დაქორწინებულებს: „აირჩიეთ ადგილი, რომელსაც მნიშვნელობა აქვს თქვენთვის. დანარჩენი თავისით ლაგდება.“',
    ],
    bodyEn: [
      'Nino and Giorgi chose to marry in their native Kakheti — where the family vineyards are. The ceremony took place at sunset, between the rows of vines.',
      'The feast was classically Georgian: local wine, family recipes, and a tamada who kept guests dancing until dawn. The decor stayed minimal — nature played the leading role.',
      'The couple’s advice to those marrying next: “Choose a place that means something to you. The rest falls into place on its own.”',
    ],
    metaKa: 'რეალური ქართული ქორწილი კახეთში — ნინოსა და გიორგის ისტორია.',
    metaEn: 'A real Georgian wedding in Kakheti — Nino and Giorgi’s story.',
    image: img('photo-1606800052052-a08af7148866', 1400),
    imageAlt: 'საქორწინო ცერემონია ვენახებში',
    date: '2026-03-05',
  },
  {
    slug: 'biujetis-dagegmva-saidan',
    type: 'guide',
    titleKa: 'ბიუჯეტის დაგეგმვა: საიდან დავიწყოთ',
    titleEn: 'Budget planning: where to start',
    excerptKa: 'როგორ გავანაწილოთ თანხა ისე, რომ მთავარზე არ დავიშუროთ.',
    excerptEn: 'How to split your money so the things that matter get their share.',
    bodyKa: [
      'ბიუჯეტის დაგეგმვა ყველაზე რთული ნაბიჯად გვეჩვენება, თუმცა სინამდვილეში სწორედ აქედან უნდა დაიწყოს ყველაფერი. ჯერ განსაზღვრეთ საერთო თანხა, შემდეგ გაანაწილეთ კატეგორიებად.',
      'ქართულ ქორწილში დარბაზი და კეთერინგი ბიუჯეტის ყველაზე დიდ ნაწილს იკავებს — ხშირად 40%-მდე. დანარჩენი ნაწილდება ფოტო-ვიდეოზე, მუსიკაზე, დეკორსა და ჩაცმულობაზე.',
      'გამოიყენეთ ჩვენი ბიუჯეტის დამგეგმავი, რომ ნახოთ რეკომენდებული გადანაწილება და მოარგოთ საკუთარ პრიორიტეტებს.',
    ],
    bodyEn: [
      'Budget planning feels like the hardest step, but it is exactly where everything should begin. First set the total, then split it into categories.',
      'In a Georgian wedding the venue and catering take the largest share — often up to 40%. The rest is spread across photo/video, music, decor, and attire.',
      'Use our budget planner to see a recommended split and adapt it to your own priorities.',
    ],
    metaKa: 'როგორ დავგეგმოთ საქორწინო ბიუჯეტი საქართველოში — პრაქტიკული რჩევები.',
    metaEn: 'How to plan a wedding budget in Georgia — practical advice.',
    image: img('photo-1511285560929-80b456fea0bc', 1400),
    imageAlt: 'საქორწინო ბიუჯეტის დაგეგმვა',
    date: '2026-02-28',
  },
];
