using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace WeddingPlanner.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class GuestsAndSeating : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "Rotation",
                table: "SeatingTables",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<string>(
                name: "Label",
                table: "SeatingObjects",
                type: "character varying(60)",
                maxLength: 60,
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "Rotation",
                table: "SeatingObjects",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<string>(
                name: "Attendance",
                table: "Guests",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "pending");

            migrationBuilder.AddColumn<string>(
                name: "DietaryNeeds",
                table: "Guests",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "FamilyId",
                table: "Guests",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FloorPlanStorageId",
                table: "Couples",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FloorPlanUrl",
                table: "Couples",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "GuestFamilies",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CoupleId = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GuestFamilies", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GuestFamilies_Couples_CoupleId",
                        column: x => x.CoupleId,
                        principalTable: "Couples",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Guests_FamilyId",
                table: "Guests",
                column: "FamilyId");

            migrationBuilder.CreateIndex(
                name: "IX_GuestFamilies_CoupleId",
                table: "GuestFamilies",
                column: "CoupleId");

            migrationBuilder.AddForeignKey(
                name: "FK_Guests_GuestFamilies_FamilyId",
                table: "Guests",
                column: "FamilyId",
                principalTable: "GuestFamilies",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Guests_GuestFamilies_FamilyId",
                table: "Guests");

            migrationBuilder.DropTable(
                name: "GuestFamilies");

            migrationBuilder.DropIndex(
                name: "IX_Guests_FamilyId",
                table: "Guests");

            migrationBuilder.DropColumn(
                name: "Rotation",
                table: "SeatingTables");

            migrationBuilder.DropColumn(
                name: "Label",
                table: "SeatingObjects");

            migrationBuilder.DropColumn(
                name: "Rotation",
                table: "SeatingObjects");

            migrationBuilder.DropColumn(
                name: "Attendance",
                table: "Guests");

            migrationBuilder.DropColumn(
                name: "DietaryNeeds",
                table: "Guests");

            migrationBuilder.DropColumn(
                name: "FamilyId",
                table: "Guests");

            migrationBuilder.DropColumn(
                name: "FloorPlanStorageId",
                table: "Couples");

            migrationBuilder.DropColumn(
                name: "FloorPlanUrl",
                table: "Couples");
        }
    }
}
