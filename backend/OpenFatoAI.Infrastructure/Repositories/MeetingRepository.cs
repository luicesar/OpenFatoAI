using Dapper;
using OpenFatoAI.Domain.Entities;
using OpenFatoAI.Infrastructure.Context;
using OpenFatoAI.Infrastructure.Interfaces;

namespace OpenFatoAI.Infrastructure.Repositories;

public class MeetingRepository(DatabaseContext db) : IMeetingRepository
{
    // fn_list_meetings returns the full row plus total_count (window count)
    private sealed class MeetingRow : Meeting
    {
        public long TotalCount { get; set; }
    }

    public async Task<Guid> UpsertAsync(Meeting m)
    {
        using var conn = db.CreateConnection();
        return await conn.ExecuteScalarAsync<Guid>(
            """
            SELECT fn_upsert_meeting(@p_installation_id, @p_session_hash, @p_meeting_type, @p_summary_type,
                                     @p_transcript_text, @p_ai_summary, @p_prompt_used, @p_recorded_seconds,
                                     @p_ai_provider, @p_ai_model, @p_language)
            """,
            new
            {
                p_installation_id  = m.InstallationId,
                p_session_hash     = m.SessionHash,
                p_meeting_type     = m.MeetingType,
                p_summary_type     = m.SummaryType,
                p_transcript_text  = m.TranscriptText,
                p_ai_summary       = m.AiSummary,
                p_prompt_used      = m.PromptUsed,
                p_recorded_seconds = m.RecordedSeconds,
                p_ai_provider      = m.AiProvider,
                p_ai_model         = m.AiModel,
                p_language         = m.Language,
            });
    }

    public async Task<Meeting?> GetAsync(Guid installationId, Guid id)
    {
        using var conn = db.CreateConnection();
        return (await conn.QueryAsync<Meeting>(
            "SELECT * FROM fn_get_meeting(@p_installation_id, @p_id)",
            new { p_installation_id = installationId, p_id = id })).FirstOrDefault();
    }

    public async Task<MeetingPage> ListAsync(Guid installationId, short? meetingType, string? search, int limit, int offset)
    {
        using var conn = db.CreateConnection();
        var rows = (await conn.QueryAsync<MeetingRow>(
            """
            SELECT * FROM fn_list_meetings(@p_installation_id, @p_meeting_type::smallint, @p_search::text,
                                           @p_limit, @p_offset)
            """,
            new
            {
                p_installation_id = installationId,
                p_meeting_type    = meetingType,
                p_search          = search,
                p_limit           = limit,
                p_offset          = offset,
            })).ToList();

        return new MeetingPage(rows.Cast<Meeting>().ToList(), rows.FirstOrDefault()?.TotalCount ?? 0);
    }

    public async Task<bool> DeleteAsync(Guid installationId, Guid id)
    {
        using var conn = db.CreateConnection();
        return await conn.ExecuteScalarAsync<bool>(
            "SELECT fn_delete_meeting(@p_installation_id, @p_id)",
            new { p_installation_id = installationId, p_id = id });
    }

    public async Task<bool> DeleteBySessionAsync(Guid installationId, string sessionHash)
    {
        using var conn = db.CreateConnection();
        return await conn.ExecuteScalarAsync<bool>(
            "SELECT fn_delete_meeting_by_session(@p_installation_id, @p_session_hash)",
            new { p_installation_id = installationId, p_session_hash = sessionHash });
    }
}
