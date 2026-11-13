namespace WeddingPlanner.Api.Dtos;

/// <summary>An admin-added profile nobody owns yet, offered on the vendor registration form (A3 takeover).</summary>
public record ClaimableVendorDto(int Id, string Name, string CategorySlug, string City, bool IsApproved);

/// <summary>The profile a one-time code is for, shown on the code's page before the vendor signs up.</summary>
public record ClaimCodeInfoDto(string Name, string CategorySlug, string City);

/// <summary>A new one-time code for the admin to send: shown once, only its hash is kept.</summary>
public record ClaimCodeCreatedDto(string Code, DateTimeOffset ExpiresAt);

/// <summary>A takeover request as the admin sees it.</summary>
public record VendorClaimDto(
    int Id, int VendorId, string VendorName, string CategorySlug, string City,
    string UserEmail, bool EmailMatches, string Status, DateTimeOffset CreatedAt, DateTimeOffset? DecidedAt);

/// <summary>The signed-in vendor's own takeover request.</summary>
public record MyVendorClaimDto(int VendorId, string VendorName, string CategorySlug, string City, string Status, DateTimeOffset CreatedAt);
