using Microsoft.AspNetCore.Http;
using System.Text.Json;
using System.Threading.Tasks;
using Utils;

namespace KHSWeb
{
    /// <summary>
    /// Handles the /login POST request for user authentication.
    /// </summary>
    public class LoginEndpoint : WebEndpoint
    {
        // Define the action delegate
        private static readonly Delegate _action = new Func<HttpContext, Task>(HandleLoginRequest);

        public override string Path => "/login";
        public override METHOD Method => METHOD.POST;
        public override Delegate Action => _action;

        private static async Task HandleLoginRequest(HttpContext context)
        {
            try
            {
                DebugUtils.Print("Processing login request");
                using var reader = new StreamReader(context.Request.Body);
                string body = await reader.ReadToEndAsync();

                var loginData = JsonSerializer.Deserialize<LoginData>(body) ?? new LoginData();
                string username = loginData.username ?? "";
                string password = loginData.password ?? "";

                bool isValid = username == Config.Username && password == Config.Password;

                string UUID = TokenManager.CreateToken();
                var response = new { message = isValid ? UUID : "Invalid credentials" };
                string jsonResponse = JsonSerializer.Serialize(response);
                byte[] buffer = System.Text.Encoding.UTF8.GetBytes(jsonResponse);

                context.Response.ContentType = "application/json";
                context.Response.StatusCode = isValid ? StatusCodes.Status200OK : StatusCodes.Status401Unauthorized;
                await context.Response.Body.WriteAsync(buffer, 0, buffer.Length);
            }
            catch (Exception ex)
            {
                DebugUtils.PrintError($"Login endpoint error: {ex.Message}");
                context.Response.StatusCode = StatusCodes.Status500InternalServerError;
                await context.Response.WriteAsync(JsonSerializer.Serialize(new { message = "Internal server error" }));
            }
        }

        // Data model for deserialization
        private class LoginData
        {
            public string username { get; set; }
            public string password { get; set; }
        }
    }
}