using KHSWeb.Models;
using KHSWeb.Services;
using System.Text.Json;
using Utils;

namespace KHSWeb.Endpoints;

public class AnalyticBatchEndpoint : WebEndpoint
{
    [System.Serializable]
    private class UnityAnalyticsEvent
    {
        public string key { get; set; } = string.Empty;
        public Dictionary<string, object> properties { get; set; } = new Dictionary<string, object>();
        public string project { get; set; } = string.Empty;
    }

    [System.Serializable]
    private class UnityAnalyticBatch
    {
        public List<UnityAnalyticsEvent> events { get; set; } = new List<UnityAnalyticsEvent>();
    }

    private readonly MongoService _mongoService = new();
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };
    
    public override string Path => "/api/analytics/batch";
    public override METHOD Method => METHOD.POST;
    
    public override Delegate Action => async (HttpContext context) =>
    {
        try
        {
            string requestBody = await new StreamReader(context.Request.Body).ReadToEndAsync();
            DebugUtils.Print($"Received batch request: {requestBody}");

            UnityAnalyticBatch unityRequest = JsonSerializer.Deserialize<UnityAnalyticBatch>(requestBody, _jsonOptions) ?? throw new InvalidOperationException();
            
            List<string> results = [];
            foreach (UnityAnalyticsEvent unityAnalyticsEvent in unityRequest.events)
            {
                AnalyticEventDocument analyticEvent = new AnalyticEventDocument
                {
                    Key = unityAnalyticsEvent.key,
                    PropertiesDict = unityAnalyticsEvent.properties,
                    ProjectId = unityAnalyticsEvent.project,
                    Timestamp = DateTime.UtcNow
                };

                string id = await _mongoService.InsertAnalyticsEventAsync(analyticEvent);
                results.Add(id);
            }

            DebugUtils.PrintSuccess($"Batch recorded: {unityRequest.events.Count} metrics");

            return Results.Ok(new { ids = results, success = true });
        }
        catch (Exception ex)
        {
            DebugUtils.PrintError($"Error recording batch metrics: {ex.Message}");
            return Results.Problem($"Error recording batch metrics: {ex.Message}");
        }
    };
}