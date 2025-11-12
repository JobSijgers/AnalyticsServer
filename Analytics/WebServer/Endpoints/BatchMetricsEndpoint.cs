using KHSWeb.Models;
using KHSWeb.Services;
using System.Text.Json;
using Utils;

namespace KHSWeb.Endpoints;

public class BatchMetricsEndpoint : WebEndpoint
{
    [System.Serializable]
    private class UnityMetricRequest
    {
        public string metricKey { get; set; }
        public int amount { get; set; }
        public Dictionary<string, object> properties { get; set; }
        public Dictionary<string, object> metadata { get; set; }
        public string category { get; set; }
        public string source { get; set; }
        public string projectId { get; set; }
    }

    [System.Serializable]
    private class UnityBatchMetricRequest
    {
        public List<UnityMetricRequest> metrics { get; set; }
    }

    private readonly MongoService _mongoService;

    public BatchMetricsEndpoint()
    {
        _mongoService = new MongoService();
    }

    public override string Path => "/api/metrics/batch";
    public override METHOD Method => METHOD.POST;
    public override Delegate Action => async (HttpContext context) =>
    {
        try
        {
            var requestBody = await new StreamReader(context.Request.Body).ReadToEndAsync();
            DebugUtils.Print($"Received batch request: {requestBody}");

            var unityRequest = JsonSerializer.Deserialize<UnityBatchMetricRequest>(requestBody, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });
            
            var results = new List<string>();
            foreach (var unityMetric in unityRequest.metrics)
            {
                var metric = new MetricDocument
                {
                    MetricKey = unityMetric.metricKey,
                    Value = MetricValue.Create(unityMetric.amount), 
                    Properties = unityMetric.properties ?? new Dictionary<string, object>(),
                    Metadata = unityMetric.metadata ?? new Dictionary<string, object>(),
                    Category = unityMetric.category,
                    Source = unityMetric.source,
                    ProjectId = unityMetric.projectId ?? "default-project",
                    Timestamp = DateTime.UtcNow
                };

                var id = await _mongoService.InsertMetricAsync(metric);
                results.Add(id);
            }

            DebugUtils.PrintSuccess($"Batch recorded: {unityRequest.metrics.Count} metrics");
            return Results.Ok(new { ids = results, success = true });
        }
        catch (Exception ex)
        {
            DebugUtils.PrintError($"Error recording batch metrics: {ex.Message}");
            return Results.Problem($"Error recording batch metrics: {ex.Message}");
        }
    };
}