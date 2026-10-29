using System.Globalization;
using System.Text.RegularExpressions;
using ClosedXML.Excel;
using WeddingPlanner.Infrastructure.Data;

namespace WeddingPlanner.Api.Import;

/// <summary>A problem in one row or cell. The admin page translates the code.</summary>
public record ImportIssue(string Code, string? Column = null, string? Value = null);

public class SheetPackage
{
    public int Row { get; init; }
    public string Name { get; set; } = string.Empty;
    public decimal? Price { get; set; }
    public string? PriceUnit { get; set; }
    /// <summary>One item per line.</summary>
    public string? Included { get; set; }
    public string? Duration { get; set; }
}

/// <summary>One vendor row, with every value already mapped to the catalog's keys.</summary>
public class SheetVendor
{
    public int Row { get; init; }
    public string? SheetId { get; set; }
    public string? Name { get; set; }
    public string? CategorySlug { get; set; }
    public string? Group { get; set; }
    public List<string> AlsoOffers { get; set; } = new();
    public string? City { get; set; }
    public string? Region { get; set; }
    public List<string> ServedRegions { get; set; } = new();
    /// <summary>Stored as "@handle".</summary>
    public string? Instagram { get; set; }
    /// <summary>The lower-case handle: how a re-import finds the vendor it created before.</summary>
    public string? InstagramKey { get; set; }
    public string? Facebook { get; set; }
    public string? Phone { get; set; }
    public string? Whatsapp { get; set; }
    public string? Email { get; set; }
    public decimal? PriceMin { get; set; }
    public string? PriceUnit { get; set; }
    public string? Bio { get; set; }
    public List<string> Styles { get; set; } = new();
    public string? VenueType { get; set; }
    public int? CapacityMin { get; set; }
    public int? CapacityMax { get; set; }
    public string? Setting { get; set; }
    public string? DepositTerms { get; set; }
    public string? CancellationTerms { get; set; }
    public string? TravelPolicy { get; set; }
    public string? BookingLeadTime { get; set; }
    /// <summary>The photo folder or links: shown to the admin, who uploads the photos.</summary>
    public string? Photos { get; set; }
    public string? ConsentBy { get; set; }
    public DateOnly? ConsentOn { get; set; }
    public string? ConsentMethod { get; set; }
    public List<SheetPackage> Packages { get; } = new();
    public List<ImportIssue> Errors { get; } = new();
    public List<ImportIssue> Warnings { get; } = new();
}

public class SheetReadResult
{
    public List<SheetVendor> Vendors { get; } = new();
    /// <summary>Problems with the file itself; nothing is imported when there are any.</summary>
    public List<ImportIssue> FileErrors { get; } = new();
    /// <summary>Package rows that couldn't be attached to a vendor.</summary>
    public List<ImportIssue> FileWarnings { get; } = new();
}

/// <summary>
/// Reads the vendor collection spreadsheet (design-system/templates/vendor-collection.xlsx,
/// PROPOSALS.md P6). Columns are found by their header text, so a reordered or older copy of the
/// template still reads. Dropdown values are the template's Georgian labels; the keys themselves
/// ("event", "kakheti") are accepted too.
/// </summary>
public static class VendorSheetReader
{
    public const string VendorSheet = "მომწოდებლები";
    public const string PackageSheet = "პაკეტები";
    /// <summary>The template's sample row (row 2) carries this ID and is skipped.</summary>
    public const string ExampleId = "მაგალითი";
    public const int MaxRows = 1000;

