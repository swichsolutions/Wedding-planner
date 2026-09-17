namespace WeddingPlanner.Infrastructure.Storage;

/// <summary>
/// Local-disk photo storage (dev fallback when Cloudinary isn't configured). Files are
/// written to a folder served statically by the API; the stored URL is absolute so the
/// SPA on another origin can load it.
/// </summary>
public class LocalPhotoStorage : IPhotoStorage
{
    private readonly string _root;        // physical folder
    private readonly string _publicBase;  // absolute URL base, e.g. http://localhost:5119/uploads

    public LocalPhotoStorage(string root, string publicBase)
    {
        _root = root;
        _publicBase = publicBase.TrimEnd('/');
        Directory.CreateDirectory(_root);
    }

    private static readonly string[] AllowedExtensions = { ".jpg", ".jpeg", ".png", ".webp" };

    public async Task<StoredPhoto> UploadAsync(Stream content, string fileName, CancellationToken ct = default)
    {
        // Defense-in-depth behind the controllers' magic-byte check: this folder is
        // served statically, so nothing the static middleware would serve as
        // non-image (e.g. .html, .svg) may ever land in it.
        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        if (!AllowedExtensions.Contains(ext))
            throw new ArgumentException($"Disallowed upload extension '{ext}'.", nameof(fileName));

        var name = $"{Guid.NewGuid():N}{ext}";
        var path = Path.Combine(_root, name);
        await using (var fs = File.Create(path))
        {
            await content.CopyToAsync(fs, ct);
        }
        return new StoredPhoto($"{_publicBase}/{name}", name);
    }

    public Task DeleteAsync(string? storageId, CancellationToken ct = default)
    {
        if (!string.IsNullOrEmpty(storageId))
        {
            var path = Path.Combine(_root, storageId);
            if (File.Exists(path)) File.Delete(path);
        }
        return Task.CompletedTask;
    }
}
