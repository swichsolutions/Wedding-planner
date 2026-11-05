using WeddingPlanner.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace WeddingPlanner.Infrastructure.Data;

/// <summary>
/// Default text for /terms and /privacy, created once on startup when the page does not exist
/// yet (every environment). Never overwrites: the admin content editor owns the pages after
/// that, so edits made there survive deploys. Short on purpose (Beka, 2026-11-05): a plain
/// statement of what the service is, who runs it, and what happens with the data.
/// </summary>
public static class LegalPagesSeeder
{
    private const string Operator = "Swich Solutions";
    private const string Contact = "info@weddingplanner.ge";

    public static async Task SeedAsync(AppDbContext db)
    {
        var now = DateTimeOffset.UtcNow;
        var pages = new[]
        {
            ("terms", "წესები და პირობები", "Terms of Service", TermsKa, TermsEn,
                "WeddingPlanner-ის გამოყენების წესები: სერვისი, ანგარიშები, მომწოდებლები, პასუხისმგებლობა.",
                "How WeddingPlanner works: the service, accounts, vendors, liability."),
            ("privacy", "კონფიდენციალურობის პოლიტიკა", "Privacy Policy", PrivacyKa, PrivacyEn,
                "რა მონაცემებს ვაგროვებთ, რისთვის ვიყენებთ და როგორ წაშლი.",
                "What data we collect, what for, and how to delete it."),
        };

        foreach (var (slug, titleKa, titleEn, bodyKa, bodyEn, excerptKa, excerptEn) in pages)
        {
            if (await db.ContentPages.AnyAsync(c => c.Type == ContentPageType.Legal && c.Slug == slug))
                continue;

            db.ContentPages.Add(new ContentPage
            {
                Type = ContentPageType.Legal,
                Slug = slug,
                TitleKa = titleKa,
                TitleEn = titleEn,
                ExcerptKa = excerptKa,
                ExcerptEn = excerptEn,
                MetaDescriptionKa = excerptKa,
                MetaDescriptionEn = excerptEn,
                BodyKa = bodyKa.Trim(),
                BodyEn = bodyEn.Trim(),
                IsPublished = true,
                PublishedAt = now,
                CreatedAt = now,
                UpdatedAt = now,
            });
        }

        await db.SaveChangesAsync();
    }

    private static readonly string TermsKa = $"""
## 1. ვინ ვართ

WeddingPlanner (weddingplanner.ge) არის ქორწილის დაგეგმვის ონლაინ პლატფორმა. მას ამუშავებს {Operator}, საქართველო. კონტაქტი: {Contact}.

## 2. რას გთავაზობთ

- საქორწილო სივრცეებისა და მომსახურებების კატალოგი;
- დაგეგმვის ინსტრუმენტები წყვილებისთვის: სტუმრების სია, ბიუჯეტი, დავალებები, დღის განრიგი, მოსაწვევები, საქორწილო გვერდი;
- პროფილები და შეტყობინებები მომწოდებლებისთვის.

სერვისი ამ ეტაპზე უფასოა. თუ ფასიანი ფუნქციები დაემატება, წინასწარ გაცნობებთ.

## 3. ანგარიში

რეგისტრაციისას მიუთითე სწორი მონაცემები და დაიცავი შენი პაროლი. ანგარიშიდან შესრულებულ ქმედებებზე პასუხისმგებელი ხარ შენ. ანგარიშის წაშლა ნებისმიერ დროს შეგიძლია — მოგვწერე {Contact}.

## 4. მომწოდებლები

მომწოდებელი პასუხისმგებელია თავისი პროფილის სისწორეზე (ფასები, ფოტოები, აღწერა) და ადასტურებს, რომ ატვირთული ფოტოების გამოყენების უფლება აქვს. პროფილებს გამოქვეყნებამდე ვამოწმებთ, მაგრამ გარიგების მხარე არ ვართ: შეთანხმება იდება წყვილსა და მომწოდებელს შორის. პროფილზე მითითებული ფასები და პირობები საორიენტაციოა, სანამ მომწოდებელთან პირდაპირ არ შეათანხმებ.

## 5. რა არ შეიძლება

ყალბი ინფორმაციის განთავსება, სპამი, სხვისი ფოტოების ან მონაცემების გამოყენება ნებართვის გარეშე, სერვისის ბოროტად გამოყენება. დარღვევისას ანგარიში შეიძლება შეიზღუდოს ან წაიშალოს.

## 6. შინაარსი და უფლებები

პლატფორმის დიზაინი და კოდი {Operator}-ს ეკუთვნის. შენ მიერ ატვირთული შინაარსი (ფოტოები, ტექსტი) შენ გეკუთვნის; ატვირთვით გვაძლევ უფლებას, ის პლატფორმაზე ვაჩვენოთ.

## 7. პასუხისმგებლობა

სერვისი მოწოდებულია „როგორც არის“. ვცდილობთ, იმუშაოს უწყვეტად და ზუსტად, მაგრამ ამის გარანტიას ვერ მოგცემთ. არ ვაგებთ პასუხს მომწოდებლის მიერ გაწეულ მომსახურებაზე, გაუქმებულ დაჯავშნაზე ან არაპირდაპირ ზარალზე.

## 8. ცვლილებები და სამართალი

წესები შეიძლება შეიცვალოს; მნიშვნელოვან ცვლილებას ამ გვერდზე გამოვაქვეყნებთ. მოქმედებს საქართველოს კანონმდებლობა. კითხვები: {Contact}.
""";

