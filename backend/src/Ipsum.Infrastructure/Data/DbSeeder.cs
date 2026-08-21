using Ipsum.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Ipsum.Infrastructure.Data;

/// <summary>
/// Idempotent dev seed: categories and a starter set of approved vendors.
/// Mirrors the frontend mock data so the directory looks the same once the API is live.
/// Replace/extend with real vendors (CLAUDE.md §8 step 7).
/// </summary>
public static class DbSeeder
{
    private static string Img(string id) =>
        $"https://images.unsplash.com/{id}?auto=format&fit=crop&w=1200&q=80";

    public static async Task SeedAsync(AppDbContext db)
    {
        await EnsureCategoriesAsync(db); // idempotent — adds any categories missing by slug

        if (await db.Vendors.AnyAsync())
            return; // starter vendors already seeded

        var cat = await db.Categories.ToDictionaryAsync(c => c.Slug);
        var now = DateTimeOffset.UtcNow;

        var vendors = new List<Vendor>
        {
            new()
            {
                Name = "სტუდია ნათელი", Slug = "studia-nateli", Category = cat["fotografi"],
                City = "თბილისი", CitySlug = "tbilisi", AreasServed = "თბილისი, მცხეთა, კახეთი",
                PriceMin = 1500, PriceRange = "1500–4000 ₾",
                Bio = "დოკუმენტური სტილის საქორწინო ფოტოგრაფია, რომელიც ბუნებრივ ემოციას იჭერს. ვმუშაობთ წყვილებთან მთელი დღის განმავლობაში — მზადებიდან ცეკვებამდე. გვაქვს 8 წლის გამოცდილება და 200-ზე მეტი გადაღებული ქორწილი.",
                Instagram = "studia_nateli", Phone = "+995 599 12 34 56",
                IsFeatured = true, IsApproved = true, CreatedAt = now,
                Photos = new List<VendorPhoto>
                {
                    new() { Url = Img("photo-1583939003579-730e3918a45a"), AltText = "წყვილი საქორწინო ცერემონიაზე", IsRealWedding = true, SortOrder = 0 },
                    new() { Url = Img("photo-1519741497674-611481863552"), AltText = "საქორწინო ბეჭდები და დეტალები", SortOrder = 1 },
                    new() { Url = Img("photo-1465495976277-4387d4b0b4c6"), AltText = "საქორწინო ცერემონია ღია ცის ქვეშ", IsRealWedding = true, SortOrder = 2 },
                },
            },
            new()
            {
                Name = "თეთრი დარბაზი", Slug = "tetri-darbazi", Category = cat["darbazi"],
                City = "თბილისი", CitySlug = "tbilisi", AreasServed = "თბილისი",
                PriceMin = 8000, PriceRange = "8000–20000 ₾",
                Bio = "ელეგანტური საქორწინო დარბაზი თბილისის ცენტრში, 300 სტუმრამდე. მაღალი ჭერი, ბუნებრივი განათება და დიდი ტერასა ცერემონიისთვის. სრული კეთერინგი და ტექნიკური უზრუნველყოფა.",
                Instagram = "tetri_darbazi", Phone = "+995 599 22 33 44",
                IsFeatured = true, IsApproved = true, CreatedAt = now,
                Photos = new List<VendorPhoto>
                {
                    new() { Url = Img("photo-1464366400600-7168b8af9bc3"), AltText = "საქორწინო დარბაზის ინტერიერი", IsRealWedding = true, SortOrder = 0 },
                    new() { Url = Img("photo-1519167758481-83f550bb49b3"), AltText = "გაწყობილი სუფრა დარბაზში", SortOrder = 1 },
                },
            },
            new()
            {
                Name = "ლილე მაკიაჟი", Slug = "lile-makiaji", Category = cat["makiaji"],
                City = "ბათუმი", CitySlug = "batumi", AreasServed = "ბათუმი, ქობულეთი",
                PriceMin = 400, PriceRange = "400–900 ₾",
                Bio = "საქორწინო მაკიაჟი და ვარცხნილობა, რომელიც მთელ დღეს ძლებს. ვმუშაობ ბუნებრივ, ნატურალურ სტილში და ვითვალისწინებ თითოეული პატარძლის ინდივიდუალურ ნაკვთებს. შესაძლებელია გასვლითი მომსახურება.",
                Instagram = "lile_makeup", Phone = "+995 577 55 66 77",
                IsFeatured = true, IsApproved = true, CreatedAt = now,
                Photos = new List<VendorPhoto>
                {
                    new() { Url = Img("photo-1457972729786-0411a3b2b626"), AltText = "პატარძლის მაკიაჟი", IsRealWedding = true, SortOrder = 0 },
                    new() { Url = Img("photo-1522335789203-aabd1fc54bc9"), AltText = "საქორწინო ვარცხნილობა", SortOrder = 1 },
                },
            },
            new()
            {
                Name = "ფლორა დეკორი", Slug = "flora-dekori", Category = cat["floristi"],
                City = "ქუთაისი", CitySlug = "kutaisi", AreasServed = "ქუთაისი, იმერეთი",
                PriceMin = 1200, PriceRange = "1200–5000 ₾",
                Bio = "ცოცხალი ყვავილების საქორწინო დეკორი — თაიგულებიდან არქებამდე. ვქმნით სეზონურ კომპოზიციებს და ვმუშაობთ ადგილობრივ მებაღეებთან. თითოეული ქორწილი უნიკალურია.",
                Instagram = "flora_dekori", Phone = "+995 591 88 99 00",
                IsFeatured = true, IsApproved = true, CreatedAt = now,
                Photos = new List<VendorPhoto>
                {
                    new() { Url = Img("photo-1522673607200-164d1b6ce486"), AltText = "საქორწინო ყვავილების დეკორი", IsRealWedding = true, SortOrder = 0 },
                    new() { Url = Img("photo-1507504031003-b417219a0fde"), AltText = "საქორწინო თაიგული", SortOrder = 1 },
                },
            },
            new()
            {
                Name = "გიო ბერიძე ფოტო", Slug = "gio-beridze-foto", Category = cat["fotografi"],
                City = "ბათუმი", CitySlug = "batumi", AreasServed = "ბათუმი, აჭარა",
                PriceMin = 1300, PriceRange = "1300–3500 ₾",
                Bio = "მხატვრული საქორწინო ფოტოგრაფია ზღვისპირა ფონზე. მიყვარს ბუნებრივ განათებაში გადაღება და გულწრფელი მომენტების დაჭერა. ვაწვდი სრულ ციფრულ გალერეას და ნაბეჭდ ალბომს.",
                Instagram = "gio_beridze_photo", Phone = "+995 593 11 22 33",
                IsApproved = true, CreatedAt = now,
                Photos = new List<VendorPhoto>
                {
                    new() { Url = Img("photo-1606800052052-a08af7148866"), AltText = "წყვილი ზღვის ფონზე", IsRealWedding = true, SortOrder = 0 },
                    new() { Url = Img("photo-1537633552985-df8429e8048b"), AltText = "საქორწინო პორტრეტი", SortOrder = 1 },
                },
            },
            new()
            {
                Name = "კადრი ფილმსი", Slug = "kadri-films", Category = cat["videografi"],
                City = "თბილისი", CitySlug = "tbilisi", AreasServed = "მთელი საქართველო",
                PriceMin = 2000, PriceRange = "2000–6000 ₾",
                Bio = "საქორწინო ვიდეოგრაფია კინემატოგრაფიულ სტილში. ვიღებთ მოკლე ფილმსაც და სრულ ვერსიასაც, საჰაერო კადრებით. თქვენი დღე ისე, როგორც ფილმში.",
                Instagram = "kadri_films", Phone = "+995 595 77 88 99",
                IsApproved = true, CreatedAt = now,
                Photos = new List<VendorPhoto>
                {
                    new() { Url = Img("photo-1492691527719-9d1e07e534b4"), AltText = "ვიდეოგრაფი მუშაობის პროცესში", IsRealWedding = true, SortOrder = 0 },
                    new() { Url = Img("photo-1606216794074-735e91aa2c92"), AltText = "საქორწინო გადაღების კადრი", SortOrder = 1 },
                },
            },
        };

        db.Vendors.AddRange(vendors);
        await db.SaveChangesAsync();
    }