    // Header texts, exactly as in the template.
    private const string ColId = "ID";
    private const string ColName = "სახელი";
    private const string ColSubtype = "ქვესახეობა";
    private const string ColAlso = "ასევე სთავაზობს";
    private const string ColCity = "ქალაქი ან სოფელი";
    private const string ColRegion = "რეგიონი";
    private const string ColServed = "მომსახურების რეგიონები";
    private const string ColInstagram = "Instagram";
    private const string ColFacebook = "Facebook";
    private const string ColPhone = "ტელეფონი";
    private const string ColWhatsapp = "WhatsApp";
    private const string ColEmail = "ელფოსტა";
    private const string ColPrice = "საწყისი ფასი (₾)";
    private const string ColUnit = "ფასის ერთეული";
    private const string ColBio = "აღწერა (ქართ.)";
    private const string ColStyles = "სტილი";
    private const string ColVenueType = "სივრცის ტიპი";
    private const string ColCapMin = "ტევადობა: მინ.";
    private const string ColCapMax = "ტევადობა: მაქს.";
    private const string ColSetting = "ღია / დახურული";
    private const string ColDeposit = "ავანსი";
    private const string ColCancel = "გაუქმება / თარიღის შეცვლა";
    private const string ColTravel = "ქალაქგარეთ მუშაობა";
    private const string ColLead = "დაჯავშნა რამდენი ხნით ადრე";
    private const string ColPhotos = "ფოტოები";
    private const string ColConsentBy = "ნებართვა: ვინ მისცა";
    private const string ColConsentOn = "ნებართვა: თარიღი";
    private const string ColConsentHow = "ნებართვა: როგორ";

    private const string ColPkgVendor = "მომწოდებლის ID";
    private const string ColPkgName = "პაკეტის სახელი";
    private const string ColPkgPrice = "ფასი (₾)";
    private const string ColPkgIncluded = "რა შედის";
    private const string ColPkgDuration = "ხანგრძლივობა";

    private static readonly string[] RequiredVendorColumns =
    {
        ColId, ColName, ColSubtype, ColCity, ColRegion, ColInstagram, ColConsentBy, ColConsentOn, ColConsentHow,
    };
    private static readonly string[] RequiredPackageColumns = { ColPkgVendor, ColPkgName };

    // ---- the template's dropdown labels → catalog keys (core/catalog.ts, CatalogRules) ----
    private static readonly Dictionary<string, string> RegionLabels = new()
    {
        ["თბილისი"] = "tbilisi", ["კახეთი"] = "kakheti", ["მცხეთა-მთიანეთი"] = "mtskheta-mtianeti",
        ["იმერეთი"] = "imereti", ["აჭარა"] = "adjara", ["ქვემო ქართლი"] = "kvemo-kartli",
        ["შიდა ქართლი"] = "shida-kartli", ["სამცხე-ჯავახეთი"] = "samtskhe-javakheti",
        ["სამეგრელო-ზემო სვანეთი"] = "samegrelo-zemo-svaneti", ["გურია"] = "guria",
        ["რაჭა-ლეჩხუმი და ქვემო სვანეთი"] = "racha-lechkhumi",
    };
    private static readonly Dictionary<string, string> UnitLabels = new()
    {
        ["ერთ ღონისძიებაზე"] = "event", ["ერთ სტუმარზე"] = "guest", ["საათში"] = "hour",
        ["კილოგრამზე"] = "kg", ["ერთეულზე"] = "item",
    };
    private static readonly Dictionary<string, string> VenueTypeLabels = new()
    {
        ["რესტორანი"] = "restaurant", ["დარბაზი"] = "hall", ["ღია სივრცე"] = "openAir",
        ["მარანი"] = "winery", ["სასტუმრო"] = "hotel",
    };
    private static readonly Dictionary<string, string> SettingLabels = new()
    {
        ["დახურული"] = "indoor", ["ღია"] = "outdoor", ["ორივე"] = "both",
    };
    private static readonly Dictionary<string, string> TravelLabels = new()
    {
        ["შედის ფასში"] = "included", ["დამატებითი ღირებულებით"] = "extra", ["არ მუშაობს ქალაქგარეთ"] = "none",
    };
    private static readonly Dictionary<string, string> StyleLabels = new()
    {
        ["კლასიკური"] = "classic", ["თანამედროვე"] = "modern", ["მინიმალისტური"] = "minimalist",
        ["რუსტიკული"] = "rustic", ["ტრადიციული ქართული"] = "traditional", ["რომანტიკული"] = "romantic",
        ["ბოჰო"] = "boho", ["დოკუმენტური"] = "documentary",
    };

