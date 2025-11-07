using Microsoft.AspNetCore.Http;
using System.Text.Json;
using System.Threading.Tasks;
using Utils;
using KHSAnalytics.KHSAnalytics.KHSAnalytics;

namespace KHSWeb
{
    public class FetchConfigsPostEndpoint : WebEndpoint
    {
        private static readonly Delegate _action = new Func<HttpContext, Task>(HandlePostRequest);

        public override string Path => "/fetch-configs";
        public override METHOD Method => METHOD.POST;
        public override Delegate Action => _action;

        private static async Task HandlePostRequest(HttpContext context)
        {
            if (!await Authenticate(context)) return;

            try
            {
                DebugUtils.Print("Adding new fetch config");
                using var reader = new StreamReader(context.Request.Body);
                string body = await reader.ReadToEndAsync();

                var newRequest = JsonSerializer.Deserialize<FetchRequest>(body, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true,
                    PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                });

                if (newRequest == null)
                {
                    context.Response.StatusCode = StatusCodes.Status400BadRequest;
                    await context.Response.WriteAsync(JsonSerializer.Serialize(new { message = "Invalid request data" }));
                    return;
                }

                var service = KHS.Program.AnalyticsService;
                service.FetchRequests.Add(newRequest);
                SaveFetchRequests(service.FetchRequests);
                service.ReloadFetchRequests(); // Ensure service has latest data

                context.Response.StatusCode = StatusCodes.Status200OK;
                await context.Response.WriteAsync(JsonSerializer.Serialize(new { message = "Request added successfully" }));
            }
            catch (JsonException)
            {
                context.Response.StatusCode = StatusCodes.Status400BadRequest;
                await context.Response.WriteAsync(JsonSerializer.Serialize(new { message = "Invalid JSON format" }));
            }
            catch (Exception ex)
            {
                DebugUtils.PrintError($"Fetch configs POST error: {ex.Message}");
                context.Response.StatusCode = StatusCodes.Status500InternalServerError;
                await context.Response.WriteAsync(JsonSerializer.Serialize(new { message = "Internal server error" }));
            }
        }

        private static async Task<bool> Authenticate(HttpContext context)
        {
            if (!context.Request.Headers.TryGetValue("Authorization", out var authHeader) || 
                !authHeader.ToString().StartsWith("Bearer "))
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await context.Response.WriteAsync(JsonSerializer.Serialize(new { message = "Unauthorized" }));
                return false;
            }

            var token = authHeader.ToString().Substring("Bearer ".Length);
            if (!TokenManager.IsTokenValid(token))
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await context.Response.WriteAsync(JsonSerializer.Serialize(new { message = "Invalid token" }));
                return false;
            }

            TokenManager.RefreshToken(token); // Extend session
            return true;
        }

        private static void SaveFetchRequests(List<FetchRequest> requests)
        {
            try
            {
                var data = new { fetchRequests = requests };
                var json = JsonSerializer.Serialize(data, new JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(Config.FetchConfigsPath, json);
                DebugUtils.Print($"Saved {requests.Count} fetch requests to {Config.FetchConfigsPath}");
            }
            catch (Exception ex)
            {
                DebugUtils.PrintError($"Error saving fetch configs: {ex.Message}");
                throw;
            }
        }
    }
}