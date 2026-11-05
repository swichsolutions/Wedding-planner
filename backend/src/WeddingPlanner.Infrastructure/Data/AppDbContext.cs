using WeddingPlanner.Domain.Entities;
using WeddingPlanner.Infrastructure.Identity;
using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace WeddingPlanner.Infrastructure.Data;

public class AppDbContext : IdentityDbContext<AppUser>, IDataProtectionKeyContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    // Data-protection key ring (signs password-reset links). Kept in the database so a
    // link stays valid across restarts — Render's free tier sleeps and its disk is ephemeral.
    public DbSet<DataProtectionKey> DataProtectionKeys => Set<DataProtectionKey>();

    public DbSet<Vendor> Vendors => Set<Vendor>();
    public DbSet<VendorPhoto> VendorPhotos => Set<VendorPhoto>();
    public DbSet<VendorPackage> VendorPackages => Set<VendorPackage>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Couple> Couples => Set<Couple>();
    public DbSet<CoupleMember> CoupleMembers => Set<CoupleMember>();
    public DbSet<CoupleInvite> CoupleInvites => Set<CoupleInvite>();
    public DbSet<PlanService> PlanServices => Set<PlanService>();
    public DbSet<BudgetPayment> BudgetPayments => Set<BudgetPayment>();
    public DbSet<Message> Messages => Set<Message>();
    public DbSet<VendorStat> VendorStats => Set<VendorStat>();
    public DbSet<Review> Reviews => Set<Review>();
    public DbSet<VendorClaim> VendorClaims => Set<VendorClaim>();
    public DbSet<Availability> Availabilities => Set<Availability>();
    public DbSet<ContentPage> ContentPages => Set<ContentPage>();
    public DbSet<ContentPhoto> ContentPhotos => Set<ContentPhoto>();
    public DbSet<ContentCredit> ContentCredits => Set<ContentCredit>();
    public DbSet<ChecklistItem> ChecklistItems => Set<ChecklistItem>();
    public DbSet<Guest> Guests => Set<Guest>();
    public DbSet<GuestFamily> GuestFamilies => Set<GuestFamily>();
    public DbSet<BudgetItem> BudgetItems => Set<BudgetItem>();
    public DbSet<CategoryBudget> CategoryBudgets => Set<CategoryBudget>();
    public DbSet<WeddingSite> WeddingSites => Set<WeddingSite>();
    public DbSet<WeddingSiteScheduleItem> WeddingSiteScheduleItems => Set<WeddingSiteScheduleItem>();
    public DbSet<WeddingSitePhoto> WeddingSitePhotos => Set<WeddingSitePhoto>();
    public DbSet<PlanPhoto> PlanPhotos => Set<PlanPhoto>();
    public DbSet<SeatingTable> SeatingTables => Set<SeatingTable>();
    public DbSet<SeatAssignment> SeatAssignments => Set<SeatAssignment>();
    public DbSet<SeatingObject> SeatingObjects => Set<SeatingObject>();
    public DbSet<WeddingDayItem> WeddingDayItems => Set<WeddingDayItem>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b); // Identity schema (users, roles, claims, …)

        // ---- Category ----
        b.Entity<Category>(e =>
        {
            e.HasIndex(x => x.Slug).IsUnique();
            e.Property(x => x.NameKa).HasMaxLength(120).IsRequired();
            e.Property(x => x.NameEn).HasMaxLength(120).IsRequired();
            e.Property(x => x.Slug).HasMaxLength(120).IsRequired();
            e.Property(x => x.GroupKey).HasMaxLength(20).IsRequired();
            e.HasIndex(x => x.GroupKey);
        });

        // ---- Vendor ----
        b.Entity<Vendor>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.Slug).HasMaxLength(220).IsRequired();
            e.Property(x => x.City).HasMaxLength(120);
            e.Property(x => x.CitySlug).HasMaxLength(120);
            e.Property(x => x.PriceMin).HasPrecision(12, 2);
            e.Property(x => x.PriceRange).HasMaxLength(120);
            e.Property(x => x.Instagram).HasMaxLength(200);
            e.Property(x => x.Facebook).HasMaxLength(200);
            e.Property(x => x.MapUrl).HasMaxLength(1000);
            e.Property(x => x.Region).HasMaxLength(40);
            e.Property(x => x.PriceUnit).HasMaxLength(10);
            e.Property(x => x.Setting).HasMaxLength(10);
            e.Property(x => x.VenueType).HasMaxLength(20);
            e.Property(x => x.DepositTerms).HasMaxLength(200);
            e.Property(x => x.CancellationTerms).HasMaxLength(500);
            e.Property(x => x.TravelPolicy).HasMaxLength(10);
            e.Property(x => x.BookingLeadTime).HasMaxLength(100);
            e.Property(x => x.ConsentBy).HasMaxLength(200);
            e.Property(x => x.ConsentMethod).HasMaxLength(60);
            // Postgres text[] with an empty default, so existing rows read as [] (never null).
            e.Property(x => x.ServedRegions).HasDefaultValueSql("'{}'::text[]");
            e.Property(x => x.AlsoOffers).HasDefaultValueSql("'{}'::text[]");
            e.Property(x => x.Styles).HasDefaultValueSql("'{}'::text[]");
            e.Property(x => x.Features).HasDefaultValueSql("'{}'::text[]");
            e.HasIndex(x => x.Region);

            // Slug must be unique within a category+city (drives the SEO URL).
            e.HasIndex(x => new { x.CategoryId, x.CitySlug, x.Slug }).IsUnique();
            e.HasIndex(x => x.IsApproved);
            e.HasIndex(x => x.IsFeatured);

            e.HasOne(x => x.Category)
                .WithMany(c => c.Vendors)
                .HasForeignKey(x => x.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // ---- VendorPackage (up to 5 per vendor) ----
        b.Entity<VendorPackage>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(120).IsRequired();
            e.Property(x => x.Price).HasPrecision(12, 2);
            e.Property(x => x.PriceUnit).HasMaxLength(10);
            e.Property(x => x.Included).HasMaxLength(1000);
            e.Property(x => x.Duration).HasMaxLength(60);
            e.HasOne(x => x.Vendor)
                .WithMany(v => v.Packages)
                .HasForeignKey(x => x.VendorId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.VendorId, x.SortOrder });
        });

        // ---- VendorPhoto ----
        b.Entity<VendorPhoto>(e =>
        {
            e.Property(x => x.Url).HasMaxLength(1000).IsRequired();
            e.Property(x => x.StorageId).HasMaxLength(300);
            e.Property(x => x.AltText).HasMaxLength(300);
            e.HasOne(x => x.Vendor)
                .WithMany(v => v.Photos)
                .HasForeignKey(x => x.VendorId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.VendorId, x.SortOrder });
        });

        // ---- Review (one per couple per vendor; resubmit = update) ----
        b.Entity<Review>(e =>
        {
            e.HasIndex(x => new { x.VendorId, x.UserId }).IsUnique();
            e.Property(x => x.UserId).HasMaxLength(450).IsRequired();
            e.Property(x => x.AuthorName).HasMaxLength(200).IsRequired();
            e.Property(x => x.Body).HasMaxLength(4000);
            e.HasOne(x => x.Vendor)
                .WithMany(v => v.Reviews)
                .HasForeignKey(x => x.VendorId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // ---- VendorClaim: a registered vendor asking to take over an imported profile (A3) ----
        b.Entity<VendorClaim>(e =>
        {
            e.HasIndex(x => x.VendorId);
            e.HasIndex(x => x.UserId);
            e.Property(x => x.UserId).HasMaxLength(450).IsRequired();
            e.Property(x => x.UserEmail).HasMaxLength(256).IsRequired();
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(16);
            e.HasOne(x => x.Vendor)
                .WithMany()
                .HasForeignKey(x => x.VendorId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // ---- Couple: the shared plan (B1). Organizer rows below hang off it, deleted with it. ----
        b.Entity<Couple>(e =>
        {
            e.Property(x => x.FirstName).HasMaxLength(120);
            e.Property(x => x.LastName).HasMaxLength(120);
            e.Property(x => x.PartnerFirstName).HasMaxLength(120);
            e.Property(x => x.PartnerLastName).HasMaxLength(120);
            e.Property(x => x.City).HasMaxLength(120);
            e.Property(x => x.Region).HasMaxLength(40);
            e.Property(x => x.PlanningStage).HasMaxLength(60);
            e.Property(x => x.GuestCountRange).HasMaxLength(30);
            e.Property(x => x.TotalBudget).HasPrecision(12, 2);
            e.Property(x => x.FloorPlanUrl).HasMaxLength(1000);
            e.Property(x => x.FloorPlanStorageId).HasMaxLength(300);
            e.Property(x => x.PaletteKey).HasMaxLength(20);
            // NeededCategories (List<string>) maps to a Postgres text[] column via Npgsql.
        });

        // One plan per account (the key), at most two accounts per plan (enforced in code).
        b.Entity<CoupleMember>(e =>
        {
            e.HasKey(x => x.UserId);
            e.Property(x => x.UserId).HasMaxLength(450);
            e.HasIndex(x => x.CoupleId);
            e.HasOne(x => x.Couple).WithMany(c => c.Members).HasForeignKey(x => x.CoupleId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<CoupleInvite>(e =>
        {
            e.Property(x => x.TokenHash).HasMaxLength(64).IsRequired();
            e.HasIndex(x => x.TokenHash).IsUnique();
            e.Property(x => x.Email).HasMaxLength(256);
            e.Property(x => x.CreatedByUserId).HasMaxLength(450).IsRequired();
            e.Property(x => x.AcceptedByUserId).HasMaxLength(450);
            e.HasIndex(x => x.CoupleId);
            e.HasOne(x => x.Couple).WithMany().HasForeignKey(x => x.CoupleId).OnDelete(DeleteBehavior.Cascade);
        });

        // ---- PlanService („ჩემი მომსახურებები“: saved → shortlisted → chosen; the wishlist too) ----
        b.Entity<PlanService>(e =>
        {
            OwnedByCouple(e);
            // One row per catalog vendor per plan (Postgres allows many NULLs: hand-added ones).
            e.HasIndex(x => new { x.CoupleId, x.VendorId }).IsUnique();
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.CategorySlug).HasMaxLength(120);
            e.Property(x => x.Status).HasMaxLength(10).IsRequired();
            e.Property(x => x.Phone).HasMaxLength(40);
            e.Property(x => x.Email).HasMaxLength(256);
            e.Property(x => x.Instagram).HasMaxLength(200);
            e.Property(x => x.Offer).HasPrecision(12, 2);
            e.Property(x => x.OfferNote).HasMaxLength(500);
            e.Property(x => x.Note).HasMaxLength(1000);
            // A vendor leaving the platform keeps the row (with its name), just without the link.
            e.HasOne(x => x.Vendor).WithMany().HasForeignKey(x => x.VendorId).OnDelete(DeleteBehavior.SetNull);
        });

        // ---- Message ----
        b.Entity<Message>(e =>
        {
            e.Property(x => x.Body).IsRequired();
            e.Property(x => x.SenderName).HasMaxLength(200);
            e.Property(x => x.SenderEmail).HasMaxLength(256);
            e.Property(x => x.SenderPhone).HasMaxLength(40);
            e.HasOne(x => x.Vendor)
                .WithMany(v => v.Messages)
                .HasForeignKey(x => x.VendorId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Couple)
                .WithMany()
                .HasForeignKey(x => x.CoupleId)
                .OnDelete(DeleteBehavior.SetNull);
            e.HasIndex(x => new { x.VendorId, x.IsRead });
        });

        // ---- VendorStat ----
        b.Entity<VendorStat>(e =>
        {
            e.HasIndex(x => new { x.VendorId, x.Date }).IsUnique();
            e.HasOne(x => x.Vendor)
                .WithMany(v => v.Stats)
                .HasForeignKey(x => x.VendorId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // ---- Availability ----
        b.Entity<Availability>(e =>
        {
            e.HasIndex(x => new { x.VendorId, x.Date }).IsUnique();
            e.HasOne(x => x.Vendor)
                .WithMany()
                .HasForeignKey(x => x.VendorId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // ---- ChecklistItem ----
        b.Entity<ChecklistItem>(e =>
        {
            OwnedByCouple(e);
            e.Property(x => x.Title).HasMaxLength(300).IsRequired();
            e.Property(x => x.Stage).HasMaxLength(10);
            e.Property(x => x.Who).HasMaxLength(120);
            e.Property(x => x.Link).HasMaxLength(60);
            e.HasIndex(x => new { x.CoupleId, x.SortOrder });
        });

        // ---- Guest ----
        b.Entity<Guest>(e =>
        {
            OwnedByCouple(e);
            e.Property(x => x.FirstName).HasMaxLength(120).IsRequired();
            e.Property(x => x.LastName).HasMaxLength(120);
            e.Property(x => x.Email).HasMaxLength(256);
            e.Property(x => x.Phone).HasMaxLength(40);
            e.Property(x => x.Relationship).HasMaxLength(40).IsRequired();
            e.Property(x => x.InvitedStatus).HasMaxLength(20).IsRequired();
            e.Property(x => x.PlusOneFirstName).HasMaxLength(120);
            e.Property(x => x.PlusOneLastName).HasMaxLength(120);
            e.Property(x => x.ChildFirstName).HasMaxLength(120);
            e.Property(x => x.ChildLastName).HasMaxLength(120);
            e.Property(x => x.Attendance).HasMaxLength(10).IsRequired().HasDefaultValue("pending");
            e.Property(x => x.DietaryNeeds).HasMaxLength(200);
            e.Property(x => x.InviteCode).HasMaxLength(16);
            e.HasIndex(x => x.InviteCode).IsUnique(); // Postgres: multiple NULLs allowed
            e.Property(x => x.RsvpMessage).HasMaxLength(1000);
            e.Property(x => x.RsvpAnswer).HasMaxLength(500);
            e.HasIndex(x => new { x.CoupleId, x.SortOrder });
            // Deleting a family keeps its guests, ungrouped.
            e.HasOne(x => x.Family).WithMany().HasForeignKey(x => x.FamilyId).OnDelete(DeleteBehavior.SetNull);
        });

        // ---- GuestFamily (D9: the guests invited together; one RSVP link each in B6) ----
        b.Entity<GuestFamily>(e =>
        {
            OwnedByCouple(e);
            e.Property(x => x.Name).HasMaxLength(120).IsRequired();
            e.Property(x => x.InviteCode).HasMaxLength(16);
            e.HasIndex(x => x.InviteCode).IsUnique();
            e.Property(x => x.RsvpMessage).HasMaxLength(1000);
            e.Property(x => x.RsvpAnswer).HasMaxLength(500);
        });

        // ---- SeatingTable / SeatAssignment ----
        b.Entity<SeatingTable>(e =>
        {
            OwnedByCouple(e);
            e.Property(x => x.Name).HasMaxLength(120).IsRequired();
            e.Property(x => x.Shape).HasMaxLength(20).IsRequired();
        });

        b.Entity<SeatAssignment>(e =>
        {
            OwnedByCouple(e);
            e.Property(x => x.AttendeeKind).HasMaxLength(20).IsRequired();
            e.HasIndex(x => new { x.TableId, x.SeatIndex }).IsUnique();
            e.HasIndex(x => new { x.GuestId, x.AttendeeKind }).IsUnique();
            e.HasOne(x => x.Table).WithMany().HasForeignKey(x => x.TableId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Guest).WithMany().HasForeignKey(x => x.GuestId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<SeatingObject>(e =>
        {
            OwnedByCouple(e);
            e.Property(x => x.Type).HasMaxLength(30).IsRequired();
            e.Property(x => x.Label).HasMaxLength(60);
        });

        // ---- WeddingDayItem („ქორწილის დღე“, B2) ----
        b.Entity<WeddingDayItem>(e =>
        {
            OwnedByCouple(e);
            e.Property(x => x.Time).HasMaxLength(5);
            e.Property(x => x.Activity).HasMaxLength(200).IsRequired();
            e.Property(x => x.Note).HasMaxLength(500);
            e.Property(x => x.Who).HasMaxLength(120);
            e.Property(x => x.Contact).HasMaxLength(120);
        });

        // ---- BudgetItem ----
        b.Entity<BudgetItem>(e =>
        {
            OwnedByCouple(e);
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.CategorySlug).HasMaxLength(120);
            e.Property(x => x.MerchantName).HasMaxLength(200);
            e.Property(x => x.Note).HasMaxLength(1000);
            e.Property(x => x.Estimate).HasPrecision(12, 2);
            e.Property(x => x.ActualCost).HasPrecision(12, 2);
            e.Property(x => x.Paid).HasPrecision(12, 2);
            e.HasIndex(x => new { x.CoupleId, x.SortOrder });
            e.HasOne(x => x.Vendor)
                .WithMany()
                .HasForeignKey(x => x.VendorId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // ---- BudgetPayment (B4: deposits and instalments, gone with their line) ----
        b.Entity<BudgetPayment>(e =>
        {
            e.Property(x => x.Amount).HasPrecision(12, 2);
            e.Property(x => x.Note).HasMaxLength(200);
            e.HasIndex(x => x.BudgetItemId);
            e.HasOne(x => x.BudgetItem).WithMany(i => i.Payments).HasForeignKey(x => x.BudgetItemId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // ---- CategoryBudget (guided planner's per-service target) ----
        b.Entity<CategoryBudget>(e =>
        {
            OwnedByCouple(e);
            e.Property(x => x.CategorySlug).HasMaxLength(120).IsRequired();
            e.Property(x => x.Amount).HasPrecision(12, 2);
            e.HasIndex(x => new { x.CoupleId, x.CategorySlug }).IsUnique();
        });

        // ---- WeddingSite ----
        b.Entity<WeddingSite>(e =>
        {
            OwnedByCouple(e);
            e.HasIndex(x => x.CoupleId).IsUnique();
            e.HasIndex(x => x.Slug).IsUnique(); // Postgres: multiple NULLs allowed
            e.Property(x => x.Slug).HasMaxLength(160);
            e.Property(x => x.TemplateKey).HasMaxLength(40).IsRequired();
            e.Property(x => x.FirstName).HasMaxLength(120);
            e.Property(x => x.LastName).HasMaxLength(120);
            e.Property(x => x.PartnerFirstName).HasMaxLength(120);
            e.Property(x => x.PartnerLastName).HasMaxLength(120);
            e.Property(x => x.Place).HasMaxLength(200);
            e.Property(x => x.Message).HasMaxLength(2000);
            e.Property(x => x.InkColor).HasMaxLength(7);
            e.Property(x => x.AccentColor).HasMaxLength(7);
            e.Property(x => x.PhotoUrl).HasMaxLength(1000);
            e.Property(x => x.PhotoStorageId).HasMaxLength(300);
            e.Property(x => x.StartTime).HasMaxLength(5);
            e.Property(x => x.FontKey).HasMaxLength(20);
            e.Property(x => x.CeremonyName).HasMaxLength(200);
            e.Property(x => x.CeremonyAddress).HasMaxLength(300);
            e.Property(x => x.CeremonyTime).HasMaxLength(5);
            e.Property(x => x.CeremonyMapUrl).HasMaxLength(500);
            e.Property(x => x.ReceptionName).HasMaxLength(200);
            e.Property(x => x.ReceptionAddress).HasMaxLength(300);
            e.Property(x => x.ReceptionTime).HasMaxLength(5);
            e.Property(x => x.ReceptionMapUrl).HasMaxLength(500);
            e.Property(x => x.DressCode).HasMaxLength(500);
            e.Property(x => x.Transport).HasMaxLength(500);
            e.Property(x => x.Accommodation).HasMaxLength(500);
            // Sentinel true: EF then still sends an explicit false on insert (with the CLR default as
            // sentinel it would leave false out and the database default would turn it back on).
            e.Property(x => x.RsvpEnabled).HasDefaultValue(true).HasSentinel(true);
            e.Property(x => x.RsvpAskDiet).HasDefaultValue(true).HasSentinel(true);
            e.Property(x => x.RsvpAskMessage).HasDefaultValue(true).HasSentinel(true);
            e.Property(x => x.RsvpQuestion).HasMaxLength(200);
            e.HasMany(x => x.Schedule).WithOne().HasForeignKey(x => x.WeddingSiteId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.Photos).WithOne().HasForeignKey(x => x.WeddingSiteId).OnDelete(DeleteBehavior.Cascade);
        });

        // ---- photos marked for the overview banner (B7): gone with their source photo ----
        b.Entity<PlanPhoto>(e =>
        {
            OwnedByCouple(e);
            e.Property(x => x.Kind).HasMaxLength(10).IsRequired();
            e.Property(x => x.Url).HasMaxLength(1000).IsRequired();
            e.HasOne(x => x.VendorPhoto).WithMany().HasForeignKey(x => x.VendorPhotoId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.ContentPhoto).WithMany().HasForeignKey(x => x.ContentPhotoId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.CoupleId, x.VendorPhotoId }).IsUnique().HasFilter("\"VendorPhotoId\" IS NOT NULL");
            e.HasIndex(x => new { x.CoupleId, x.ContentPhotoId }).IsUnique().HasFilter("\"ContentPhotoId\" IS NOT NULL");
        });

        // ---- the invitation's short schedule and extra photos (B6) ----
        b.Entity<WeddingSiteScheduleItem>(e =>
        {
            e.Property(x => x.Time).HasMaxLength(5);
            e.Property(x => x.Text).HasMaxLength(120).IsRequired();
            e.HasIndex(x => new { x.WeddingSiteId, x.SortOrder });
        });
        b.Entity<WeddingSitePhoto>(e =>
        {
            e.Property(x => x.Url).HasMaxLength(1000).IsRequired();
            e.Property(x => x.StorageId).HasMaxLength(300).IsRequired();
            e.HasIndex(x => new { x.WeddingSiteId, x.SortOrder });
        });

        // ---- ContentPage (+ photos, credits) ----
        b.Entity<ContentPage>(e =>
        {
            // URLs are per section (/guides/blog/x, /guides/inspiration/x), so slugs are unique per type.
            e.HasIndex(x => new { x.Type, x.Slug }).IsUnique();
            e.HasIndex(x => new { x.Type, x.IsPublished, x.PublishedAt });
            e.Property(x => x.Slug).HasMaxLength(120).IsRequired();
            e.Property(x => x.Topic).HasMaxLength(40);
            e.Property(x => x.TitleKa).HasMaxLength(300).IsRequired();
            e.Property(x => x.TitleEn).HasMaxLength(300);
            e.Property(x => x.ExcerptKa).HasMaxLength(500);
            e.Property(x => x.ExcerptEn).HasMaxLength(500);
            e.Property(x => x.BodyKa).HasMaxLength(100_000);
            e.Property(x => x.BodyEn).HasMaxLength(100_000);
            e.Property(x => x.MetaDescriptionKa).HasMaxLength(320);
            e.Property(x => x.MetaDescriptionEn).HasMaxLength(320);
            e.Property(x => x.ActionPath).HasMaxLength(300);
            e.Property(x => x.ActionLabelKa).HasMaxLength(80);
            e.Property(x => x.ActionLabelEn).HasMaxLength(80);
            e.Property(x => x.ConsentNote).HasMaxLength(500);
            e.HasMany(x => x.Photos).WithOne(p => p.ContentPage)
                .HasForeignKey(p => p.ContentPageId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.Credits).WithOne(c => c.ContentPage)
                .HasForeignKey(c => c.ContentPageId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<ContentPhoto>(e =>
        {
            e.HasIndex(x => new { x.ContentPageId, x.SortOrder });
            e.Property(x => x.Url).HasMaxLength(1000).IsRequired();
            e.Property(x => x.StorageId).HasMaxLength(300);
            e.Property(x => x.AltKa).HasMaxLength(300).IsRequired();
            e.Property(x => x.AltEn).HasMaxLength(300);
        });

        b.Entity<ContentCredit>(e =>
        {
            e.HasIndex(x => x.ContentPageId);
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.RoleKa).HasMaxLength(80).IsRequired();
            e.Property(x => x.RoleEn).HasMaxLength(80);
            // A vendor leaving the platform keeps the credit, just without the profile link.
            e.HasOne(x => x.Vendor).WithMany().HasForeignKey(x => x.VendorId)
                .OnDelete(DeleteBehavior.SetNull);
        });
    }

    /// <summary>An organizer row belongs to a plan (CoupleId) and goes when the plan does.</summary>
    private static void OwnedByCouple<T>(EntityTypeBuilder<T> e) where T : class =>
        e.HasOne<Couple>().WithMany().HasForeignKey("CoupleId").OnDelete(DeleteBehavior.Cascade);
}
