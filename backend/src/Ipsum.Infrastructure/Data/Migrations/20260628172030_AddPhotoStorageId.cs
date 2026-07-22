using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ipsum.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPhotoStorageId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "StorageId",
                table: "VendorPhotos",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "StorageId",
                table: "VendorPhotos");
        }
    }
}
