using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WeddingPlanner.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class Tasks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "DueDate",
                table: "ChecklistItems",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Link",
                table: "ChecklistItems",
                type: "character varying(60)",
                maxLength: 60,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Stage",
                table: "ChecklistItems",
                type: "character varying(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Who",
                table: "ChecklistItems",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            // B3: plans made before the starter list (P8) have the old ten default tasks. Give
            // those a stage and a link so they sit in the right place; the couple's own tasks stay
            // as they are (no stage).
            migrationBuilder.Sql(@"
                UPDATE ""ChecklistItems"" t SET ""Stage"" = m.stage, ""Link"" = m.link
                FROM (VALUES
                    ('დაადგინეთ ქორწილის თარიღი', 'm12', 'settings'),
                    ('განსაზღვრეთ ბიუჯეტი', 'm12', 'budget'),
                    ('შეადგინეთ სტუმრების სია', 'm12', 'guests'),
                    ('დაჯავშნეთ დარბაზი', 'm12', 'catalog:darbazi'),
                    ('აირჩიეთ ფოტოგრაფი და ვიდეოგრაფი', 'm10', 'catalog:fotografi'),
                    ('აირჩიეთ მუსიკა ან DJ', 'm10', 'catalog:musika'),
                    ('შეარჩიეთ დეკორი და ფლორისტი', 'm8', 'catalog:dekori'),
                    ('შეარჩიეთ კაბა და კოსტიუმი', 'm8', 'catalog:kaba'),
                    ('შეუკვეთეთ ტორტი', 'm4', 'catalog:torti'),
                    ('გააგზავნეთ მოწვევები', 'm2', 'invitation')
                ) AS m(title, stage, link)
                WHERE t.""Title"" = m.title AND t.""Stage"" IS NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DueDate",
                table: "ChecklistItems");

            migrationBuilder.DropColumn(
                name: "Link",
                table: "ChecklistItems");

            migrationBuilder.DropColumn(
                name: "Stage",
                table: "ChecklistItems");

            migrationBuilder.DropColumn(
                name: "Who",
                table: "ChecklistItems");
        }
    }
}