    /// <summary>The full category taxonomy (CLAUDE.md §1). The original 8 keep SortOrder 1–8 and
    /// new ones are appended, so an already-seeded DB never needs its existing rows updated.</summary>
    private static readonly (string Ka, string En, string Slug, int Sort)[] CategorySeed =
    {
        ("ფოტოგრაფი", "Photographer", "fotografi", 1),
        ("დარბაზი", "Venue", "darbazi", 2),
        ("დეკორი", "Decor", "dekori", 3),
        ("ფლორისტი", "Florist", "floristi", 4),
        ("მაკიაჟი", "Makeup", "makiaji", 5),
        ("ვიდეოგრაფი", "Videographer", "videografi", 6),
        ("ტორტი", "Cake", "torti", 7),
        ("მუსიკა და DJ", "Music & DJ", "musika", 8),
        ("თმის სტილისტი", "Hair stylist", "tmis-stili", 9),
        ("მანიკიური", "Nails", "manikiuri", 10),
        ("საქორწილო კაბა", "Wedding dress", "kaba", 11),
        ("კოსტიუმი", "Groom's suit", "kostiumi", 12),
        ("ბეჭდები", "Rings & jewelry", "bechdebi", 13),
        ("ტრანსპორტი", "Transport", "transporti", 14),
    };

    /// <summary>Idempotently add any categories missing by slug, so an already-seeded DB picks
    /// up newly-added categories (Hair, Nails, Dress, Suit, Rings, Transport) on next startup.</summary>
    private static async Task EnsureCategoriesAsync(AppDbContext db)
    {
        var have = (await db.Categories.Select(c => c.Slug).ToListAsync()).ToHashSet();
        var missing = CategorySeed
            .Where(c => !have.Contains(c.Slug))
            .Select(c => new Category { NameKa = c.Ka, NameEn = c.En, Slug = c.Slug, SortOrder = c.Sort })
            .ToList();
        if (missing.Count == 0) return;

        db.Categories.AddRange(missing);
        await db.SaveChangesAsync();
    }
}
