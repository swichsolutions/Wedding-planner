using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WeddingPlanner.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCoupleOnboarding : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Couples_Email",
                table: "Couples");

            migrationBuilder.DropColumn(
                name: "GuestCount",
                table: "Couples");

            migrationBuilder.DropColumn(
                name: "Name",
                table: "Couples");

            migrationBuilder.AddColumn<string>(
                name: "FirstName",
                table: "Couples",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GuestCountRange",
                table: "Couples",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LastName",
                table: "Couples",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<List<string>>(
                name: "NeededCategories",
                table: "Couples",
                type: "text[]",
                nullable: false);

            migrationBuilder.AddColumn<string>(
                name: "PartnerFirstName",
                table: "Couples",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PartnerLastName",
                table: "Couples",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PlanningStage",
                table: "Couples",
                type: "character varying(60)",
                maxLength: 60,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UserId",
                table: "Couples",
                type: "character varying(450)",
                maxLength: 450,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_Couples_UserId",
                table: "Couples",
                column: "UserId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Couples_UserId",
                table: "Couples");

            migrationBuilder.DropColumn(
                name: "FirstName",
                table: "Couples");

            migrationBuilder.DropColumn(
                name: "GuestCountRange",
                table: "Couples");

            migrationBuilder.DropColumn(
                name: "LastName",
                table: "Couples");

            migrationBuilder.DropColumn(
                name: "NeededCategories",
                table: "Couples");

            migrationBuilder.DropColumn(
                name: "PartnerFirstName",
                table: "Couples");

            migrationBuilder.DropColumn(
                name: "PartnerLastName",
                table: "Couples");

            migrationBuilder.DropColumn(
                name: "PlanningStage",
                table: "Couples");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "Couples");

            migrationBuilder.AddColumn<int>(
                name: "GuestCount",
                table: "Couples",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Name",
                table: "Couples",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Couples_Email",
                table: "Couples",
                column: "Email",
                unique: true);
        }
    }
}