    public static SheetReadResult Read(Stream xlsx)
    {
        var result = new SheetReadResult();
        XLWorkbook workbook;
        try
        {
            workbook = new XLWorkbook(xlsx);
        }
        catch (Exception)
        {
            result.FileErrors.Add(new ImportIssue("notXlsx"));
            return result;
        }

        using (workbook)
        {
            if (!workbook.TryGetWorksheet(VendorSheet, out var vendorSheet))
            {
                result.FileErrors.Add(new ImportIssue("noVendorSheet", Value: VendorSheet));
                return result;
            }
            var columns = Headers(vendorSheet);
            var missing = RequiredVendorColumns.Where(c => !columns.ContainsKey(c)).ToList();
            if (missing.Count > 0)
            {
                result.FileErrors.Add(new ImportIssue("missingColumns", VendorSheet, string.Join(", ", missing)));
                return result;
            }

            var lastRow = vendorSheet.LastRowUsed(XLCellsUsedOptions.Contents)?.RowNumber() ?? 1;
            if (lastRow - 1 > MaxRows)
            {
                result.FileErrors.Add(new ImportIssue("tooManyRows", Value: MaxRows.ToString(CultureInfo.InvariantCulture)));
                return result;
            }

            for (var r = 2; r <= lastRow; r++)
            {
                var row = new RowReader(vendorSheet.Row(r), columns);
                if (row.IsBlank || row.Text(ColId) == ExampleId) continue;
                result.Vendors.Add(ParseVendor(row, r));
            }
            MarkDuplicates(result.Vendors);

            if (workbook.TryGetWorksheet(PackageSheet, out var packageSheet))
                ReadPackages(packageSheet, result);
        }
        return result;
    }

