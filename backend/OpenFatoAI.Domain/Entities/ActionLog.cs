namespace OpenFatoAI.Domain.Entities;

public class ActionLog
{
    public long Id { get; set; }
    public Guid? InstallationId { get; set; }
    public string Ip { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string Status { get; set; } = "success";      // 'success' | 'failed'
    public string? Details { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
