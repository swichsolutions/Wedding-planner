using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WeddingPlanner.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSavedVendorUser : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SavedVendors_Couples_CoupleId",
                table: "SavedVendors");

            migrationBuilder.DropPrimaryKey(
                name: "PK_SavedVendors",
                table: "SavedVendors");

            migrationBuilder.DropColumn(
                name: "CoupleId",
                table: "SavedVendors");

            migrationBuilder.AddColumn<string>(
                name: "UserId",
                table: "SavedVendors",
                type: "character varying(450)",
                maxLength: 450,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddPrimaryKey(
                name: "PK_SavedVendors",
                table: "SavedVendors",
                columns: new[] { "UserId", "VendorId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropPrimaryKey(
                name: "PK_SavedVendors",
                table: "SavedVendors");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "SavedVendors");

            migrationBuilder.AddColumn<int>(
                name: "CoupleId",
                table: "SavedVendors",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddPrimaryKey(
                name: "PK_SavedVendors",
                table: "SavedVendors",
                columns: new[] { "CoupleId", "VendorId" });

            migrationBuilder.AddForeignKey(
                name: "FK_SavedVendors_Couples_CoupleId",
                table: "SavedVendors",
                column: "CoupleId",
                principalTable: "Couples",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