    private static SheetVendor ParseVendor(RowReader row, int rowNumber)
    {
        var v = new SheetVendor { Row = rowNumber };

        v.SheetId = row.Text(ColId);
        if (v.SheetId is null) v.Errors.Add(new ImportIssue("required", ColId));

        v.Name = row.Required(ColName, 200, v);

        // Sub-type: the dropdown's "ფოტოგრაფი [fotografi]", a bare slug, or the Georgian name.
        var subtype = row.Text(ColSubtype);
        if (subtype is null) v.Errors.Add(new ImportIssue("required", ColSubtype));
        else if (FindCategory(subtype) is { } cat)
        {
            v.CategorySlug = cat.Slug;
            v.Group = cat.Group;
        }
        else v.Errors.Add(new ImportIssue("unknown", ColSubtype, subtype));

        // Also offers: other sub-types of the same group.
        var also = row.Text(ColAlso);
        if (also is not null)
        {
            foreach (var part in CategoryParts(also))
            {
                var cat = FindCategory(part);
                if (cat is null || v.Group is null || cat.Value.Group != v.Group || cat.Value.Slug == v.CategorySlug)
                    v.Warnings.Add(new ImportIssue("ignored", ColAlso, part));
                else if (!v.AlsoOffers.Contains(cat.Value.Slug))
                    v.AlsoOffers.Add(cat.Value.Slug);
            }
        }

        v.City = row.Required(ColCity, 120, v);
        var region = row.Text(ColRegion);
        if (region is null) v.Errors.Add(new ImportIssue("required", ColRegion));
        else v.Region = Lookup(RegionLabels, region) ?? Error(v, "unknown", ColRegion, region);

        var isVenue = v.Group == "venues";
        foreach (var part in List(row.Text(ColServed)))
        {
            if (isVenue) v.Warnings.Add(new ImportIssue("venueOnly", ColServed, part));
            else if (Lookup(RegionLabels, part) is { } key)
            {
                if (key != v.Region && !v.ServedRegions.Contains(key)) v.ServedRegions.Add(key);
            }
            else v.Warnings.Add(new ImportIssue("ignored", ColServed, part));
        }

        var instagram = row.Text(ColInstagram);
        if (instagram is null) v.Errors.Add(new ImportIssue("required", ColInstagram));
        else if (InstagramHandle(instagram) is { } handle)
        {
            v.InstagramKey = handle;
            v.Instagram = "@" + handle;
        }
        else v.Errors.Add(new ImportIssue("badInstagram", ColInstagram, instagram));

        v.Facebook = row.Optional(ColFacebook, 200, v);
        v.Phone = row.Optional(ColPhone, 40, v);
        var whatsapp = row.Text(ColWhatsapp);
        if (whatsapp is not null)
        {
            v.Whatsapp = Contacts.NormalizeWhatsapp(whatsapp);
            if (v.Whatsapp is null) v.Warnings.Add(new ImportIssue("ignored", ColWhatsapp, whatsapp));
        }
        var email = row.Text(ColEmail);
        if (email is not null)
        {
            if (email.Length <= 256 && Regex.IsMatch(email, @"^[^@\s]+@[^@\s]+\.[^@\s]+$")) v.Email = email;
            else v.Warnings.Add(new ImportIssue("ignored", ColEmail, email));
        }

        // Price: the sheet requires it, but a profile without one still imports (it shows no price).
        v.PriceMin = row.Number(ColPrice, v);
        if (v.PriceMin is null && row.Text(ColPrice) is null) v.Warnings.Add(new ImportIssue("noPrice", ColPrice));
        var unit = row.Text(ColUnit);
        if (unit is not null) v.PriceUnit = Lookup(UnitLabels, unit) ?? Error(v, "unknown", ColUnit, unit);
        else if (v.PriceMin is not null && v.Group is not null)
        {
            v.PriceUnit = CatalogRules.DefaultPriceUnit(v.Group);
            v.Warnings.Add(new ImportIssue("defaultUnit", ColUnit, v.PriceUnit));
        }

        v.Bio = row.Optional(ColBio, 4000, v);
        if (v.Bio is null) v.Warnings.Add(new ImportIssue("noBio", ColBio));

        var styles = row.Text(ColStyles);
        if (styles is not null)
        {
            if (v.Group is not null && !CatalogRules.StyleGroups.Contains(v.Group))
                v.Warnings.Add(new ImportIssue("notApplicable", ColStyles, styles));
            else
            {
                foreach (var part in List(styles))
                {
                    var key = Lookup(StyleLabels, part);
                    if (key is null || (key == "documentary" && v.Group != "photo"))
                        v.Warnings.Add(new ImportIssue("ignored", ColStyles, part));
                    else if (!v.Styles.Contains(key)) v.Styles.Add(key);
                }
            }
        }

        // Venue-only fields: read for venues, flagged (and dropped) for everyone else.
        var venueType = row.Text(ColVenueType);
        var setting = row.Text(ColSetting);
        if (isVenue)
        {
            if (venueType is not null) v.VenueType = Lookup(VenueTypeLabels, venueType) ?? Warn(v, "ignored", ColVenueType, venueType);
            if (setting is not null) v.Setting = Lookup(SettingLabels, setting) ?? Warn(v, "ignored", ColSetting, setting);
            v.CapacityMin = row.Integer(ColCapMin, v);
            v.CapacityMax = row.Integer(ColCapMax, v);
            if (v.CapacityMin is int lo && v.CapacityMax is int hi && lo > hi)
                v.Errors.Add(new ImportIssue("capacityOrder", ColCapMin, $"{lo} > {hi}"));
        }
        else if (v.Group is not null
                 && new[] { venueType, setting, row.Text(ColCapMin), row.Text(ColCapMax) }.Any(x => x is not null))
        {
            v.Warnings.Add(new ImportIssue("venueFields"));
        }

        v.DepositTerms = row.Optional(ColDeposit, 200, v);
        v.CancellationTerms = row.Optional(ColCancel, 500, v);
        var travel = row.Text(ColTravel);
        if (travel is not null) v.TravelPolicy = Lookup(TravelLabels, travel) ?? Warn(v, "ignored", ColTravel, travel);
        v.BookingLeadTime = row.Optional(ColLead, 100, v);

        v.Photos = row.Text(ColPhotos);

        // Permission is what lets us show the vendor's photos at all: without it, no import.
        v.ConsentBy = row.Required(ColConsentBy, 200, v);
        v.ConsentOn = row.Date(ColConsentOn, v);
        v.ConsentMethod = row.Required(ColConsentHow, 60, v);

        return v;
    }

