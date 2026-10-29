using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace WeddingPlanner.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class SharedPlan : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // B1 (decision D8): organizer data moves from the user onto a shared plan (the Couples row).

            // Order matters: new tables, then members for every existing plan, then fill CoupleId from

            // UserId, and only then drop the user columns.

            migrationBuilder.CreateTable(
                name: "CoupleInvites",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CoupleId = table.Column<int>(type: "integer", nullable: false),
                    TokenHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Email = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    CreatedByUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    AcceptedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    AcceptedByUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CoupleInvites", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CoupleInvites_Couples_CoupleId",
                        column: x => x.CoupleId,
                        principalTable: "Couples",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CoupleMembers",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    CoupleId = table.Column<int>(type: "integer", nullable: false),
                    IsPartner = table.Column<bool>(type: "boolean", nullable: false),
                    JoinedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CoupleMembers", x => x.UserId);
                    table.ForeignKey(
                        name: "FK_CoupleMembers_Couples_CoupleId",
                        column: x => x.CoupleId,
                        principalTable: "Couples",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            // A plan for anyone with organizer data but no profile row (accounts from before onboarding).
            migrationBuilder.Sql(@"
                INSERT INTO ""Couples"" (""UserId"", ""Email"", ""NeededCategories"", ""CreatedAt"")
                SELECT x.u, COALESCE(usr.""Email"", ''), '{}', now()
                FROM (SELECT ""UserId"" AS u FROM ""ChecklistItems"" UNION SELECT ""UserId"" AS u FROM ""BudgetItems"" UNION SELECT ""UserId"" AS u FROM ""CategoryBudgets"" UNION SELECT ""UserId"" AS u FROM ""Guests"" UNION SELECT ""UserId"" AS u FROM ""SeatingTables"" UNION SELECT ""UserId"" AS u FROM ""SeatAssignments"" UNION SELECT ""UserId"" AS u FROM ""SeatingObjects"" UNION SELECT ""UserId"" AS u FROM ""WeddingSites"" UNION SELECT ""UserId"" AS u FROM ""SavedVendors"") x
                LEFT JOIN ""AspNetUsers"" usr ON usr.""Id"" = x.u
                WHERE NOT EXISTS (SELECT 1 FROM ""Couples"" c WHERE c.""UserId"" = x.u);");

            // Each existing plan's owner becomes its first member.
            migrationBuilder.Sql(@"
                INSERT INTO ""CoupleMembers"" (""UserId"", ""CoupleId"", ""IsPartner"", ""JoinedAt"")
                SELECT ""UserId"", ""Id"", false, ""CreatedAt"" FROM ""Couples"";");

            migrationBuilder.AddColumn<int>(
                name: "CoupleId",
                table: "WeddingSites",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "CoupleId",
                table: "SeatingTables",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "CoupleId",
                table: "SeatingObjects",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "CoupleId",
                table: "SeatAssignments",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "CoupleId",
                table: "SavedVendors",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "CoupleId",
                table: "Guests",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "CoupleId",
                table: "ChecklistItems",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "CoupleId",
                table: "CategoryBudgets",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "CoupleId",
                table: "BudgetItems",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            // Point every organizer row at its owner's plan (none should be left without one).
            migrationBuilder.Sql(@"
                UPDATE ""ChecklistItems"" t SET ""CoupleId"" = m.""CoupleId"" FROM ""CoupleMembers"" m WHERE m.""UserId"" = t.""UserId"";
                DELETE FROM ""ChecklistItems"" WHERE ""CoupleId"" = 0;");
            migrationBuilder.Sql(@"
                UPDATE ""BudgetItems"" t SET ""CoupleId"" = m.""CoupleId"" FROM ""CoupleMembers"" m WHERE m.""UserId"" = t.""UserId"";
                DELETE FROM ""BudgetItems"" WHERE ""CoupleId"" = 0;");
            migrationBuilder.Sql(@"
                UPDATE ""CategoryBudgets"" t SET ""CoupleId"" = m.""CoupleId"" FROM ""CoupleMembers"" m WHERE m.""UserId"" = t.""UserId"";
                DELETE FROM ""CategoryBudgets"" WHERE ""CoupleId"" = 0;");
            migrationBuilder.Sql(@"
                UPDATE ""Guests"" t SET ""CoupleId"" = m.""CoupleId"" FROM ""CoupleMembers"" m WHERE m.""UserId"" = t.""UserId"";
                DELETE FROM ""Guests"" WHERE ""CoupleId"" = 0;");
            migrationBuilder.Sql(@"
                UPDATE ""SeatingTables"" t SET ""CoupleId"" = m.""CoupleId"" FROM ""CoupleMembers"" m WHERE m.""UserId"" = t.""UserId"";
                DELETE FROM ""SeatingTables"" WHERE ""CoupleId"" = 0;");
            migrationBuilder.Sql(@"
                UPDATE ""SeatAssignments"" t SET ""CoupleId"" = m.""CoupleId"" FROM ""CoupleMembers"" m WHERE m.""UserId"" = t.""UserId"";
                DELETE FROM ""SeatAssignments"" WHERE ""CoupleId"" = 0;");
            migrationBuilder.Sql(@"
                UPDATE ""SeatingObjects"" t SET ""CoupleId"" = m.""CoupleId"" FROM ""CoupleMembers"" m WHERE m.""UserId"" = t.""UserId"";
                DELETE FROM ""SeatingObjects"" WHERE ""CoupleId"" = 0;");
            migrationBuilder.Sql(@"
                UPDATE ""WeddingSites"" t SET ""CoupleId"" = m.""CoupleId"" FROM ""CoupleMembers"" m WHERE m.""UserId"" = t.""UserId"";
                DELETE FROM ""WeddingSites"" WHERE ""CoupleId"" = 0;");
            migrationBuilder.Sql(@"
                UPDATE ""SavedVendors"" t SET ""CoupleId"" = m.""CoupleId"" FROM ""CoupleMembers"" m WHERE m.""UserId"" = t.""UserId"";
                DELETE FROM ""SavedVendors"" WHERE ""CoupleId"" = 0;");

            migrationBuilder.DropIndex(
                name: "IX_WeddingSites_UserId",
                table: "WeddingSites");

            migrationBuilder.DropIndex(
                name: "IX_SeatingTables_UserId",
                table: "SeatingTables");

            migrationBuilder.DropIndex(
                name: "IX_SeatingObjects_UserId",
                table: "SeatingObjects");

            migrationBuilder.DropPrimaryKey(
                name: "PK_SavedVendors",
                table: "SavedVendors");

            migrationBuilder.DropIndex(
                name: "IX_Guests_UserId_SortOrder",
                table: "Guests");

            migrationBuilder.DropIndex(
                name: "IX_Couples_UserId",
                table: "Couples");

            migrationBuilder.DropIndex(
                name: "IX_ChecklistItems_UserId_SortOrder",
                table: "ChecklistItems");

            migrationBuilder.DropIndex(
                name: "IX_CategoryBudgets_UserId_CategorySlug",
                table: "CategoryBudgets");

            migrationBuilder.DropIndex(
                name: "IX_BudgetItems_UserId_SortOrder",
                table: "BudgetItems");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "WeddingSites");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "SeatingTables");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "SeatingObjects");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "SeatAssignments");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "SavedVendors");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "Guests");

            migrationBuilder.DropColumn(
                name: "Email",
                table: "Couples");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "Couples");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "ChecklistItems");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "CategoryBudgets");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "BudgetItems");

            migrationBuilder.AddColumn<string>(
                name: "City",
                table: "Couples",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Region",
                table: "Couples",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddPrimaryKey(
                name: "PK_SavedVendors",
                table: "SavedVendors",
                columns: new[] { "CoupleId", "VendorId" });

            migrationBuilder.CreateIndex(
                name: "IX_WeddingSites_CoupleId",
                table: "WeddingSites",
                column: "CoupleId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SeatingTables_CoupleId",
                table: "SeatingTables",
                column: "CoupleId");

            migrationBuilder.CreateIndex(
                name: "IX_SeatingObjects_CoupleId",
                table: "SeatingObjects",
                column: "CoupleId");

            migrationBuilder.CreateIndex(
                name: "IX_SeatAssignments_CoupleId",
                table: "SeatAssignments",
                column: "CoupleId");

            migrationBuilder.CreateIndex(
                name: "IX_Guests_CoupleId_SortOrder",
                table: "Guests",
                columns: new[] { "CoupleId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_ChecklistItems_CoupleId_SortOrder",
                table: "ChecklistItems",
                columns: new[] { "CoupleId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_CategoryBudgets_CoupleId_CategorySlug",
                table: "CategoryBudgets",
                columns: new[] { "CoupleId", "CategorySlug" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BudgetItems_CoupleId_SortOrder",
                table: "BudgetItems",
                columns: new[] { "CoupleId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_CoupleInvites_CoupleId",
                table: "CoupleInvites",
                column: "CoupleId");

            migrationBuilder.CreateIndex(
                name: "IX_CoupleInvites_TokenHash",
                table: "CoupleInvites",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CoupleMembers_CoupleId",
                table: "CoupleMembers",
                column: "CoupleId");

            migrationBuilder.AddForeignKey(
                name: "FK_BudgetItems_Couples_CoupleId",
                table: "BudgetItems",
                column: "CoupleId",
                principalTable: "Couples",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_CategoryBudgets_Couples_CoupleId",
                table: "CategoryBudgets",
                column: "CoupleId",
                principalTable: "Couples",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ChecklistItems_Couples_CoupleId",
                table: "ChecklistItems",
                column: "CoupleId",
                principalTable: "Couples",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Guests_Couples_CoupleId",
                table: "Guests",
                column: "CoupleId",
                principalTable: "Couples",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_SavedVendors_Couples_CoupleId",
                table: "SavedVendors",
                column: "CoupleId",
                principalTable: "Couples",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_SeatAssignments_Couples_CoupleId",
                table: "SeatAssignments",
                column: "CoupleId",
                principalTable: "Couples",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_SeatingObjects_Couples_CoupleId",
                table: "SeatingObjects",
                column: "CoupleId",
                principalTable: "Couples",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_SeatingTables_Couples_CoupleId",
                table: "SeatingTables",
                column: "CoupleId",
                principalTable: "Couples",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_WeddingSites_Couples_CoupleId",
                table: "WeddingSites",
                column: "CoupleId",
                principalTable: "Couples",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Not reversible without losing which rows belonged to whom once plans are shared;
            // roll back by restoring the database backup taken before this migration.
            throw new NotSupportedException(
                "SharedPlan can't be undone automatically: restore the database backup taken before it.");
        }
    }
}
