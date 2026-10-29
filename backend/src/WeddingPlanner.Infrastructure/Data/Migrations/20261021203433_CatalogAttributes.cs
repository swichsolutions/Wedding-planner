using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace WeddingPlanner.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class CatalogAttributes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<List<string>>(
                name: "AlsoOffers",
                table: "Vendors",
                type: "text[]",
                nullable: false,
                defaultValueSql: "'{}'::text[]");

            migrationBuilder.AddColumn<string>(
                name: "BookingLeadTime",
                table: "Vendors",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CancellationTerms",
                table: "Vendors",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CapacityMax",
                table: "Vendors",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CapacityMin",
                table: "Vendors",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DepositTerms",
                table: "Vendors",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<List<string>>(
                name: "Features",
                table: "Vendors",
                type: "text[]",
                nullable: false,
                defaultValueSql: "'{}'::text[]");

            migrationBuilder.AddColumn<string>(
                name: "PriceUnit",
                table: "Vendors",
                type: "character varying(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Region",
                table: "Vendors",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<List<string>>(
                name: "ServedRegions",
                table: "Vendors",
                type: "text[]",
                nullable: false,
                defaultValueSql: "'{}'::text[]");

            migrationBuilder.AddColumn<string>(
                name: "Setting",
                table: "Vendors",
                type: "character varying(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<List<string>>(
                name: "Styles",
                table: "Vendors",
                type: "text[]",
                nullable: false,
                defaultValueSql: "'{}'::text[]");

            migrationBuilder.AddColumn<string>(
                name: "TravelPolicy",
                table: "Vendors",
                type: "character varying(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "VenueType",
                table: "Vendors",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GroupKey",
                table: "Categories",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "VendorPackages",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    VendorId = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Price = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: true),
                    PriceUnit = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    Included = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Duration = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VendorPackages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VendorPackages_Vendors_VendorId",
                        column: x => x.VendorId,
                        principalTable: "Vendors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Vendors_Region",
                table: "Vendors",
                column: "Region");

            migrationBuilder.CreateIndex(
                name: "IX_Categories_GroupKey",
                table: "Categories",
                column: "GroupKey");

            migrationBuilder.CreateIndex(
                name: "IX_VendorPackages_VendorId_SortOrder",
                table: "VendorPackages",
                columns: new[] { "VendorId", "SortOrder" });

            // Existing vendors get the region of their city, so the region filter finds them
            // from day one (PROPOSALS.md P4). Unknown cities stay empty for the vendor to set.
            migrationBuilder.Sql(@"
                UPDATE ""Vendors"" SET ""Region"" = CASE ""CitySlug""
                    WHEN 'tbilisi' THEN 'tbilisi'
                    WHEN 'batumi' THEN 'adjara'
                    WHEN 'kobuleti' THEN 'adjara'
                    WHEN 'kutaisi' THEN 'imereti'
                    WHEN 'rustavi' THEN 'kvemo-kartli'
                    WHEN 'telavi' THEN 'kakheti'
                    WHEN 'sighnaghi' THEN 'kakheti'
                    WHEN 'kvareli' THEN 'kakheti'
                    WHEN 'mtskheta' THEN 'mtskheta-mtianeti'
                    WHEN 'gori' THEN 'shida-kartli'
                    WHEN 'borjomi' THEN 'samtskhe-javakheti'
                    WHEN 'zugdidi' THEN 'samegrelo-zemo-svaneti'
                    WHEN 'ozurgeti' THEN 'guria'
                    WHEN 'ambrolauri' THEN 'racha-lechkhumi'
                END
                WHERE ""Region"" IS NULL;");

            // Prices entered before units existed were for the whole event; without this a
            // venue's 8000 ₾ would start reading "per guest" (the venue default for new prices).
            migrationBuilder.Sql(@"
                UPDATE ""Vendors"" SET ""PriceUnit"" = 'event'
                WHERE ""PriceUnit"" IS NULL AND ""PriceMin"" IS NOT NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "VendorPackages");

            migrationBuilder.DropIndex(
                name: "IX_Vendors_Region",
                table: "Vendors");

            migrationBuilder.DropIndex(
                name: "IX_Categories_GroupKey",
                table: "Categories");

            migrationBuilder.DropColumn(
                name: "AlsoOffers",
                table: "Vendors");

            migrationBuilder.DropColumn(
                name: "BookingLeadTime",
                table: "Vendors");

            migrationBuilder.DropColumn(
                name: "CancellationTerms",
                table: "Vendors");

            migrationBuilder.DropColumn(
                name: "CapacityMax",
                table: "Vendors");

            migrationBuilder.DropColumn(
                name: "CapacityMin",
                table: "Vendors");

            migrationBuilder.DropColumn(
                name: "DepositTerms",
                table: "Vendors");

            migrationBuilder.DropColumn(
                name: "Features",
                table: "Vendors");

            migrationBuilder.DropColumn(
                name: "PriceUnit",
                table: "Vendors");

            migrationBuilder.DropColumn(
                name: "Region",
                table: "Vendors");

            migrationBuilder.DropColumn(
                name: "ServedRegions",
                table: "Vendors");

            migrationBuilder.DropColumn(
                name: "Setting",
                table: "Vendors");

            migrationBuilder.DropColumn(
                name: "Styles",
                table: "Vendors");

            migrationBuilder.DropColumn(
                name: "TravelPolicy",
                table: "Vendors");

            migrationBuilder.DropColumn(
                name: "VenueType",
                table: "Vendors");

            migrationBuilder.DropColumn(
                name: "GroupKey",
                table: "Categories");
        }
    }
}
