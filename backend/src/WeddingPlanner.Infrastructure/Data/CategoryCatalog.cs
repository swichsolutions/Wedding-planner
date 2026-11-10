using WeddingPlanner.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace WeddingPlanner.Infrastructure.Data;

/// <summary>
/// The catalog taxonomy (design-system/PROPOSALS.md P1, approved 2026-10-21): 9 groups,
/// 26 categories (2026-11-10: attire and accessories split, guest accommodation removed).
/// Owned by code and synced into the Categories table on every startup in every environment —
/// vendor registration and the catalog need the rows, and a fresh production database
/// otherwise has none. Existing slugs never change (they're live URLs).
/// Mirrored in the frontend's core/catalog.ts.
/// </summary>
public static class CategoryCatalog
{
    public static readonly string[] Groups = { "venues", "photo", "decor", "music", "cake", "attire", "accessories", "beauty", "other" };

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
        ("aksesuarebi", "accessories", "აქსესუარები", "Accessories"),
        ("bechdebi", "accessories", "ბეჭდები და სამკაული", "Rings & jewellery"),
        ("makiaji", "beauty", "მაკიაჟი", "Makeup"),
        ("tmis-stili", "beauty", "თმის სტილისტი", "Hair stylist"),
        ("manikiuri", "beauty", "მანიკიური", "Nails"),
        ("saloni", "beauty", "სილამაზის სალონი", "Beauty salon"),
        ("movla", "beauty", "მოვლის მომსახურებები", "Care (spa, skincare)"),
        ("transporti", "other", "ტრანსპორტი", "Transport"),
        ("bechduri-mosatsvevebi", "other", "ბეჭდური მოსაწვევები", "Printed invitations"),
        ("koordinatori", "other", "ქორწილის დღის კოორდინატორი", "Day-of coordinator"),
    };

    /// <summary>
    /// Slugs taken out of the catalog, and where task links to them open now. Guest accommodation
    /// (2026-11-10): nobody offers only that; hotels list as venues with on-site accommodation.
    /// </summary>
    public static readonly Dictionary<string, string> Retired = new()
    {
        ["gantavseba"] = "catalog:darbazi?features=accommodation",
    };

    /// <summary>
    /// Insert missing categories and bring names, group and order up to date. A retired
    /// category's row goes once no vendor uses it, and checklist links to it are moved.
    /// </summary>
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
        foreach (var (slug, link) in Retired)
        {
            if (existing.TryGetValue(slug, out var gone) && !await db.Vendors.AnyAsync(v => v.CategoryId == gone.Id))
                db.Categories.Remove(gone);
            await db.ChecklistItems.Where(c => c.Link == "catalog:" + slug)
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.Link, link));
        }
        await db.SaveChangesAsync();
    }
}
