using Microsoft.AspNetCore.Mvc;
using OpenFatoAI.Infrastructure.Interfaces;

namespace OpenFatoAI.Api.Controllers;

[ApiController]
[Route("api/app")]
public class AppVersionController(IAppVersionRepository appVersionRepo) : ControllerBase
{
    [HttpGet("latest-version")]
    public async Task<IActionResult> GetLatestVersion()
    {
        var record = await appVersionRepo.GetLatestActiveAsync();

        if (record is null)
        {
            return Ok(new
            {
                version     = (string?)null,
                downloadUrl = (string?)null,
                releasedAt  = (string?)null,
            });
        }

        return Ok(new
        {
            version     = record.Version,
            downloadUrl = record.DownloadUrl,
            releasedAt  = record.ReleasedAt.ToString("o"),
        });
    }
}
