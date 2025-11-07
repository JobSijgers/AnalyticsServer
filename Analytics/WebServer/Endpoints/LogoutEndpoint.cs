// LogoutEndpoint.cs
using Microsoft.AspNetCore.Http;
using System.Text.Json;
using System.Threading.Tasks;
using Utils;

namespace KHSWeb
{
    public class LogoutEndpoint : WebEndpoint
    {
        private static readonly Delegate _action = new Func<HttpContext, Task>(HandleLogoutRequest);

        public override string Path => "/logout";
        public override METHOD Method => METHOD.POST;
        public override Delegate Action => _action;

        private static async Task HandleLogoutRequest(HttpContext context)
        {
            try
            {
                if (context.Request.Headers.TryGetValue("Authorization", out var authHeader) &&
                    authHeader.ToString().StartsWith("Bearer "))
                {
                    var token = authHeader.ToString().Substring("Bearer ".Length);
                    TokenManager.InvalidateToken(token);
                }

                var response = new { message = "Logged out successfully" };
                string jsonResponse = JsonSerializer.Serialize(response);
                context.Response.ContentType = "application/json";
                context.Response.StatusCode = StatusCodes.Status200OK;
                await context.Response.WriteAsync(jsonResponse);
            }
            catch (Exception ex)
            {
                DebugUtils.PrintError($"Logout endpoint error: {ex.Message}");
                context.Response.StatusCode = StatusCodes.Status500InternalServerError;
                await context.Response.WriteAsync(JsonSerializer.Serialize(new { message = "Internal server error" }));
            }
        }
    }
}