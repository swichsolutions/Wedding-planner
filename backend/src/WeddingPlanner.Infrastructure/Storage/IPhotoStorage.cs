namespace WeddingPlanner.Infrastructure.Storage;

/// <summary>Result of storing a photo: the public URL and a provider id for later deletion.</summary>
public record StoredPhoto(string Url, string? StorageId);

/// <summary>
/// Abstraction over photo storage so the app code is identical whether photos live on
/// Cloudinary (production) or local disk (dev fallback). Swap the implementation in DI.
/// </summary>
public interface IPhotoStorage
{
    Task<StoredPhoto> UploadAsync(Stream content, string fileName, CancellationToken ct = default);
    Task DeleteAsync(string? storageId, CancellationToken ct = default);
}
