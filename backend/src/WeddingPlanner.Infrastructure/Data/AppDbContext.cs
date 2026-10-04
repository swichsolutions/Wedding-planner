using WeddingPlanner.Domain.Entities;
using WeddingPlanner.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace WeddingPlanner.Infrastructure.Data;

public class AppDbContext : IdentityDbContext<AppUser>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Vendor> Vendors => Set<Vendor>();
    public DbSet<VendorPhoto> VendorPhotos => Set<VendorPhoto>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Couple> Couples => Set<Couple>();
    public DbSet<SavedVendor> SavedVendors => Set<SavedVendor>();
    public DbSet<Message> Messages => Set<Message>();
    public DbSet<VendorStat> VendorStats => Set<VendorStat>();
    public DbSet<Review> Reviews => Set<Review>();
    public DbSet<Availability> Availabilities => Set<Availability>();
    public DbSet<ContentPage> ContentPages => Set<ContentPage>();
    public DbSet<ChecklistItem> ChecklistItems => Set<ChecklistItem>();
    public DbSet<Guest> Guests => Set<Guest>();
    public DbSet<BudgetItem> BudgetItems => Set<BudgetItem>();
    public DbSet<CategoryBudget> CategoryBudgets => Set<CategoryBudget>();
    public DbSet<WeddingSite> WeddingSites => Set<WeddingSite>();
    public DbSet<SeatingTable> SeatingTables => Set<SeatingTable>();
    public DbSet<SeatAssignment> SeatAssignments => Set<SeatAssignment>();
    public DbSet<SeatingObject> SeatingObjects => Set<SeatingObject>();

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

            // Slug must be unique within a category+city (drives the SEO URL).
            e.HasIndex(x => new { x.CategoryId, x.CitySlug, x.Slug }).IsUnique();
            e.HasIndex(x => x.IsApproved);
            e.HasIndex(x => x.IsFeatured);

            e.HasOne(x => x.Category)
                .WithMany(c => c.Vendors)
                .HasForeignKey(x => x.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);
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

        // ---- Couple (onboarding profile, one row per couple AppUser) ----
        b.Entity<Couple>(e =>
        {
            e.HasIndex(x => x.UserId).IsUnique();
            e.Property(x => x.UserId).HasMaxLength(450).IsRequired();
            e.Property(x => x.FirstName).HasMaxLength(120);
            e.Property(x => x.LastName).HasMaxLength(120);
            e.Property(x => x.PartnerFirstName).HasMaxLength(120);
            e.Property(x => x.PartnerLastName).HasMaxLength(120);
            e.Property(x => x.Email).HasMaxLength(256).IsRequired();
            e.Property(x => x.PlanningStage).HasMaxLength(60);
            e.Property(x => x.GuestCountRange).HasMaxLength(30);
            e.Property(x => x.TotalBudget).HasPrecision(12, 2);
            // NeededCategories (List<string>) maps to a Postgres text[] column via Npgsql.
        });

        // ---- SavedVendor (wishlist — owned by AppUser via UserId, like ChecklistItem) ----
        b.Entity<SavedVendor>(e =>
        {
            e.HasKey(x => new { x.UserId, x.VendorId });
            e.Property(x => x.UserId).HasMaxLength(450).IsRequired();
            e.HasOne(x => x.Vendor)
                .WithMany()
                .HasForeignKey(x => x.VendorId)
                .OnDelete(DeleteBehavior.Cascade);
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
            e.Property(x => x.UserId).HasMaxLength(450).IsRequired();
            e.Property(x => x.Title).HasMaxLength(300).IsRequired();
            e.HasIndex(x => new { x.UserId, x.SortOrder });
        });

        // ---- Guest ----
        b.Entity<Guest>(e =>
        {
            e.Property(x => x.UserId).HasMaxLength(450).IsRequired();
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
            e.HasIndex(x => new { x.UserId, x.SortOrder });
        });

        // ---- SeatingTable / SeatAssignment ----
        b.Entity<SeatingTable>(e =>
        {
            e.Property(x => x.UserId).HasMaxLength(450).IsRequired();
            e.Property(x => x.Name).HasMaxLength(120).IsRequired();
            e.Property(x => x.Shape).HasMaxLength(20).IsRequired();
            e.HasIndex(x => x.UserId);
        });

        b.Entity<SeatAssignment>(e =>
        {
            e.Property(x => x.UserId).HasMaxLength(450).IsRequired();
            e.Property(x => x.AttendeeKind).HasMaxLength(20).IsRequired();
            e.HasIndex(x => new { x.TableId, x.SeatIndex }).IsUnique();
            e.HasIndex(x => new { x.GuestId, x.AttendeeKind }).IsUnique();
            e.HasOne(x => x.Table).WithMany().HasForeignKey(x => x.TableId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Guest).WithMany().HasForeignKey(x => x.GuestId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<SeatingObject>(e =>
        {
            e.Property(x => x.UserId).HasMaxLength(450).IsRequired();
            e.Property(x => x.Type).HasMaxLength(30).IsRequired();
            e.HasIndex(x => x.UserId);
        });

        // ---- BudgetItem ----
        b.Entity<BudgetItem>(e =>
        {
            e.Property(x => x.UserId).HasMaxLength(450).IsRequired();
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.CategorySlug).HasMaxLength(120);
            e.Property(x => x.MerchantName).HasMaxLength(200);
            e.Property(x => x.Note).HasMaxLength(1000);
            e.Property(x => x.Estimate).HasPrecision(12, 2);
            e.Property(x => x.ActualCost).HasPrecision(12, 2);
            e.Property(x => x.Paid).HasPrecision(12, 2);
            e.HasIndex(x => new { x.UserId, x.SortOrder });
            e.HasOne(x => x.Vendor)
                .WithMany()
                .HasForeignKey(x => x.VendorId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // ---- CategoryBudget (guided planner's per-service target) ----
        b.Entity<CategoryBudget>(e =>
        {
            e.Property(x => x.UserId).HasMaxLength(450).IsRequired();
            e.Property(x => x.CategorySlug).HasMaxLength(120).IsRequired();
            e.Property(x => x.Amount).HasPrecision(12, 2);
            e.HasIndex(x => new { x.UserId, x.CategorySlug }).IsUnique();
        });

        // ---- WeddingSite ----
        b.Entity<WeddingSite>(e =>
        {
            e.HasIndex(x => x.UserId).IsUnique();
            e.HasIndex(x => x.Slug).IsUnique(); // Postgres: multiple NULLs allowed
            e.Property(x => x.UserId).HasMaxLength(450).IsRequired();
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
        });

        // ---- ContentPage ----
        b.Entity<ContentPage>(e =>
        {
            e.HasIndex(x => x.Slug).IsUnique();
            e.Property(x => x.Slug).HasMaxLength(220).IsRequired();
            e.Property(x => x.TitleKa).HasMaxLength(300).IsRequired();
            e.Property(x => x.TitleEn).HasMaxLength(300).IsRequired();
            e.Property(x => x.MetaDescriptionKa).HasMaxLength(320);
            e.Property(x => x.MetaDescriptionEn).HasMaxLength(320);
        });
    }
}
