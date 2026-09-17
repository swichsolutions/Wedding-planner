namespace WeddingPlanner.Infrastructure.Storage;

/// <summary>
/// Detects the real image format from file content. Client-supplied Content-Type and
/// filename extension are attacker-controlled — a file only counts as an image if its
/// magic bytes say so, and the extension we store is derived from the detected format.
/// </summary>
public static class ImageSniffer
{
    /// <summary>Bytes needed to identify all supported formats.</summary>
    public const int HeaderLength = 12;

    /// <summary>
    /// Returns the canonical extension (".jpg", ".png", ".webp") when the header bytes
    /// are a real JPEG/PNG/WebP image, otherwise null.
    /// </summary>
    public static string? DetectExtension(ReadOnlySpan<byte> header)
    {
        if (header.Length >= 3 &&
            header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF)
            return ".jpg";

        if (header.Length >= 8 &&
            header[0] == 0x89 && header[1] == 0x50 && header[2] == 0x4E && header[3] == 0x47 &&
            header[4] == 0x0D && header[5] == 0x0A && header[6] == 0x1A && header[7] == 0x0A)
            return ".png";

        if (header.Length >= 12 &&
            header[0] == (byte)'R' && header[1] == (byte)'I' && header[2] == (byte)'F' && header[3] == (byte)'F' &&
            header[8] == (byte)'W' && header[9] == (byte)'E' && header[10] == (byte)'B' && header[11] == (byte)'P')
            return ".webp";

        return null;
    }

    /// <summary>Reads the header from a fresh stream and detects the extension.</summary>
    public static async Task<string?> DetectExtensionAsync(Stream content, CancellationToken ct = default)
    {
        var header = new byte[HeaderLength];
        var read = 0;
        while (read < HeaderLength)
        {
            var n = await content.ReadAsync(header.AsMemory(read, HeaderLength - read), ct);
            if (n == 0) break;
            read += n;
        }
        return DetectExtension(header.AsSpan(0, read));
    }
}
