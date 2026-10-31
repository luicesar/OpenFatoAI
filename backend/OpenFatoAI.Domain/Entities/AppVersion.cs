namespace OpenFatoAI.Domain.Entities;

public class AppVersion
{
    public int            Id          { get; set; }
    public string         Version     { get; set; } = "";
    public string         DownloadUrl { get; set; } = "";
    public DateTimeOffset ReleasedAt  { get; set; }
    public bool           IsActive    { get; set; }
    public DateTimeOffset CreatedAt   { get; set; }
}
