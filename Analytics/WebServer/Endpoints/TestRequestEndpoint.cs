using Microsoft.AspNetCore.Http;
using System.Text.Json;
using System.Threading.Tasks;
using Utils;
using System.Net;

namespace KHSWeb
{
    public class TestRequestEndpoint : WebEndpoint
    {
        private static readonly Delegate _action = new Func<HttpContext, Task>(HandleTestRequest);

        public override string Path => "/test-request";
        public override METHOD Method => METHOD.POST;
        public override Delegate Action => _action;

        private static async Task HandleTestRequest(HttpContext context)
        {
            if (!await Authenticate(context)) return;

            try
            {
                DebugUtils.Print("Processing test request");
                using var reader = new StreamReader(context.Request.Body);
                string body = await reader.ReadToEndAsync();

                var requestData = JsonSerializer.Deserialize<TestRequestData>(body, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                if (requestData == null || string.IsNullOrEmpty(requestData.ProjectId) || 
                    string.IsNullOrEmpty(requestData.EnvironmentId) || string.IsNullOrEmpty(requestData.SqlQuery))
                {
                    context.Response.StatusCode = StatusCodes.Status400BadRequest;
                    await context.Response.WriteAsync("Invalid request data: ProjectId, EnvironmentId, and SqlQuery are required");
                    return;
                }

                var service = KHS.Program.AnalyticsService;
                
                try
                {
                    var result = await service.ExecuteAnalyticsQuery(
                        projectId: requestData.ProjectId,
                        environmentId: requestData.EnvironmentId,
                        chartName: "sql_de", // Hardcoded chart name
                        bearerToken: Config.BearerToken,
                        sqlQuery: requestData.SqlQuery,
                        ct: default(CancellationToken)
                    );

                    context.Response.ContentType = "application/json";
                    context.Response.StatusCode = StatusCodes.Status200OK;
                    await context.Response.WriteAsync(result);
                }
                catch (HttpRequestException httpEx) when (httpEx.StatusCode == HttpStatusCode.Forbidden)
                {
                    DebugUtils.PrintError($"Authentication failed: Bearer token may be expired or invalid");
                    context.Response.StatusCode = StatusCodes.Status400BadRequest;
                    await context.Response.WriteAsync($"Authentication failed: Bearer token may be expired or invalid. Please check the token in Config.cs");
                }
                catch (HttpRequestException httpEx)
                {
                    DebugUtils.PrintError($"HTTP error: {httpEx.Message} (Status: {httpEx.StatusCode})");
                    context.Response.StatusCode = StatusCodes.Status400BadRequest;
                    await context.Response.WriteAsync($"HTTP error: {httpEx.Message} (Status: {httpEx.StatusCode})");
                }
            }
            catch (JsonException)
            {
                context.Response.StatusCode = StatusCodes.Status400BadRequest;
                await context.Response.WriteAsync("Invalid JSON format");
            }
            catch (Exception ex)
            {
                DebugUtils.PrintError($"Test request error: {ex.Message}");
                context.Response.StatusCode = StatusCodes.Status500InternalServerError;
                await context.Response.WriteAsync($"Internal server error: {ex.Message}");
            }
        }

        private static async Task<bool> Authenticate(HttpContext context)
        {
            if (!context.Request.Headers.TryGetValue("Authorization", out var authHeader) || 
                !authHeader.ToString().StartsWith("Bearer "))
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await context.Response.WriteAsync("Unauthorized");
                return false;
            }

            var token = authHeader.ToString().Substring("Bearer ".Length);
            if (!TokenManager.IsTokenValid(token))
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await context.Response.WriteAsync("Invalid token");
                return false;
            }

            TokenManager.RefreshToken(token); // Extend session
            return true;
        }

        private class TestRequestData
        {
            public string ProjectId { get; set; } = string.Empty;
            public string EnvironmentId { get; set; } = string.Empty;
            public string SqlQuery { get; set; } = string.Empty;
        }
    }
}