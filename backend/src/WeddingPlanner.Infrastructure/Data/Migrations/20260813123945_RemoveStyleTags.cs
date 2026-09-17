using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace WeddingPlanner.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class RemoveStyleTags : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "VendorStyleTags");

            migrationBuilder.DropTable(
                name: "StyleTags");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "StyleTags",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    NameEn = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    NameKa = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Slug = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StyleTags", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "VendorStyleTags",
                columns: table => new
                {
                    VendorId = table.Column<int>(type: "integer", nullable: false),
                    StyleTagId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VendorStyleTags", x => new { x.VendorId, x.StyleTagId });
                    table.ForeignKey(
                        name: "FK_VendorStyleTags_StyleTags_StyleTagId",
                        column: x => x.StyleTagId,
                        principalTable: "StyleTags",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_VendorStyleTags_Vendors_VendorId",
                        column: x => x.VendorId,
                        principalTable: "Vendors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_StyleTags_Slug",
                table: "StyleTags",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_VendorStyleTags_StyleTagId",
                table: "VendorStyleTags",
                column: "StyleTagId");
        }
    }
}
