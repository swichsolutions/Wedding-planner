using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace WeddingPlanner.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class Invitation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Accommodation",
                table: "WeddingSites",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CeremonyAddress",
                table: "WeddingSites",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CeremonyMapUrl",
                table: "WeddingSites",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CeremonyName",
                table: "WeddingSites",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CeremonyTime",
                table: "WeddingSites",
                type: "character varying(5)",
                maxLength: 5,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DressCode",
                table: "WeddingSites",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FontKey",
                table: "WeddingSites",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReceptionAddress",
                table: "WeddingSites",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReceptionMapUrl",
                table: "WeddingSites",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReceptionName",
                table: "WeddingSites",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReceptionTime",
                table: "WeddingSites",
                type: "character varying(5)",
                maxLength: 5,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "RsvpAskDiet",
                table: "WeddingSites",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "RsvpAskMessage",
                table: "WeddingSites",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "RsvpDeadline",
                table: "WeddingSites",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "RsvpEnabled",
                table: "WeddingSites",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "RsvpQuestion",
                table: "WeddingSites",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "StartTime",
                table: "WeddingSites",
                type: "character varying(5)",
                maxLength: 5,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Transport",
                table: "WeddingSites",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "InviteCode",
                table: "Guests",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RsvpAnswer",
                table: "Guests",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "RsvpAt",
                table: "Guests",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RsvpMessage",
                table: "Guests",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "InviteCode",
                table: "GuestFamilies",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RsvpAnswer",
                table: "GuestFamilies",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "RsvpAt",
                table: "GuestFamilies",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RsvpMessage",
                table: "GuestFamilies",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "WeddingSitePhotos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    WeddingSiteId = table.Column<int>(type: "integer", nullable: false),
                    Url = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    StorageId = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WeddingSitePhotos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WeddingSitePhotos_WeddingSites_WeddingSiteId",
                        column: x => x.WeddingSiteId,
                        principalTable: "WeddingSites",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "WeddingSiteScheduleItems",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    WeddingSiteId = table.Column<int>(type: "integer", nullable: false),
                    Time = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: true),
                    Text = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WeddingSiteScheduleItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WeddingSiteScheduleItems_WeddingSites_WeddingSiteId",
                        column: x => x.WeddingSiteId,
                        principalTable: "WeddingSites",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Guests_InviteCode",
                table: "Guests",
                column: "InviteCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GuestFamilies_InviteCode",
                table: "GuestFamilies",
                column: "InviteCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_WeddingSitePhotos_WeddingSiteId_SortOrder",
                table: "WeddingSitePhotos",
                columns: new[] { "WeddingSiteId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_WeddingSiteScheduleItems_WeddingSiteId_SortOrder",
                table: "WeddingSiteScheduleItems",
                columns: new[] { "WeddingSiteId", "SortOrder" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "WeddingSitePhotos");

            migrationBuilder.DropTable(
                name: "WeddingSiteScheduleItems");

            migrationBuilder.DropIndex(
                name: "IX_Guests_InviteCode",
                table: "Guests");

            migrationBuilder.DropIndex(
                name: "IX_GuestFamilies_InviteCode",
                table: "GuestFamilies");

            migrationBuilder.DropColumn(
                name: "Accommodation",
                table: "WeddingSites");

            migrationBuilder.DropColumn(
                name: "CeremonyAddress",
                table: "WeddingSites");

            migrationBuilder.DropColumn(
                name: "CeremonyMapUrl",
                table: "WeddingSites");

            migrationBuilder.DropColumn(
                name: "CeremonyName",
                table: "WeddingSites");

            migrationBuilder.DropColumn(
                name: "CeremonyTime",
                table: "WeddingSites");

            migrationBuilder.DropColumn(
                name: "DressCode",
                table: "WeddingSites");

            migrationBuilder.DropColumn(
                name: "FontKey",
                table: "WeddingSites");

            migrationBuilder.DropColumn(
                name: "ReceptionAddress",
                table: "WeddingSites");

            migrationBuilder.DropColumn(
                name: "ReceptionMapUrl",
                table: "WeddingSites");

            migrationBuilder.DropColumn(
                name: "ReceptionName",
                table: "WeddingSites");

            migrationBuilder.DropColumn(
                name: "ReceptionTime",
                table: "WeddingSites");

            migrationBuilder.DropColumn(
                name: "RsvpAskDiet",
                table: "WeddingSites");

            migrationBuilder.DropColumn(
                name: "RsvpAskMessage",
                table: "WeddingSites");

            migrationBuilder.DropColumn(
                name: "RsvpDeadline",
                table: "WeddingSites");

            migrationBuilder.DropColumn(
                name: "RsvpEnabled",
                table: "WeddingSites");

            migrationBuilder.DropColumn(
                name: "RsvpQuestion",
                table: "WeddingSites");

            migrationBuilder.DropColumn(
                name: "StartTime",
                table: "WeddingSites");

            migrationBuilder.DropColumn(
                name: "Transport",
                table: "WeddingSites");

            migrationBuilder.DropColumn(
                name: "InviteCode",
                table: "Guests");

            migrationBuilder.DropColumn(
                name: "RsvpAnswer",
                table: "Guests");

            migrationBuilder.DropColumn(
                name: "RsvpAt",
                table: "Guests");

            migrationBuilder.DropColumn(
                name: "RsvpMessage",
                table: "Guests");

            migrationBuilder.DropColumn(
                name: "InviteCode",
                table: "GuestFamilies");

            migrationBuilder.DropColumn(
                name: "RsvpAnswer",
                table: "GuestFamilies");

            migrationBuilder.DropColumn(
                name: "RsvpAt",
                table: "GuestFamilies");

            migrationBuilder.DropColumn(
                name: "RsvpMessage",
                table: "GuestFamilies");
        }
    }
}
