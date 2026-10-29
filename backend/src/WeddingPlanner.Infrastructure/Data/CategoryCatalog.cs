using WeddingPlanner.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace WeddingPlanner.Infrastructure.Data;

/// <summary>
/// The catalog taxonomy (design-system/PROPOSALS.md P1, approved 2026-10-21): 8 groups,
/// 27 categories. Owned by code and synced into the Categories table on every startup in
/// every environment — vendor registration and the catalog need the rows, and a fresh
/// production database otherwise has none. Existing slugs never change (they're live URLs).
/// Mirrored in the frontend's core/catalog.ts.
/// </summary>
public static class CategoryCatalog
{
    public static readonly string[] Groups = { "venues", "photo", "decor", "music", "cake", "attire", "beauty", "other" };

    public static readonly (string Slug, string Group, string Ka, string En)[] Categories =
    {
        // Singular, like the others: it labels one vendor ("სივრცე · თბილისი").
        ("darbazi", "venues", "სივრცე", "Venue"),
        ("keiteringi", "venues", "ქეითერინგი", "Catering"),
        ("fotografi", "photo", "ფოტოგრაფი", "Photographer"),
        ("videografi", "photo", "ვიდეოგრაფი", "Videographer"),
        ("dekori", "decor", "დეკორატორი", "Decorator"),
        ("floristi", "decor", "ფლორისტი", "Florist"),
        ("inventari", "decor", "ავეჯისა და ინვენტარის გაქირავება", "Furniture & equipment rental"),
        ("musika", "music", "ბენდი და DJ", "Band & DJ"),
        ("tamada", "music", "თამადა", "Tamada"),
        ("tsamqvani", "music", "წამყვანი", "Host / MC"),
        ("gasartobi", "music", "გასართობი პროგრამა", "Entertainment"),
        ("torti", "cake", "საქორწილო ტორტი", "Wedding cake"),
        ("tkbileuli", "cake", "დესერტები და ტკბილეულის მაგიდა", "Desserts & sweet table"),
        ("kaba", "attire", "საქორწილო კაბა", "Wedding dress"),
        ("kostiumi", "attire", "კოსტიუმი", "Suit"),
        ("pekhsatsmeli", "attire", "ფეხსაცმელი", "Shoes"),
        ("aksesuarebi", "attire", "აქსესუარები", "Accessories"),
        ("bechdebi", "attire", "ბეჭდები და სამკაული", "Rings & jewellery"),
        ("makiaji", "beauty", "მაკიაჟი", "Makeup"),
        ("tmis-stili", "beauty", "თმის სტილისტი", "Hair stylist"),
        ("manikiuri", "beauty", "მანიკიური", "Nails"),
        ("saloni", "beauty", "სილამაზის სალონი", "Beauty salon"),
        ("movla", "beauty", "მოვლის მომსახურებები", "Care (spa, skincare)"),
        ("transporti", "other", "ტრანსპორტი", "Transport"),
        ("bechduri-mosatsvevebi", "other", "ბეჭდური მოსაწვევები", "Printed invitations"),
        ("gantavseba", "other", "სტუმრების განთავსება", "Guest accommodation"),
        ("koordinatori", "other", "ქორწილის დღის კოორდინატორი", "Day-of coordinator"),
    };

    /// <summary>Insert missing categories and bring names, group and order up to date.</summary>
    public static async Task SyncAsync(AppDbContext db)
    {
        var existing = await db.Categories.ToDictionaryAsync(c => c.Slug);
        for (var i = 0; i < Categories.Length; i++)
        {
            var (slug, group, ka, en) = Categories[i];
            if (!existing.TryGetValue(slug, out var cat))
            {
                cat = new Category { Slug = slug };
                db.Categories.Add(cat);
            }
            cat.GroupKey = group;
            cat.NameKa = ka;
            cat.NameEn = en;
            cat.SortOrder = i + 1;
        }
        await db.SaveChangesAsync();
    }
}
