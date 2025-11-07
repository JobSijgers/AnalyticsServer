using Microsoft.AspNetCore.Http;
using System.Text.Json;
using System.Threading.Tasks;
using Utils;

namespace KHSWeb
{
    /// <summary>
    /// Handles the /login POST request for user authentication.
    /// </summary>
    public class AuthTokenEndpoint : WebEndpoint
    {
        // Define the action delegate
        private static readonly Delegate _action = new Func<HttpContext, Task>(HandleLoginRequest);

        public override string Path => "/auth";
        public override METHOD Method => METHOD.POST;
        public override Delegate Action => _action;

        private static async Task HandleLoginRequest(HttpContext context)
        {
            try
            {
                DebugUtils.Print("Checking auth token request");
                using var reader = new StreamReader(context.Request.Body);
                string body = await reader.ReadToEndAsync();

                var loginData = JsonSerializer.Deserialize<AuthToken>(body) ?? new AuthToken();

                bool isValid = TokenManager.IsTokenValid(loginData.token);
                var response = new { message = isValid ? "Token valid" : "Token expired" };
                string jsonResponse = JsonSerializer.Serialize(response);
                byte[] buffer = System.Text.Encoding.UTF8.GetBytes(jsonResponse);

                context.Response.ContentType = "application/json";
                context.Response.StatusCode = isValid ? StatusCodes.Status200OK : StatusCodes.Status401Unauthorized;
                await context.Response.Body.WriteAsync(buffer, 0, buffer.Length);
            }
            catch (Exception ex)
            {
                DebugUtils.PrintError($"auth endpoint error: {ex.Message}");
                context.Response.StatusCode = StatusCodes.Status500InternalServerError;
                await context.Response.WriteAsync(JsonSerializer.Serialize(new { message = "Internal server error" }));
            }
        }

        // Data model for deserialization
        private class AuthToken
        {
            public string token { get; set; }
        }
    }
}