using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace WeddingPlanner.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class Overview : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PaletteKey",
                table: "Couples",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "PlanPhotos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CoupleId = table.Column<int>(type: "integer", nullable: false),
                    Kind = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Url = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    VendorPhotoId = table.Column<int>(type: "integer", nullable: true),
                    ContentPhotoId = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlanPhotos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PlanPhotos_ContentPhotos_ContentPhotoId",
                        column: x => x.ContentPhotoId,
                        principalTable: "ContentPhotos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PlanPhotos_Couples_CoupleId",
                        column: x => x.CoupleId,
                        principalTable: "Couples",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PlanPhotos_VendorPhotos_VendorPhotoId",
                        column: x => x.VendorPhotoId,
                        principalTable: "VendorPhotos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PlanPhotos_ContentPhotoId",
                table: "PlanPhotos",
                column: "ContentPhotoId");

            migrationBuilder.CreateIndex(
                name: "IX_PlanPhotos_CoupleId_ContentPhotoId",
                table: "PlanPhotos",
                columns: new[] { "CoupleId", "ContentPhotoId" },
                unique: true,
                filter: "\"ContentPhotoId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_PlanPhotos_CoupleId_VendorPhotoId",
                table: "PlanPhotos",
                columns: new[] { "CoupleId", "VendorPhotoId" },
                unique: true,
                filter: "\"VendorPhotoId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_PlanPhotos_VendorPhotoId",
                table: "PlanPhotos",
                column: "VendorPhotoId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PlanPhotos");

            migrationBuilder.DropColumn(
                name: "PaletteKey",
                table: "Couples");
        }
    }
}
