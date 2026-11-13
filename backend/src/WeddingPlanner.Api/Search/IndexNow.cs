using System.Net.Http.Json;
using System.Threading.Channels;
using WeddingPlanner.Domain.Entities;
using WeddingPlanner.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace WeddingPlanner.Api.Search;

/// <summary>
/// IndexNow (https://www.indexnow.org): tells Bing, Yandex and the other engines that share it
/// which public pages just changed, so a new vendor or article is crawled within hours instead
/// of whenever the engine comes by. ChatGPT and Copilot search through Bing, which makes this
/// the fast path into AI answers too. Google does not take part (Search Console covers it).
///
/// A request only drops a note in the queue (<see cref="IndexNowQueue"/>) and answers at once;
/// <see cref="IndexNowWorker"/> waits a minute to collect what else changes, turns the notes into
/// addresses from the database as it is then, and posts them in one batch. On only where the
/// site is public: IndexNow:Key set and Site:PublicOrigin an https address. The key must match
/// the file the site serves at /&lt;key&gt;.txt (frontend/public), which proves the site is ours.
/// </summary>
public class IndexNowQueue
{
    private readonly Channel<Note> _channel =
        Channel.CreateBounded<Note>(new BoundedChannelOptions(2000) { SingleReader = true, FullMode = BoundedChannelFullMode.DropWrite });

    public IndexNowQueue(IConfiguration config)
    {
        Key = config["IndexNow:Key"]?.Trim() ?? "";
        Origin = config["Site:PublicOrigin"]?.Trim().TrimEnd('/') ?? "";
        Enabled = Key.Length >= 8 && Origin.StartsWith("https://", StringComparison.OrdinalIgnoreCase);
    }

    public bool Enabled { get; }
    public string Key { get; }
    public string Origin { get; }

    /// <summary>A vendor's page and the catalog pages that list it changed (approved, edited, reviewed).</summary>
    public void Vendor(int vendorId) => Write(new Note(VendorId: vendorId));

    /// <summary>An editorial or legal page changed (published, edited, unpublished).</summary>
    public void Content(int contentId) => Write(new Note(ContentId: contentId));

    /// <summary>Addresses worked out by the caller: pages that are about to disappear or move.</summary>
    public void Paths(IEnumerable<string> paths)
    {
        foreach (var p in paths) Write(new Note(Path: p));
    }

    public ChannelReader<Note> Reader => _channel.Reader;

    private void Write(Note note)
    {
        if (Enabled) _channel.Writer.TryWrite(note);
    }

    public record Note(int? VendorId = null, int? ContentId = null, string? Path = null);
}

/// <summary>The page addresses of a vendor or an editorial page, as the site and the sitemap have them.</summary>
public static class IndexNowPaths
{
    /// <summary>A vendor's profile and the catalog pages that list it: category×city, category, group, the catalog.</summary>
    public static IEnumerable<string> ForVendor(string categorySlug, string groupKey, string citySlug, string slug)
    {
        yield return $"/{categorySlug}/{citySlug}/{slug}";
        yield return $"/{categorySlug}/{citySlug}";
        yield return $"/{categorySlug}";
        if (SiteAddresses.GroupSlugs.TryGetValue(groupKey, out var group)) yield return $"/{group}";
        yield return "/vendors";
    }

    /// <summary>An editorial page, plus its section and the guides hub (they list it); a legal page alone.</summary>
    public static IEnumerable<string> ForContent(ContentPageType type, string slug)
    {
        yield return ContentRules.PublicPath(type, slug);
        var section = type switch
        {
            ContentPageType.Article => SiteAddresses.Blog,
            ContentPageType.Inspiration => SiteAddresses.Inspiration,
            ContentPageType.RealWedding => SiteAddresses.RealWeddings,
            _ => null,
        };
        if (section is null) yield break;
        yield return section;
        yield return SiteAddresses.Guides;
    }
}

