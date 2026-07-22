using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Ipsum.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddWeddingSites : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "WeddingSites",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    Slug = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    TemplateKey = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    FirstName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    LastName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    PartnerFirstName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    PartnerLastName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    WeddingDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Place = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Message = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    PhotoUrl = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    PhotoStorageId = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    IsPublished = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WeddingSites", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_WeddingSites_Slug",
                table: "WeddingSites",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_WeddingSites_UserId",
                table: "WeddingSites",
                column: "UserId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "WeddingSites");
        }
    }
}
