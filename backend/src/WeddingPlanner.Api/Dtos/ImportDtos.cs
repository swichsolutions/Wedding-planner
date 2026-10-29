using WeddingPlanner.Api.Import;

namespace WeddingPlanner.Api.Dtos;

/// <summary>One spreadsheet row and what the import does (or did) with it.</summary>
public record VendorImportRowDto(
    int Row,
    string? SheetId,
    string? Name,
    string? CategorySlug,
    string? City,
    /// <summary>create, update, skip or error.</summary>
    string Action,
    int? VendorId,
    string? ProfilePath,
    int Packages,
    string? Photos,
    IReadOnlyList<ImportIssue> Errors,
    IReadOnlyList<ImportIssue> Warnings);

public record VendorImportReportDto(
    bool Applied,
    int Created,
    int Updated,
    int Skipped,
    int Failed,
    IReadOnlyList<VendorImportRowDto> Rows,
    IReadOnlyList<ImportIssue> FileErrors,
    IReadOnlyList<ImportIssue> FileWarnings);
