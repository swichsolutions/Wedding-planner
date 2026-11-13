using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WeddingPlanner.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class VendorClaimCodes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ClaimCodeExpiresAt",
                table: "Vendors",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ClaimCodeHash",
                table: "Vendors",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Vendors_ClaimCodeHash",
                table: "Vendors",
                column: "ClaimCodeHash",
                unique: true,
                filter: "\"ClaimCodeHash\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Vendors_ClaimCodeHash",
                table: "Vendors");

            migrationBuilder.DropColumn(
                name: "ClaimCodeExpiresAt",
                table: "Vendors");

            migrationBuilder.DropColumn(
                name: "ClaimCodeHash",
                table: "Vendors");
        }
    }
}
