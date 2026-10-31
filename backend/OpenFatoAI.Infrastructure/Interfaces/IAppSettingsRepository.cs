namespace OpenFatoAI.Infrastructure.Interfaces;

public interface IAppSettingsRepository
{
    Task<string?> GetAsync(string key);
    Task UpsertAsync(string key, string valueJson);
}
