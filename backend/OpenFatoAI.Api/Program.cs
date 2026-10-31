using AspNetCoreRateLimit;
using OpenFatoAI.Api.Middlewares;
using OpenFatoAI.Infrastructure.Context;
using OpenFatoAI.Infrastructure.Interfaces;
using OpenFatoAI.Infrastructure.Repositories;
using Serilog;

// Dapper: map snake_case column names (e.g. download_url) to PascalCase properties (DownloadUrl)
Dapper.DefaultTypeMap.MatchNamesWithUnderscores = true;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateLogger();

var builder = WebApplication.CreateBuilder(args);
builder.Host.UseSerilog();

// Infrastructure
builder.Services.AddSingleton<DatabaseContext>();
builder.Services.AddScoped<IAppSettingsRepository, AppSettingsRepository>();
builder.Services.AddScoped<IAppVersionRepository, AppVersionRepository>();
builder.Services.AddScoped<IActionLogRepository, ActionLogRepository>();
builder.Services.AddScoped<IMeetingRepository, MeetingRepository>();

builder.Services.AddControllers();

// Rate limiting
builder.Services.AddMemoryCache();
builder.Services.Configure<IpRateLimitOptions>(builder.Configuration.GetSection("IpRateLimiting"));
builder.Services.AddInMemoryRateLimiting();
builder.Services.AddSingleton<IRateLimitConfiguration, RateLimitConfiguration>();

// CORS
var corsOrigins = (builder.Configuration["CorsSettings:Origins"] ?? "file://")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
builder.Services.AddCors(opts =>
    opts.AddDefaultPolicy(p => p.WithOrigins(corsOrigins)
        .AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

if (!ApiKeyGuard.IsConfigured(app.Configuration))
{
    Log.Warning("Security:ApiKey is not set — PUT /api/settings/{{key}} is disabled. " +
                "Set Security__ApiKey in the environment to enable it.");
}

// Run SQL migrations
{
    var dbCtx = app.Services.GetRequiredService<DatabaseContext>();
    await dbCtx.RunMigrationsAsync();
}

app.UseMiddleware<GlobalExceptionMiddleware>();
app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseIpRateLimiting();
app.UseCors();
app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));

app.Run();
