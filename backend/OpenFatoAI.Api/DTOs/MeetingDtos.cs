using System.ComponentModel.DataAnnotations;
using OpenFatoAI.Domain.Entities;

namespace OpenFatoAI.Api.DTOs;

/// <summary>Body of PUT /api/meetings/{sessionHash}. The session hash comes from the route.</summary>
public class SaveMeetingRequest
{
    [Range(1, 2)]                public short   MeetingType     { get; set; } = 1;
    [MaxLength(50)]              public string? SummaryType     { get; set; }
    [MaxLength(2_000_000)]       public string? TranscriptText  { get; set; }
    [MaxLength(500_000)]         public string? AiSummary       { get; set; }
    [MaxLength(50_000)]          public string? PromptUsed      { get; set; }
    [Range(0, 86_400)]           public int     RecordedSeconds { get; set; }
    [MaxLength(50)]              public string? AiProvider      { get; set; }
    [MaxLength(100)]             public string? AiModel         { get; set; }
    [MaxLength(10)]              public string? Language        { get; set; }
}

public record MeetingResponse(
    Guid           Id,
    string         SessionHash,
    short          MeetingType,
    string?        SummaryType,
    string?        TranscriptText,
    string?        AiSummary,
    string?        PromptUsed,
    int            RecordedSeconds,
    string?        AiProvider,
    string?        AiModel,
    string?        Language,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt)
{
    public static MeetingResponse From(Meeting m) => new(
        m.Id, m.SessionHash, m.MeetingType, m.SummaryType, m.TranscriptText, m.AiSummary, m.PromptUsed,
        m.RecordedSeconds, m.AiProvider, m.AiModel, m.Language, m.CreatedAt, m.UpdatedAt);
}

public record MeetingListResponse(IReadOnlyList<MeetingResponse> Items, long Total, int Page, int PageSize);
