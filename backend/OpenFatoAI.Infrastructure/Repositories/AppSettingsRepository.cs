using Dapper;
using OpenFatoAI.Infrastructure.Context;
using OpenFatoAI.Infrastructure.Interfaces;

namespace OpenFatoAI.Infrastructure.Repositories;

public class AppSettingsRepository(DatabaseContext db) : IAppSettingsRepository
{
    public async Task<string?> GetAsync(string key)
    {
        using var conn = db.CreateConnection();
        return await conn.ExecuteScalarAsync<string?>(
            "SELECT fn_get_app_setting(@p_key)",
            new { p_key = key });
    }

    public async Task UpsertAsync(string key, string valueJson)
    {
        using var conn = db.CreateConnection();
        await conn.ExecuteAsync(
            "SELECT fn_upsert_app_setting(@p_key, @p_value::jsonb)",
            new { p_key = key, p_value = valueJson });
    }
}
