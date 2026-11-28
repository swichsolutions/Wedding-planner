using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WeddingPlanner.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class VendorWordInLegalTexts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Beka, 2026-11-28: Georgians rarely say „მომწოდებელი" for a wedding business, so the word
            // left the site (the interface says „მომსახურებები" to couples and „ბიზნესი" to the
            // businesses). /terms and /privacy are kept in the database and still had it: here it
            // becomes „ბიზნესი". By stem, not by listed word forms, so that a form an admin may have
            // typed since (…ებმა, …ებზე, …ად) changes too: the plural stem first, then the two singular
            // stems (the word drops its „ე" before most endings). Georgian columns of the legal pages
            // only; the English texts keep "vendor". Nothing else in the texts is touched.
            (string Old, string New)[] forms =
            [
                ("მომწოდებლებ", "ბიზნესებ"),
                ("მომწოდებლ", "ბიზნეს"),
                ("მომწოდებელ", "ბიზნეს"),
            ];
            foreach (var column in new[] { "BodyKa", "ExcerptKa", "MetaDescriptionKa" })
            {
                var value = $"\"{column}\"";
                foreach (var (old, @new) in forms) value = $"replace({value}, '{old}', '{@new}')";
                migrationBuilder.Sql(
                    $"UPDATE \"ContentPages\" SET \"{column}\" = {value}, \"UpdatedAt\" = TIMESTAMPTZ '2026-11-28 12:00:00+00' " +
                    $"WHERE \"Type\" = 3 AND position('მომწოდებ' in \"{column}\") > 0;");
            }
        }

        /// <summary>Not undone: the old word is the one we stopped using.</summary>
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
