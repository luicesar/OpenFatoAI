using OpenFatoAI.Domain.Entities;

namespace OpenFatoAI.Infrastructure.Interfaces;

public interface IActionLogRepository
{
    Task AddAsync(ActionLog log);
}
