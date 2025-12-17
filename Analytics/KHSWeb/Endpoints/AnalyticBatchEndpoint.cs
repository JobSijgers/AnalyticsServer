using KHSWeb.Services;
using System.Text.Json;
using KHSWeb.Models;
using Utils;

namespace KHSWeb.Endpoints;

public class AnalyticBatchEndpoint : WebEndpoint
{
    private readonly AnalyticsQueue _queue;
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public AnalyticBatchEndpoint(AnalyticsQueue queue)
    {
        _queue = queue;
    }

    public override string Path => "/api/analytics/batch";
    public override METHOD Method => METHOD.POST;
    public override EndpointSecurity Security => EndpointSecurity.Unity;
    
    public override Delegate Action => async (HttpContext context) =>
    {
        try
        {
            string requestBody = await new StreamReader(context.Request.Body).ReadToEndAsync();

            UnityAnalyticBatch unityRequest =
                JsonSerializer.Deserialize<UnityAnalyticBatch>(requestBody, _jsonOptions) ??
                throw new InvalidOperationException();

            if (unityRequest.events == null || unityRequest.events.Count == 0)
            {
                return Results.Ok(new { success = true, message = "No events to process" });
            }

            _queue.EnqueueBatch(unityRequest);
            
            DebugUtils.Print($"Queued batch request with {unityRequest.events.Count} events");

            return Results.Ok(new
            {
                success = true,
                message = "Batch queued for processing",
                count = unityRequest.events.Count
            });
        }
        catch (Exception ex)
        {
            DebugUtils.PrintError($"Error queuing batch metrics: {ex.Message}");
            return Results.Problem($"Error queuing batch metrics: {ex.Message}");
        }
    };
}