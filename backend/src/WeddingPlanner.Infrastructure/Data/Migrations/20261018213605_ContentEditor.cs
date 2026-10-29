using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace WeddingPlanner.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class ContentEditor : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ContentPages_Slug",
                table: "ContentPages");

            migrationBuilder.AlterColumn<string>(
                name: "TitleEn",
                table: "ContentPages",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(300)",
                oldMaxLength: 300);

            migrationBuilder.AlterColumn<string>(
                name: "Slug",
                table: "ContentPages",
                type: "character varying(120)",
                maxLength: 120,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(220)",
                oldMaxLength: 220);

            migrationBuilder.AlterColumn<string>(
                name: "BodyKa",
                table: "ContentPages",
                type: "character varying(100000)",
                maxLength: 100000,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "BodyEn",
                table: "ContentPages",
                type: "character varying(100000)",
                maxLength: 100000,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ActionLabelEn",
                table: "ContentPages",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ActionLabelKa",
                table: "ContentPages",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ActionPath",
                table: "ContentPages",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ConsentNote",
                table: "ContentPages",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExcerptEn",
                table: "ContentPages",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExcerptKa",
                table: "ContentPages",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "PublishedAt",
                table: "ContentPages",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Topic",
                table: "ContentPages",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ContentCredits",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ContentPageId = table.Column<int>(type: "integer", nullable: false),
                    VendorId = table.Column<int>(type: "integer", nullable: true),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    RoleKa = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    RoleEn = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ContentCredits", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ContentCredits_ContentPages_ContentPageId",
                        column: x => x.ContentPageId,
                        principalTable: "ContentPages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ContentCredits_Vendors_VendorId",
                        column: x => x.VendorId,
                        principalTable: "Vendors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "ContentPhotos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ContentPageId = table.Column<int>(type: "integer", nullable: false),
                    Url = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    StorageId = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    AltKa = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    AltEn = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ContentPhotos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ContentPhotos_ContentPages_ContentPageId",
                        column: x => x.ContentPageId,
                        principalTable: "ContentPages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ContentPages_Type_IsPublished_PublishedAt",
                table: "ContentPages",
                columns: new[] { "Type", "IsPublished", "PublishedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ContentPages_Type_Slug",
                table: "ContentPages",
                columns: new[] { "Type", "Slug" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ContentCredits_ContentPageId",
                table: "ContentCredits",
                column: "ContentPageId");

            migrationBuilder.CreateIndex(
                name: "IX_ContentCredits_VendorId",
                table: "ContentCredits",
                column: "VendorId");

            migrationBuilder.CreateIndex(
                name: "IX_ContentPhotos_ContentPageId_SortOrder",
                table: "ContentPhotos",
                columns: new[] { "ContentPageId", "SortOrder" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ContentCredits");

            migrationBuilder.DropTable(
                name: "ContentPhotos");

            migrationBuilder.DropIndex(
                name: "IX_ContentPages_Type_IsPublished_PublishedAt",
                table: "ContentPages");

            migrationBuilder.DropIndex(
                name: "IX_ContentPages_Type_Slug",
                table: "ContentPages");

            migrationBuilder.DropColumn(
                name: "ActionLabelEn",
                table: "ContentPages");

            migrationBuilder.DropColumn(
                name: "ActionLabelKa",
                table: "ContentPages");

            migrationBuilder.DropColumn(
                name: "ActionPath",
                table: "ContentPages");

            migrationBuilder.DropColumn(
                name: "ConsentNote",
                table: "ContentPages");

            migrationBuilder.DropColumn(
                name: "ExcerptEn",
                table: "ContentPages");

            migrationBuilder.DropColumn(
                name: "ExcerptKa",
                table: "ContentPages");

            migrationBuilder.DropColumn(
                name: "PublishedAt",
                table: "ContentPages");

            migrationBuilder.DropColumn(
                name: "Topic",
                table: "ContentPages");

            migrationBuilder.AlterColumn<string>(
                name: "TitleEn",
                table: "ContentPages",
                type: "character varying(300)",
                maxLength: 300,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "character varying(300)",
                oldMaxLength: 300,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Slug",
                table: "ContentPages",
                type: "character varying(220)",
                maxLength: 220,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(120)",
                oldMaxLength: 120);

            migrationBuilder.AlterColumn<string>(
                name: "BodyKa",
                table: "ContentPages",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(100000)",
                oldMaxLength: 100000,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "BodyEn",
                table: "ContentPages",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(100000)",
                oldMaxLength: 100000,
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ContentPages_Slug",
                table: "ContentPages",
                column: "Slug",
                unique: true);
        }
    }
}
