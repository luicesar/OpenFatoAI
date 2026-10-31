using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using OpenFatoAI.Api.DTOs;
using OpenFatoAI.Domain.Entities;
using OpenFatoAI.Infrastructure.Interfaces;

namespace OpenFatoAI.Api.Controllers;

/// <summary>
/// Meetings saved by a desktop installation. There are no accounts: each install sends its
/// anonymous UUID in the X-Installation-Id header and only ever sees its own meetings.
/// </summary>
[ApiController]
[Route("api/meetings")]
public partial class MeetingsController(IMeetingRepository meetings, IActionLogRepository actionLog) : ControllerBase
{
    public const string InstallationHeader = "X-Installation-Id";

    [GeneratedRegex("^[A-Za-z0-9_-]{1,64}$")]
    private static partial Regex SessionHashPattern();

    private bool TryGetInstallationId(out Guid installationId)
    {
        installationId = Guid.Empty;
        return Guid.TryParse(Request.Headers[InstallationHeader].ToString(), out installationId)
            && installationId != Guid.Empty;
    }

    private IActionResult MissingInstallation() =>
        BadRequest(new { error = $"Header {InstallationHeader} is required and must be a valid UUID" });

    private Task LogAsync(Guid installationId, string action) =>
        actionLog.AddAsync(new ActionLog
        {
            InstallationId = installationId,
            Ip             = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            Action         = action,
        });

    // PUT /api/meetings/{sessionHash} — create or update (idempotent, safe to retry)
    [HttpPut("{sessionHash}")]
    public async Task<IActionResult> Save(string sessionHash, [FromBody] SaveMeetingRequest req)
    {
        if (!TryGetInstallationId(out var installationId)) return MissingInstallation();
        if (!SessionHashPattern().IsMatch(sessionHash))
            return BadRequest(new { error = "sessionHash must be 1-64 characters: letters, digits, '-' or '_'" });

        var id = await meetings.UpsertAsync(new Meeting
        {
            InstallationId  = installationId,
            SessionHash     = sessionHash,
            MeetingType     = req.MeetingType,
            SummaryType     = req.SummaryType,
            TranscriptText  = req.TranscriptText,
            AiSummary       = req.AiSummary,
            PromptUsed      = req.PromptUsed,
            RecordedSeconds = req.RecordedSeconds,
            AiProvider      = req.AiProvider,
            AiModel         = req.AiModel,
            Language        = req.Language,
        });

        await LogAsync(installationId, "meeting_save");
        return Ok(new { id, sessionHash });
    }

    // GET /api/meetings?type=1|2&search=text&page=1&pageSize=15
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] short? type, [FromQuery] string? search,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 15)
    {
        if (!TryGetInstallationId(out var installationId)) return MissingInstallation();
        if (type is not null && type is not (1 or 2))
            return BadRequest(new { error = "type must be 1 (Home) or 2 (Transcriptions)" });
        if (search is { Length: > 200 })
            return BadRequest(new { error = "search is limited to 200 characters" });

        page     = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var result = await meetings.ListAsync(installationId, type, search, pageSize, (page - 1) * pageSize);
        return Ok(new MeetingListResponse(
            result.Items.Select(MeetingResponse.From).ToList(), result.Total, page, pageSize));
    }

    // GET /api/meetings/{id}
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        if (!TryGetInstallationId(out var installationId)) return MissingInstallation();

        var meeting = await meetings.GetAsync(installationId, id);
        return meeting is null
            ? NotFound(new { error = $"Meeting {id} not found" })
            : Ok(MeetingResponse.From(meeting));
    }

    // DELETE /api/meetings/{id}
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        if (!TryGetInstallationId(out var installationId)) return MissingInstallation();

        if (!await meetings.DeleteAsync(installationId, id))
            return NotFound(new { error = $"Meeting {id} not found" });

        await LogAsync(installationId, "meeting_delete");
        return NoContent();
    }

    // DELETE /api/meetings/by-session/{sessionHash} — used by the app's sync (it knows the session hash, not the server id)
    [HttpDelete("by-session/{sessionHash}")]
    public async Task<IActionResult> DeleteBySession(string sessionHash)
    {
        if (!TryGetInstallationId(out var installationId)) return MissingInstallation();
        if (!SessionHashPattern().IsMatch(sessionHash))
            return BadRequest(new { error = "sessionHash must be 1-64 characters: letters, digits, '-' or '_'" });

        if (!await meetings.DeleteBySessionAsync(installationId, sessionHash))
            return NotFound(new { error = $"Meeting with session '{sessionHash}' not found" });

        await LogAsync(installationId, "meeting_delete");
        return NoContent();
    }
}
