using OpenFatoAI.Domain.Entities;

namespace OpenFatoAI.Infrastructure.Interfaces;

public interface IAppVersionRepository
{
    Task<AppVersion?> GetLatestActiveAsync();
}
