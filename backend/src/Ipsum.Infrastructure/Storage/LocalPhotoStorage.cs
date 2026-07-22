namespace Ipsum.Infrastructure.Storage;

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

    public async Task<StoredPhoto> UploadAsync(Stream content, string fileName, CancellationToken ct = default)
    {
        var ext = Path.GetExtension(fileName);
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
