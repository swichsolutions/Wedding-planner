using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WeddingPlanner.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class SeededFlags : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "BudgetSeeded",
                table: "Couples",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "TasksSeeded",
                table: "Couples",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            // Plans that already have tasks or budget lines were given their starter lists
            // before these columns existed: mark them, so nothing is added to them again.
            migrationBuilder.Sql("""
                UPDATE "Couples" c SET "TasksSeeded" = TRUE
                WHERE EXISTS (SELECT 1 FROM "ChecklistItems" i WHERE i."CoupleId" = c."Id");
                """);
            migrationBuilder.Sql("""
                UPDATE "Couples" c SET "BudgetSeeded" = TRUE
                WHERE EXISTS (SELECT 1 FROM "BudgetItems" i WHERE i."CoupleId" = c."Id");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BudgetSeeded",
                table: "Couples");

            migrationBuilder.DropColumn(
                name: "TasksSeeded",
                table: "Couples");
        }
    }
}
