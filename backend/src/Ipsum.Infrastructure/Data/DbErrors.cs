using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Ipsum.Infrastructure.Data;

public static class DbErrors
{
    /// <summary>
    /// True when a failed save hit a Postgres unique index (SqlState 23505) — the
    /// signature of a check-then-insert race lost to a concurrent request. Callers
    /// use this to recover (retry / treat as duplicate) instead of returning a 500.
    /// </summary>
    public static bool IsUniqueViolation(DbUpdateException ex) =>
        ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation };
}
