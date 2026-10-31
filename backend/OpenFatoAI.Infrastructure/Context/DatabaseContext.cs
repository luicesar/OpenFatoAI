using System.Data;
using Dapper;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace OpenFatoAI.Infrastructure.Context;

public class DatabaseContext
{
    private const string BootstrapScript = "000_bootstrap.sql";

    private readonly string _connectionString;
    private readonly ILogger<DatabaseContext> _logger;

    public DatabaseContext(IConfiguration config, ILogger<DatabaseContext> logger)
    {
        _connectionString = config.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");
        _logger = logger;
    }

    public IDbConnection CreateConnection() => new NpgsqlConnection(_connectionString);

    private static string ExtractDescription(string sql, string filename)
    {
        var firstLine = sql.Split('\n')[0].Trim();
        if (firstLine.StartsWith("--"))
            return firstLine[2..].Trim();

        // fallback: "002_add_nickname.sql" → "add nickname"
        var nameWithoutExt = Path.GetFileNameWithoutExtension(filename);
        var parts = nameWithoutExt.Split('_', 2);
        return parts.Length > 1 ? parts[1].Replace('_', ' ') : filename;
    }

    /// <summary>
    /// Runs the SQL files in the SQL/ folder next to this assembly, in alphabetical order
    /// (000_*, 001_*, ...). 000_bootstrap.sql always runs first and creates the migration
    /// control table and its functions; every other script runs once, tracked through
    /// fn_has_migration_run / fn_record_migration.
    /// </summary>
    public async Task RunMigrationsAsync()
    {
        var assemblyDir = Path.GetDirectoryName(typeof(DatabaseContext).Assembly.Location)
            ?? AppContext.BaseDirectory;
        var sqlDir = Path.Combine(assemblyDir, "SQL");

        if (!Directory.Exists(sqlDir))
        {
            _logger.LogWarning("SQL directory not found at {SqlDir} — skipping migrations", sqlDir);
            return;
        }

        await using var conn = new NpgsqlConnection(_connectionString);
        await conn.OpenAsync();

        var bootstrapPath = Path.Combine(sqlDir, BootstrapScript);
        if (!File.Exists(bootstrapPath))
            throw new FileNotFoundException($"{BootstrapScript} not found in {sqlDir}");
        await conn.ExecuteAsync(await File.ReadAllTextAsync(bootstrapPath));

        var sqlFiles = Directory.GetFiles(sqlDir, "*.sql")
            .Where(f => Path.GetFileName(f) != BootstrapScript)
            .OrderBy(f => Path.GetFileName(f), StringComparer.Ordinal);

        foreach (var file in sqlFiles)
        {
            var filename = Path.GetFileName(file);

            var alreadyRun = await conn.ExecuteScalarAsync<bool>(
                "SELECT fn_has_migration_run(@p_script)", new { p_script = filename });
            if (alreadyRun)
            {
                _logger.LogInformation("Skipping migration: {Script}", filename);
                continue;
            }

            var sql = await File.ReadAllTextAsync(file);
            var description = ExtractDescription(sql, filename);
            try
            {
                await conn.ExecuteAsync(sql);
                await conn.ExecuteAsync("SELECT fn_record_migration(@p_script, @p_description, @p_success)",
                    new { p_script = filename, p_description = description, p_success = true });
                _logger.LogInformation("Applied migration: {Script} — {Description}", filename, description);
            }
            catch (Exception ex)
            {
                await conn.ExecuteAsync("SELECT fn_record_migration(@p_script, @p_description, @p_success)",
                    new { p_script = filename, p_description = ex.Message, p_success = false });
                _logger.LogError(ex, "Migration failed: {Script}", filename);
                throw;
            }
        }
    }
}
