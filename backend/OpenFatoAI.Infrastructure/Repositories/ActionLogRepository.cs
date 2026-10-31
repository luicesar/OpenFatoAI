using Dapper;
using OpenFatoAI.Domain.Entities;
using OpenFatoAI.Infrastructure.Context;
using OpenFatoAI.Infrastructure.Interfaces;

namespace OpenFatoAI.Infrastructure.Repositories;

public class ActionLogRepository(DatabaseContext db) : IActionLogRepository
{
    public async Task AddAsync(ActionLog log)
    {
        using var conn = db.CreateConnection();
        await conn.ExecuteAsync(
            "SELECT fn_create_action_log(@p_installation_id, @p_ip, @p_action, @p_status, @p_details)",
            new
            {
                p_installation_id = log.InstallationId,
                p_ip              = log.Ip,
                p_action          = log.Action,
                p_status          = log.Status,
                p_details         = log.Details,
            });
    }
}
