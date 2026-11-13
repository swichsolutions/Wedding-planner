namespace WeddingPlanner.Domain.Entities;

/// <summary>The four kinds of editorial page (guide §5, plus the footer's legal pages).</summary>
public enum ContentPageType
{
    /// <summary>Blog article — practical planning advice, grouped by topic.</summary>
    Article = 0,
    /// <summary>Inspiration idea — photos with a short description.</summary>
    Inspiration = 1,
    /// <summary>A real couple's wedding story, with the vendors who worked on it.</summary>
    RealWedding = 2,
    /// <summary>Terms, privacy — plain prose at a top-level URL.</summary>
    Legal = 3,
}

/// <summary>
/// SEO/content surface ("რჩევები და იდეები") — a first-class part of the product
/// (CLAUDE.md §3, §5). Georgian is primary; the English fields are optional. Bodies are
/// Markdown. The first photo is the cover.
/// </summary>
public class ContentPage
{
    public int Id { get; set; }
    public ContentPageType Type { get; set; }

    /// <summary>URL slug, unique within its type.</summary>
    public string Slug { get; set; } = string.Empty;

    /// <summary>Article / inspiration topic key (see ContentTopics in the API); null otherwise.</summary>
    public string? Topic { get; set; }

    public string TitleKa { get; set; } = string.Empty;
    public string? TitleEn { get; set; }
    /// <summary>Short description for cards and the page intro.</summary>
    public string? ExcerptKa { get; set; }
    public string? ExcerptEn { get; set; }
    public string? BodyKa { get; set; }
    public string? BodyEn { get; set; }

    public string? MetaDescriptionKa { get; set; }
    public string? MetaDescriptionEn { get; set; }

    /// <summary>The page's one related action, e.g. "/fotografi" +„ნახე ფოტოგრაფები".</summary>
    public string? ActionPath { get; set; }
    public string? ActionLabelKa { get; set; }
    public string? ActionLabelEn { get; set; }

    /// <summary>Admin-only record of who agreed to publication and when (required to publish a real wedding).</summary>
    public string? ConsentNote { get; set; }

    public bool IsPublished { get; set; }
    /// <summary>Set the first time the page is published; kept through later unpublish/republish.</summary>
    public DateTimeOffset? PublishedAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }

    public List<ContentPhoto> Photos { get; set; } = new();
    public List<ContentCredit> Credits { get; set; } = new();
}

/// <summary>A photo on a content page (cover = lowest SortOrder). Articles show photos inline in the body;
/// inspiration ideas and real weddings also show them as a gallery.</summary>
public class ContentPhoto
{
    public int Id { get; set; }
    public int ContentPageId { get; set; }
    public ContentPage ContentPage { get; set; } = null!;

    public string Url { get; set; } = string.Empty;
    public string? StorageId { get; set; }
    public string AltKa { get; set; } = string.Empty;
    public string? AltEn { get; set; }
    public int SortOrder { get; set; }
}

/// <summary>A vendor credited in a real-wedding story. Linked to their profile when they're on the
/// platform (VendorId); otherwise just the name.</summary>
public class ContentCredit
{
    public int Id { get; set; }
    public int ContentPageId { get; set; }
    public ContentPage ContentPage { get; set; } = null!;

    public int? VendorId { get; set; }
    public Vendor? Vendor { get; set; }

    public string Name { get; set; } = string.Empty;
    /// <summary>What they did, e.g. „ფოტოგრაფი", „სივრცე".</summary>
    public string RoleKa { get; set; } = string.Empty;
    public string? RoleEn { get; set; }
    public int SortOrder { get; set; }
}
