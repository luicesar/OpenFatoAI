using OpenFatoAI.Domain.Entities;

namespace OpenFatoAI.Infrastructure.Interfaces;

public record MeetingPage(IReadOnlyList<Meeting> Items, long Total);

public interface IMeetingRepository
{
    /// <summary>Creates or updates the meeting identified by (installationId, sessionHash). Returns its id.</summary>
    Task<Guid> UpsertAsync(Meeting meeting);

    Task<Meeting?> GetAsync(Guid installationId, Guid id);

    Task<MeetingPage> ListAsync(Guid installationId, short? meetingType, string? search, int limit, int offset);

    /// <summary>Returns true when a meeting was removed.</summary>
    Task<bool> DeleteAsync(Guid installationId, Guid id);

    /// <summary>Removes the meeting with the given app session hash. Returns true when one was removed.</summary>
    Task<bool> DeleteBySessionAsync(Guid installationId, string sessionHash);
}
