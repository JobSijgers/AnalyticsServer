using Microsoft.AspNetCore.Http;
using System.Text.Json;
using System.Threading.Tasks;
using Utils;
using KHSAnalytics.KHSAnalytics.KHSAnalytics;

namespace KHSWeb
{
    public class FetchConfigsDeleteEndpoint : WebEndpoint
    {
        private static readonly Delegate _action = new Func<HttpContext, Task>(HandleDeleteRequest);

        public override string Path => "/fetch-configs";
        public override METHOD Method => METHOD.DELETE;
        public override Delegate Action => _action;

        private static async Task HandleDeleteRequest(HttpContext context)
        {
            if (!await Authenticate(context)) return;

            try
            {
                DebugUtils.Print("Processing delete fetch config request");
                using var reader = new StreamReader(context.Request.Body);
                string body = await reader.ReadToEndAsync();

                var service = KHS.Program.AnalyticsService;
                var requestData = JsonSerializer.Deserialize<DeleteRequestData>(body, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                if (requestData?.Index >= 0 && requestData.Index < service.FetchRequests.Count)
                {
                    service.FetchRequests.RemoveAt(requestData.Index);
                    SaveFetchRequests(service.FetchRequests);
                    service.ReloadFetchRequests();
                    context.Response.StatusCode = StatusCodes.Status200OK;
                    await context.Response.WriteAsync(JsonSerializer.Serialize(new { message = "Request deleted successfully" }));
                }
                else
                {
                    context.Response.StatusCode = StatusCodes.Status400BadRequest;
                    await context.Response.WriteAsync(JsonSerializer.Serialize(new { message = "Invalid index" }));
                }
            }
            catch (JsonException)
            {
                context.Response.StatusCode = StatusCodes.Status400BadRequest;
                await context.Response.WriteAsync(JsonSerializer.Serialize(new { message = "Invalid JSON format" }));
            }
            catch (Exception ex)
            {
                DebugUtils.PrintError($"Fetch configs DELETE error: {ex.Message}");
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

        private class DeleteRequestData
        {
            public int Index { get; set; } = -1;
        }
    }
}