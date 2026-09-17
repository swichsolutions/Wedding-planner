using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace WeddingPlanner.Infrastructure.Data;

/// <summary>
/// Design-time factory so `dotnet ef` can build the model from the Infrastructure project
/// alone (no need to load the API assembly). The connection string here is only used at
/// design time; `migrations add` does not connect to the database.
/// </summary>
public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(
                "Host=localhost;Port=5432;Database=ipsum_dev;Username=ipsum_app;Password=design-time",
                npgsql => npgsql.MigrationsAssembly("WeddingPlanner.Infrastructure"))
            .Options;
        return new AppDbContext(options);
    }
}
