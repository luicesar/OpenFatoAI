using System.Net;
using System.Text.Json;

namespace OpenFatoAI.Api.Middlewares;

public class GlobalExceptionMiddleware(
    RequestDelegate next,
    ILogger<GlobalExceptionMiddleware> logger,
    IWebHostEnvironment env)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled exception on {Method} {Path}",
                context.Request.Method, context.Request.Path);

            context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;
            context.Response.ContentType = "application/json";

            var devMessage = string.IsNullOrWhiteSpace(ex.Message)
                ? $"{ex.GetType().Name} (no message)"
                : ex.Message;
            var message = env.IsDevelopment() ? devMessage : "Internal server error";

            await context.Response.WriteAsync(JsonSerializer.Serialize(new { error = message }));
        }
    }
}