    private static readonly string TermsEn = $"""
## 1. Who we are

WeddingPlanner (weddingplanner.ge) is an online wedding-planning platform operated by {Operator}, Georgia. Contact: {Contact}.

## 2. What we offer

- A catalog of wedding venues and services;
- Planning tools for couples: guest list, budget, tasks, day schedule, invitations, a wedding website;
- Profiles and messaging for vendors.

The service is free at this stage. If paid features are added, we will tell you in advance.

## 3. Your account

Give accurate details when you register and keep your password safe. You are responsible for what is done from your account. You can delete your account at any time by writing to {Contact}.

## 4. Vendors

Vendors are responsible for the accuracy of their profile (prices, photos, description) and confirm they have the right to use the photos they upload. We review profiles before publishing them, but we are not a party to any deal: the agreement is between the couple and the vendor. Prices and terms on a profile are indicative until you confirm them with the vendor directly.

## 5. What is not allowed

False information, spam, using other people's photos or data without permission, abusing the service. Accounts that break these rules may be restricted or deleted.

## 6. Content and rights

The platform's design and code belong to {Operator}. Content you upload (photos, text) stays yours; by uploading it you allow us to show it on the platform.

## 7. Liability

The service is provided "as is". We work to keep it running and accurate but cannot guarantee it. We are not liable for services performed by vendors, cancelled bookings, or indirect losses.

## 8. Changes and law

These terms may change; significant changes will be published on this page. Georgian law applies. Questions: {Contact}.
""";