public class IndexNowWorker : BackgroundService
{
    /// <summary>How long to collect changes before sending: an admin approving ten vendors makes one request.</summary>
    private static readonly TimeSpan Window = TimeSpan.FromSeconds(60);
    private const int MaxUrls = 10_000; // IndexNow's limit per request

    private readonly IndexNowQueue _queue;
    private readonly IServiceScopeFactory _scopes;
    private readonly IHttpClientFactory _http;
    private readonly IConfiguration _config;
    private readonly ILogger<IndexNowWorker> _logger;

    public IndexNowWorker(IndexNowQueue queue, IServiceScopeFactory scopes, IHttpClientFactory http,
        IConfiguration config, ILogger<IndexNowWorker> logger)
    {
        _queue = queue;
        _scopes = scopes;
        _http = http;
        _config = config;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_queue.Enabled) return;
        try
        {
            while (await _queue.Reader.WaitToReadAsync(stoppingToken))
            {
                await Task.Delay(Window, stoppingToken);
                var notes = new List<IndexNowQueue.Note>();
                while (_queue.Reader.TryRead(out var note)) notes.Add(note);
                try
                {
                    await SendAsync(notes, stoppingToken);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    // Nothing to retry: the pages are still in the sitemap, the engine only learns later.
                    _logger.LogWarning(ex, "IndexNow: sending {Count} changes failed.", notes.Count);
                }
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
        }
    }

    private async Task SendAsync(List<IndexNowQueue.Note> notes, CancellationToken ct)
    {
        var paths = new HashSet<string>(notes.Where(n => n.Path is not null).Select(n => n.Path!));

        using (var scope = _scopes.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var vendorIds = notes.Where(n => n.VendorId is not null).Select(n => n.VendorId!.Value).Distinct().ToList();
            if (vendorIds.Count > 0)
            {
                // Only listed vendors have a page; the rest would only be 404s.
                var vendors = await db.Vendors.AsNoTracking()
                    .Where(v => vendorIds.Contains(v.Id) && v.IsApproved && v.City != "" && v.CitySlug != "")
                    .Select(v => new { Category = v.Category.Slug, v.Category.GroupKey, v.CitySlug, v.Slug })
                    .ToListAsync(ct);
                foreach (var v in vendors) paths.UnionWith(IndexNowPaths.ForVendor(v.Category, v.GroupKey, v.CitySlug, v.Slug));
            }

            var contentIds = notes.Where(n => n.ContentId is not null).Select(n => n.ContentId!.Value).Distinct().ToList();
            if (contentIds.Count > 0)
            {
                // Published now, or once (an unpublished page should drop out of the index): never a draft.
                var pages = await db.ContentPages.AsNoTracking()
                    .Where(c => contentIds.Contains(c.Id) && c.PublishedAt != null)
                    .Select(c => new { c.Type, c.Slug })
                    .ToListAsync(ct);
                foreach (var c in pages) paths.UnionWith(IndexNowPaths.ForContent(c.Type, c.Slug));
            }
        }

        if (paths.Count == 0) return;
        var origin = _queue.Origin;
        var host = new Uri(origin).Host;
        var urls = paths.Select(p => origin + p).Take(MaxUrls).ToList();
        var endpoint = _config["IndexNow:Endpoint"] is { Length: > 0 } e ? e : "https://api.indexnow.org/indexnow";

        var client = _http.CreateClient(nameof(IndexNowWorker));
        using var response = await client.PostAsJsonAsync(endpoint, new
        {
            host,
            key = _queue.Key,
            keyLocation = $"{origin}/{_queue.Key}.txt",
            urlList = urls,
        }, ct);

        // 200 = received, 202 = received and the key is still being checked; anything else is a problem.
        if (response.IsSuccessStatusCode)
            _logger.LogInformation("IndexNow: sent {Count} addresses ({Status}).", urls.Count, (int)response.StatusCode);
        else
            _logger.LogWarning("IndexNow: {Status} for {Count} addresses: {Body}", (int)response.StatusCode, urls.Count,
                await response.Content.ReadAsStringAsync(ct));
    }
}
