using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WeddingPlanner.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class BlogSecondEdition : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Beka rewrote the six first blog articles (his Word file of 2026-11-24: fuller texts,
            // addressed to the couple). The seeder only fills an empty blog, so a database that
            // already has the first edition gets the new texts here, once. On the day this was
            // written the live articles were still exactly the seeded ones (compared paragraph by
            // paragraph), so no edit made in the admin panel is lost. Photos, address, topic and
            // publishing date stay; an article the admin has deleted is not brought back.
            foreach (var a in BlogArticlesSeeder.Texts)
            {
                migrationBuilder.Sql(
                    "UPDATE \"ContentPages\" SET " +
                    $"\"TitleKa\" = {Text(a.Title)}, \"ExcerptKa\" = {Text(a.Excerpt)}, " +
                    $"\"MetaDescriptionKa\" = {Text(a.Meta)}, \"ActionLabelKa\" = {Text(a.ActionLabel)}, " +
                    $"\"BodyKa\" = {Text(a.Body)}, \"UpdatedAt\" = TIMESTAMPTZ '2026-11-24 12:00:00+00' " +
                    $"WHERE \"Type\" = 0 AND \"Slug\" = {Text(a.Slug)};");
            }
        }

        /// <summary>A text as a PostgreSQL string literal (standard_conforming_strings: only the quote is doubled).</summary>
        private static string Text(string value) => "'" + value.Replace("'", "''") + "'";

        /// <summary>The first edition is not kept anywhere to go back to.</summary>
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