    /// <summary>The same ID or Instagram twice: the later row is an error (the first one wins).</summary>
    private static void MarkDuplicates(List<SheetVendor> vendors)
    {
        var ids = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var handles = new HashSet<string>();
        foreach (var v in vendors)
        {
            if (v.SheetId is not null && !ids.Add(v.SheetId))
                v.Errors.Add(new ImportIssue("duplicateId", ColId, v.SheetId));
            if (v.InstagramKey is not null && !handles.Add(v.InstagramKey))
                v.Errors.Add(new ImportIssue("duplicateInstagram", ColInstagram, v.Instagram));
        }
    }

    private static void ReadPackages(IXLWorksheet sheet, SheetReadResult result)
    {
        var columns = Headers(sheet);
        var missing = RequiredPackageColumns.Where(c => !columns.ContainsKey(c)).ToList();
        if (missing.Count > 0)
        {
            result.FileWarnings.Add(new ImportIssue("missingColumns", PackageSheet, string.Join(", ", missing)));
            return;
        }

        // First row with an ID wins, as for the vendors themselves.
        var byId = new Dictionary<string, SheetVendor>(StringComparer.OrdinalIgnoreCase);
        foreach (var v in result.Vendors)
            if (v.SheetId is not null) byId.TryAdd(v.SheetId, v);

        var lastRow = Math.Min(sheet.LastRowUsed(XLCellsUsedOptions.Contents)?.RowNumber() ?? 1, MaxRows * 6);
        for (var r = 2; r <= lastRow; r++)
        {
            var row = new RowReader(sheet.Row(r), columns);
            var vendorId = row.Text(ColPkgVendor);
            if (row.IsBlank || vendorId == ExampleId) continue;
            var where = $"{PackageSheet} {r}";

            if (vendorId is null || !byId.TryGetValue(vendorId, out var vendor))
            {
                result.FileWarnings.Add(new ImportIssue("packageNoVendor", where, vendorId));
                continue;
            }

            // A bad package row is skipped with a note on its vendor; the vendor still imports.
            var issues = new List<ImportIssue>();
            var name = row.Text(ColPkgName);
            if (name is null) issues.Add(new ImportIssue("required", ColPkgName));
            else if (name.Length > 120) issues.Add(new ImportIssue("tooLong", ColPkgName, "120"));

            var package = new SheetPackage { Row = r, Name = name ?? string.Empty };
            var probe = new SheetVendor { Row = r };
            package.Price = row.Number(ColPkgPrice, probe);
            var unit = row.Text(ColUnit);
            if (unit is not null)
            {
                package.PriceUnit = Lookup(UnitLabels, unit);
                if (package.PriceUnit is null) issues.Add(new ImportIssue("unknown", ColUnit, unit));
            }
            else if (package.Price is not null && vendor.Group is not null)
            {
                package.PriceUnit = CatalogRules.DefaultPriceUnit(vendor.Group);
            }
            package.Included = IncludedList(row.Text(ColPkgIncluded));
            if (package.Included?.Length > 1000) issues.Add(new ImportIssue("tooLong", ColPkgIncluded, "1000"));
            package.Duration = row.Optional(ColPkgDuration, 60, probe);
            issues.AddRange(probe.Errors);

            if (issues.Count > 0)
            {
                vendor.Warnings.Add(new ImportIssue("packageSkipped", where,
                    string.Join(", ", issues.Select(i => i.Column).Distinct())));
            }
            else if (vendor.Packages.Count >= CatalogRules.MaxPackages)
            {
                vendor.Warnings.Add(new ImportIssue("tooManyPackages", where, CatalogRules.MaxPackages.ToString(CultureInfo.InvariantCulture)));
            }
            else vendor.Packages.Add(package);
        }
    }

