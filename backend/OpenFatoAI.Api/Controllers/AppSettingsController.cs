using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using OpenFatoAI.Api.Middlewares;
using OpenFatoAI.Infrastructure.Interfaces;

namespace OpenFatoAI.Api.Controllers;

[ApiController]
[Route("api/settings")]
public class AppSettingsController(IAppSettingsRepository repo, IConfiguration config) : ControllerBase
{
    // GET /api/settings/{key} — global settings (AI model lists, optional services)
    [HttpGet("{key}")]
    public async Task<IActionResult> Get(string key)
    {
        var raw = await repo.GetAsync(key);
        if (raw is null)
            return NotFound(new { error = $"Setting '{key}' not found" });

        var value = JsonSerializer.Deserialize<JsonElement>(raw);
        return Ok(new { key, value });
    }

    // PUT /api/settings/{key} — requires the X-Api-Key header (Security:ApiKey)
    [HttpPut("{key}")]
    public async Task<IActionResult> Put(string key, [FromBody] PutSettingRequest req)
    {
        if (!ApiKeyGuard.IsConfigured(config))
            return StatusCode(403, new { error = "Settings updates are disabled: Security:ApiKey is not configured" });
        if (!ApiKeyGuard.IsAuthorized(Request, config))
            return Unauthorized(new { error = "Invalid or missing X-Api-Key" });

        var valueJson = JsonSerializer.Serialize(req.Value);
        await repo.UpsertAsync(key, valueJson);
        return NoContent();
    }
}

public record PutSettingRequest(JsonElement Value);
