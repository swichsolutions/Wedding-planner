using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ipsum.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPhotoFocus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 50/50 = centered — matches how photos rendered before focal points existed.
            migrationBuilder.AddColumn<int>(
                name: "PhotoFocusX",
                table: "WeddingSites",
                type: "integer",
                nullable: false,
                defaultValue: 50);

            migrationBuilder.AddColumn<int>(
                name: "PhotoFocusY",
                table: "WeddingSites",
                type: "integer",
                nullable: false,
                defaultValue: 50);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PhotoFocusX",
                table: "WeddingSites");

            migrationBuilder.DropColumn(
                name: "PhotoFocusY",
                table: "WeddingSites");
        }
    }
}
