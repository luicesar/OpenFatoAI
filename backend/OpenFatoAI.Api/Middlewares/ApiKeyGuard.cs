using System.Security.Cryptography;
using System.Text;

namespace OpenFatoAI.Api.Middlewares;

/// <summary>
/// Protects administrative writes (e.g. PUT /api/settings/{key}) with a shared key from
/// configuration (Security:ApiKey), sent in the X-Api-Key header. When no key is configured
/// the protected operations are disabled — there are no user accounts to fall back on.
/// </summary>
public static class ApiKeyGuard
{
    public const string HeaderName = "X-Api-Key";

    public static bool IsConfigured(IConfiguration config) =>
        !string.IsNullOrWhiteSpace(config["Security:ApiKey"]);

    public static bool IsAuthorized(HttpRequest request, IConfiguration config)
    {
        var expected = config["Security:ApiKey"];
        if (string.IsNullOrWhiteSpace(expected)) return false;

        var provided = request.Headers[HeaderName].ToString();
        if (string.IsNullOrEmpty(provided)) return false;

        // Constant-time comparison; hashing equalizes the lengths
        return CryptographicOperations.FixedTimeEquals(
            SHA256.HashData(Encoding.UTF8.GetBytes(provided)),
            SHA256.HashData(Encoding.UTF8.GetBytes(expected)));
    }
}
