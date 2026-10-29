using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace WeddingPlanner.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class ServicesAndPayments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "BudgetPayments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    BudgetItemId = table.Column<int>(type: "integer", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    PaidOn = table.Column<DateOnly>(type: "date", nullable: false),
                    Note = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BudgetPayments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BudgetPayments_BudgetItems_BudgetItemId",
                        column: x => x.BudgetItemId,
                        principalTable: "BudgetItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PlanServices",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CoupleId = table.Column<int>(type: "integer", nullable: false),
                    VendorId = table.Column<int>(type: "integer", nullable: true),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    CategorySlug = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Status = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Phone = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Email = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    Instagram = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Offer = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: true),
                    OfferNote = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Note = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlanServices", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PlanServices_Couples_CoupleId",
                        column: x => x.CoupleId,
                        principalTable: "Couples",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PlanServices_Vendors_VendorId",
                        column: x => x.VendorId,
                        principalTable: "Vendors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BudgetPayments_BudgetItemId",
                table: "BudgetPayments",
                column: "BudgetItemId");

            migrationBuilder.CreateIndex(
                name: "IX_PlanServices_CoupleId_VendorId",
                table: "PlanServices",
                columns: new[] { "CoupleId", "VendorId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PlanServices_VendorId",
                table: "PlanServices",
                column: "VendorId");

            // Saved vendors become services with status "saved" (name and category snapshot).
            migrationBuilder.Sql(@"
                INSERT INTO ""PlanServices"" (""CoupleId"", ""VendorId"", ""Name"", ""CategorySlug"", ""Status"", ""CreatedAt"")
                SELECT s.""CoupleId"", s.""VendorId"", LEFT(v.""Name"", 200), c.""Slug"", 'saved', s.""CreatedAt""
                FROM ""SavedVendors"" s
                JOIN ""Vendors"" v ON v.""Id"" = s.""VendorId""
                JOIN ""Categories"" c ON c.""Id"" = v.""CategoryId"";");

            // What was typed as paid becomes one payment. Its real date is unknown, so the line's.
            migrationBuilder.Sql(@"
                INSERT INTO ""BudgetPayments"" (""BudgetItemId"", ""Amount"", ""PaidOn"", ""CreatedAt"")
                SELECT ""Id"", ""Paid"", CAST(""CreatedAt"" AS date), now()
                FROM ""BudgetItems""
                WHERE ""Paid"" > 0;");

            migrationBuilder.DropTable(
                name: "SavedVendors");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // BudgetItems.Paid still holds each line's sum, so dropping the payments loses only their
            // dates. Services added by hand have nowhere to go back to and are lost.
            migrationBuilder.CreateTable(
                name: "SavedVendors",
                columns: table => new
                {
                    CoupleId = table.Column<int>(type: "integer", nullable: false),
                    VendorId = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SavedVendors", x => new { x.CoupleId, x.VendorId });
                    table.ForeignKey(
                        name: "FK_SavedVendors_Couples_CoupleId",
                        column: x => x.CoupleId,
                        principalTable: "Couples",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SavedVendors_Vendors_VendorId",
                        column: x => x.VendorId,
                        principalTable: "Vendors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SavedVendors_VendorId",
                table: "SavedVendors",
                column: "VendorId");

            migrationBuilder.Sql(@"
                INSERT INTO ""SavedVendors"" (""CoupleId"", ""VendorId"", ""CreatedAt"")
                SELECT ""CoupleId"", ""VendorId"", ""CreatedAt""
                FROM ""PlanServices""
                WHERE ""VendorId"" IS NOT NULL;");

            migrationBuilder.DropTable(
                name: "BudgetPayments");

            migrationBuilder.DropTable(
                name: "PlanServices");
        }
    }
}
