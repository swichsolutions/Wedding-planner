using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WeddingPlanner.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class NewsConsent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "NewsConsentAt",
                table: "AspNetUsers",
                type: "timestamp with time zone",
                nullable: true);

            // The privacy page is kept in the database and owned by the admin editor, so the new
            // paragraph about news by e-mail is put in once, before the "who we share it with"
            // heading, and only where that heading still stands and the paragraph is not there yet.
            Insert(migrationBuilder, "BodyKa", "## 4. ვის ვუზიარებთ", "სიახლეებსა და შეთავაზებებს",
                "სიახლეებსა და შეთავაზებებს ელფოსტით მხოლოდ მაშინ გიგზავნით, თუ ამაზე თანხმობა მოგვეცი (რეგისტრაციისას ან ანგარიშის გვერდზე). თანხმობის გაუქმება ნებისმიერ დროს შეგიძლია: ანგარიშის გვერდზე ან წერილში მოცემული ბმულით.");
            Insert(migrationBuilder, "BodyEn", "## 4. Who we share it with", "We send news and offers",
                "We send news and offers by email only if you agreed to it (at sign-up or on your account page). You can withdraw that at any time: on the account page or with the link in the email.");
        }

        private static void Insert(MigrationBuilder migrationBuilder, string column, string heading, string marker, string paragraph)
        {
            static string Text(string value) => "'" + value.Replace("'", "''") + "'";
            migrationBuilder.Sql(
                $"UPDATE \"ContentPages\" SET \"{column}\" = replace(\"{column}\", {Text(heading)}, " +
                $"{Text(paragraph)} || chr(10) || chr(10) || {Text(heading)}), " +
                "\"UpdatedAt\" = TIMESTAMPTZ '2026-11-26 12:00:00+00' " +
                $"WHERE \"Type\" = 3 AND \"Slug\" = 'privacy' AND position({Text(heading)} in \"{column}\") > 0 " +
                $"AND position({Text(marker)} in \"{column}\") = 0;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "NewsConsentAt",
                table: "AspNetUsers");
        }
    }
}