    private static readonly string PrivacyKa = $"""
## 1. ვინ ამუშავებს მონაცემებს

{Operator} (WeddingPlanner, weddingplanner.ge). კონტაქტი: {Contact}.

## 2. რა მონაცემებს ვაგროვებთ

- **ანგარიში:** სახელი, ელფოსტა, პაროლი (დაშიფრული სახით). Google-ით შესვლისას — Google-ის მიერ გადმოცემული სახელი და ელფოსტა.
- **დაგეგმვის მონაცემები,** რომლებსაც თავად შეიყვან: ქორწილის თარიღი, სტუმრების სია, ბიუჯეტი, დავალებები, ფოტოები.
- **მომწოდებლის პროფილი:** საკონტაქტო მონაცემები, ფოტოები, ფასები. ეს ინფორმაცია საჯაროა — სწორედ ამისთვის ქმნი პროფილს.
- **შეტყობინებები** წყვილსა და მომწოდებელს შორის.
- **ტექნიკური მონაცემები:** IP მისამართი და ბრაუზერის ტიპი — უსაფრთხოებისა და შეცდომების აღმოსაჩენად.

## 3. რისთვის ვიყენებთ

სერვისის მუშაობისთვის (ანგარიში, დაგეგმვის ინსტრუმენტები, შეტყობინებების მიწოდება), უსაფრთხოებისთვის და კანონის მოთხოვნების შესასრულებლად. მონაცემებს არ ვყიდით და სარეკლამოდ არ გადავცემთ.

## 4. ვის ვუზიარებთ

- მომწოდებელს — როცა თავად უგზავნი შეტყობინებას.
- ტექნიკურ მომსახურებებს, რომლებზეც სერვისი მუშაობს: ჰოსტინგი (Cloudflare; Render — ევროკავშირი), მონაცემთა ბაზა (Neon, ფრანკფურტი), ფოტოები (Cloudinary), ელფოსტა (Resend). ისინი მონაცემებს მხოლოდ ჩვენი დავალებით ამუშავებენ.

## 5. რამდენ ხანს ვინახავთ

სანამ ანგარიში არსებობს. ანგარიშის წაშლის შემდეგ მონაცემები 30 დღეში იშლება, გარდა იმისა, რისი შენახვაც კანონით გვევალება.

## 6. შენი უფლებები

„პერსონალურ მონაცემთა დაცვის შესახებ“ საქართველოს კანონის თანახმად შეგიძლია მოითხოვო შენი მონაცემების ნახვა, შესწორება ან წაშლა და გაიხმო მიცემული თანხმობა. მოგვწერე {Contact} — ვუპასუხებთ 10 სამუშაო დღეში. საჩივრით შეგიძლია მიმართო პერსონალურ მონაცემთა დაცვის ზედამხედველ ორგანოს.

## 7. ქუქიები

ვიყენებთ მხოლოდ სერვისისთვის აუცილებელ ქუქიებს და ბრაუზერის მეხსიერებას (შესვლის სესია, არჩეული ენა). სარეკლამო ტრეკინგი არ გვაქვს.

## 8. ასაკი

სერვისი 18 წლამდე პირებისთვის განკუთვნილი არ არის.

## 9. ცვლილებები

ამ პოლიტიკის ცვლილებებს აქვე გამოვაქვეყნებთ.
""";

    private static readonly string PrivacyEn = $"""
## 1. Who processes your data

{Operator} (WeddingPlanner, weddingplanner.ge). Contact: {Contact}.

## 2. What we collect

- **Account:** name, email, password (stored encrypted). With Google sign-in, the name and email Google passes to us.
- **Planning data** you enter yourself: wedding date, guest list, budget, tasks, photos.
- **Vendor profile:** contact details, photos, prices. This is public; that is what the profile is for.
- **Messages** between couples and vendors.
- **Technical data:** IP address and browser type, for security and error diagnosis.

## 3. What we use it for

To run the service (accounts, planning tools, delivering messages), to keep it secure, and to meet legal requirements. We do not sell data or pass it on for advertising.

## 4. Who we share it with

- The vendor, when you send them a message yourself.
- The technical services the platform runs on: hosting (Cloudflare; Render, EU), database (Neon, Frankfurt), photos (Cloudinary), email (Resend). They process data only on our instructions.

## 5. How long we keep it

For as long as your account exists. After you delete the account, the data is removed within 30 days, except what the law requires us to keep.

## 6. Your rights

Under the Georgian Law on Personal Data Protection you can ask to see, correct or delete your data, and withdraw consent you have given. Write to {Contact}; we answer within 10 working days. You can also complain to the data protection supervisory authority.

## 7. Cookies

We use only the cookies and browser storage the service needs (sign-in session, chosen language). There is no advertising tracking.

## 8. Age

The service is not intended for people under 18.

## 9. Changes

Changes to this policy are published on this page.
""";
}