    // ---- helpers ----

    private static Dictionary<string, int> Headers(IXLWorksheet sheet)
    {
        var map = new Dictionary<string, int>();
        foreach (var cell in sheet.Row(1).CellsUsed(XLCellsUsedOptions.Contents))
        {
            var text = Squash(cell.GetFormattedString());
            if (text.Length > 0) map.TryAdd(text, cell.Address.ColumnNumber);
        }
        return map;
    }

    private static string Squash(string s) => Regex.Replace(s, @"\s+", " ").Trim();

    private static (string Slug, string Group)? FindCategory(string text)
    {
        var bracket = Regex.Match(text, @"\[([a-z0-9-]+)\]\s*$");
        var probe = bracket.Success ? bracket.Groups[1].Value : Squash(text);
        foreach (var c in CategoryCatalog.Categories)
        {
            if (string.Equals(c.Slug, probe, StringComparison.OrdinalIgnoreCase)
                || string.Equals(c.Ka, probe, StringComparison.OrdinalIgnoreCase)
                || string.Equals(c.En, probe, StringComparison.OrdinalIgnoreCase))
                return (c.Slug, c.Group);
        }
        return null;
    }

    /// <summary>
    /// Splits "ვიდეოგრაფი, ფლორისტი" into names. The venue's dropdown label has commas inside its
    /// brackets ("სივრცე (რესტორანი, დარბაზი…) [darbazi]"), so bracketed text is dropped first.
    /// </summary>
    private static IEnumerable<string> CategoryParts(string text)
    {
        var slugs = Regex.Matches(text, @"\[([a-z0-9-]+)\]").Select(m => m.Groups[1].Value).ToList();
        if (slugs.Count > 0) return slugs;
        return List(Regex.Replace(text, @"\([^)]*\)", string.Empty));
    }

