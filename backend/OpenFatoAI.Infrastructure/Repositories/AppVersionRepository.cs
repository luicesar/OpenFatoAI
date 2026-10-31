using Dapper;
using OpenFatoAI.Domain.Entities;
using OpenFatoAI.Infrastructure.Context;
using OpenFatoAI.Infrastructure.Interfaces;

namespace OpenFatoAI.Infrastructure.Repositories;

public class AppVersionRepository(DatabaseContext db) : IAppVersionRepository
{
    public async Task<AppVersion?> GetLatestActiveAsync()
    {
        using var conn = db.CreateConnection();
        return (await conn.QueryAsync<AppVersion>("SELECT * FROM fn_get_latest_app_version()"))
            .FirstOrDefault();
    }
}
