using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WeddingPlanner.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class ShortDashesInContent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Beka, 2026-11-19: short dashes everywhere. The site's own texts were changed in the
            // code; the pages kept in the database (/privacy, /terms, the articles) still had the
            // long dash (U+2014). This swaps it for the short one (U+2013) once. The admin editor
            // owns these texts, so nothing else in them is touched, and UpdatedAt stays as it was:
            // a dash is not a change worth telling search engines about.
            const string dash = "replace(\"{0}\", chr(8212), chr(8211))";
            string[] page = ["TitleKa", "TitleEn", "ExcerptKa", "ExcerptEn", "BodyKa", "BodyEn",
                "MetaDescriptionKa", "MetaDescriptionEn", "ActionLabelKa", "ActionLabelEn", "ConsentNote"];
            Swap(migrationBuilder, "ContentPages", page, dash);
            Swap(migrationBuilder, "ContentPhotos", ["AltKa", "AltEn"], dash);
        }

        private static void Swap(MigrationBuilder migrationBuilder, string table, string[] columns, string dash)
        {
            var set = string.Join(", ", columns.Select(c => $"\"{c}\" = {string.Format(dash, c)}"));
            var where = string.Join(" OR ", columns.Select(c => $"position(chr(8212) in \"{c}\") > 0"));
            migrationBuilder.Sql($"UPDATE \"{table}\" SET {set} WHERE {where};");
        }

        /// <summary>Nothing to undo: which dashes were long is not kept, and nobody wants them back.</summary>
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