    private static IEnumerable<string> List(string? text) =>
        string.IsNullOrWhiteSpace(text)
            ? Enumerable.Empty<string>()
            : text.Split(new[] { ',', ';', '\n' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(s => s.Length > 0);

    private static string? Lookup(Dictionary<string, string> labels, string text)
    {
        var probe = Squash(text);
        foreach (var (label, key) in labels)
        {
            if (string.Equals(label, probe, StringComparison.OrdinalIgnoreCase)
                || string.Equals(key, probe, StringComparison.OrdinalIgnoreCase))
                return key;
        }
        return null;
    }

    /// <summary>"@studio", "studio" or an instagram.com link → "studio" (null if it isn't a handle).</summary>
    public static string? InstagramHandle(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var s = raw.Trim();
        var link = Regex.Match(s, @"instagram\.com/([A-Za-z0-9._]+)", RegexOptions.IgnoreCase);
        var handle = (link.Success ? link.Groups[1].Value : s.TrimStart('@')).Trim().ToLowerInvariant();
        return Regex.IsMatch(handle, @"^[a-z0-9._]{1,30}$") ? handle : null;
    }

    /// <summary>"a; b; c" (or "a, b, c" when there's no semicolon) → one item per line.</summary>
    private static string? IncludedList(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        var separators = text.IndexOfAny(new[] { ';', '\n' }) >= 0 ? new[] { ';', '\n' } : new[] { ',' };
        var items = text.Split(separators, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return items.Length == 0 ? null : string.Join('\n', items);
    }

    private static string? Error(SheetVendor v, string code, string column, string value)
    {
        v.Errors.Add(new ImportIssue(code, column, value));
        return null;
    }

    private static string? Warn(SheetVendor v, string code, string column, string value)
    {
        v.Warnings.Add(new ImportIssue(code, column, value));
        return null;
    }

    /// <summary>Reads one row's cells by header name.</summary>
    private sealed class RowReader
    {
        private readonly IXLRow _row;
        private readonly Dictionary<string, int> _columns;

        public RowReader(IXLRow row, Dictionary<string, int> columns)
        {
            _row = row;
            _columns = columns;
        }

        public bool IsBlank => _columns.Values.All(c => Text(_row.Cell(c)) is null);

        public string? Text(string column) =>
            _columns.TryGetValue(column, out var c) ? Text(_row.Cell(c)) : null;

        private IXLCell? Cell(string column) =>
            _columns.TryGetValue(column, out var c) ? _row.Cell(c) : null;

        private static string? Text(IXLCell cell)
        {
            var value = cell.Value;
            if (value.IsBlank) return null;
            var text = value.IsText ? value.GetText()
                : value.IsNumber ? value.GetNumber().ToString(CultureInfo.InvariantCulture)
                : cell.GetFormattedString();
            text = text.Replace("\r\n", "\n").Trim();
            return text.Length == 0 ? null : text;
        }

        public string? Required(string column, int max, SheetVendor v)
        {
            var text = Text(column);
            if (text is null) v.Errors.Add(new ImportIssue("required", column));
            else if (text.Length > max) v.Errors.Add(new ImportIssue("tooLong", column, max.ToString(CultureInfo.InvariantCulture)));
            else return text;
            return null;
        }

        public string? Optional(string column, int max, SheetVendor v)
        {
            var text = Text(column);
            if (text is not null && text.Length > max)
            {
                v.Errors.Add(new ImportIssue("tooLong", column, max.ToString(CultureInfo.InvariantCulture)));
                return null;
            }
            return text;
        }

        /// <summary>A price in lari: a number cell, or text like "1 200 ₾" / "1,200".</summary>
        public decimal? Number(string column, SheetVendor v)
        {
            var cell = Cell(column);
            if (cell is null || cell.Value.IsBlank) return null;
            decimal? result = null;
            if (cell.Value.IsNumber)
            {
                var n = cell.Value.GetNumber();
                if (n is >= 0 and <= 10_000_000) result = (decimal)n;
            }
            else if (Text(cell) is { } text)
            {
                var s = Regex.Replace(text, @"[\s₾]|ლარი|GEL", string.Empty, RegexOptions.IgnoreCase);
                s = Regex.IsMatch(s, @"^\d{1,3}(,\d{3})+(\.\d+)?$") ? s.Replace(",", string.Empty) : s.Replace(',', '.');
                if (decimal.TryParse(s, NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var parsed))
                    result = parsed;
            }
            if (result is null || result < 0 || result > 10_000_000)
            {
                v.Errors.Add(new ImportIssue("notNumber", column, Text(cell)));
                return null;
            }
            return Math.Round(result.Value, 2);
        }

        /// <summary>A guest count, 1–5000.</summary>
        public int? Integer(string column, SheetVendor v)
        {
            var cell = Cell(column);
            if (cell is null || cell.Value.IsBlank) return null;
            var text = Text(cell);
            if (cell.Value.IsNumber && cell.Value.GetNumber() is var n && n == Math.Floor(n) && n is >= 1 and <= 5000)
                return (int)n;
            if (text is not null && int.TryParse(text.Replace(" ", string.Empty), out var parsed) && parsed is >= 1 and <= 5000)
                return parsed;
            v.Errors.Add(new ImportIssue("notNumber", column, text));
            return null;
        }

        public DateOnly? Date(string column, SheetVendor v)
        {
            var cell = Cell(column);
            if (cell is null || cell.Value.IsBlank)
            {
                v.Errors.Add(new ImportIssue("required", column));
                return null;
            }
            if (cell.Value.IsDateTime) return DateOnly.FromDateTime(cell.Value.GetDateTime());
            if (cell.Value.IsNumber)
            {
                var serial = cell.Value.GetNumber();
                if (serial is > 0 and < 2958466) return DateOnly.FromDateTime(DateTime.FromOADate(serial));
            }
            var text = Text(cell);
            if (text is not null && DateOnly.TryParseExact(text,
                    new[] { "dd.MM.yyyy", "d.M.yyyy", "yyyy-MM-dd", "dd/MM/yyyy", "d/M/yyyy" },
                    CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
                return date;
            v.Errors.Add(new ImportIssue("notDate", column, text));
            return null;
        }
    }
}
