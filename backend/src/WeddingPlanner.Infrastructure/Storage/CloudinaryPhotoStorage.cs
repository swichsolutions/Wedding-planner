using CloudinaryDotNet;
using CloudinaryDotNet.Actions;

namespace WeddingPlanner.Infrastructure.Storage;

/// <summary>Cloudinary-backed photo storage (production). Returns the secure CDN URL + public id.</summary>
public class CloudinaryPhotoStorage : IPhotoStorage
{
    private readonly Cloudinary _cloudinary;
    private readonly string _folder;

    public CloudinaryPhotoStorage(string cloudName, string apiKey, string apiSecret, string folder = "weddingplanner/vendors")
    {
        _cloudinary = new Cloudinary(new Account(cloudName, apiKey, apiSecret)) { Api = { Secure = true } };
        _folder = folder;
    }

    public async Task<StoredPhoto> UploadAsync(Stream content, string fileName, CancellationToken ct = default)
    {
        var uploadParams = new ImageUploadParams
        {
            File = new FileDescription(fileName, content),
            Folder = _folder,
            // Deliver optimized: auto format (WebP/AVIF) + auto quality.
            Transformation = new Transformation().Quality("auto").FetchFormat("auto"),
        };

        var result = await _cloudinary.UploadAsync(uploadParams);
        if (result.Error is not null)
            throw new InvalidOperationException($"Cloudinary upload failed: {result.Error.Message}");

        return new StoredPhoto(result.SecureUrl.ToString(), result.PublicId);
    }

    public async Task DeleteAsync(string? storageId, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(storageId)) return;
        await _cloudinary.DestroyAsync(new DeletionParams(storageId));
    }
}
