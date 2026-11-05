namespace WeddingPlanner.Api.Dtos;

/// <summary>An imported profile nobody owns yet, offered on the vendor registration form (A3 takeover).</summary>
public record ClaimableVendorDto(int Id, string Name, string CategorySlug, string City, bool IsApproved);

/// <summary>A takeover request as the admin sees it.</summary>
public record VendorClaimDto(
    int Id, int VendorId, string VendorName, string CategorySlug, string City,
    string UserEmail, bool EmailMatches, string Status, DateTimeOffset CreatedAt, DateTimeOffset? DecidedAt);

/// <summary>The signed-in vendor's own takeover request.</summary>
public record MyVendorClaimDto(int VendorId, string VendorName, string CategorySlug, string City, string Status, DateTimeOffset CreatedAt);
