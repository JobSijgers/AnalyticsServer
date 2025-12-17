using KHSWeb.Models;
using KHSWeb.Repositories;
using MongoDB.Bson; // Required for BsonTypeMapper

namespace KHSWeb.Endpoints;

public class DrillDownEndpoint : WebEndpoint
{
    public override string Path => "/api/dashboard/drill-down";
    public override METHOD Method => METHOD.GET;
    public override EndpointSecurity Security => EndpointSecurity.Public; 
    
    private readonly AnalyticsRepository _repo;

    public DrillDownEndpoint(AnalyticsRepository repo)
    {
        _repo = repo;
    }

    public override Delegate Action => async (HttpContext context) =>
    {
        try
        {
            var projectId = context.Request.Query["projectId"].ToString();
            var eventKey = context.Request.Query["eventKey"].ToString(); // Allow empty
            var propertyName = context.Request.Query["propertyName"].ToString();
            var chartType = context.Request.Query["chartType"].ToString();
            var label = context.Request.Query["label"].ToString();
            var datasetLabel = context.Request.Query["datasetLabel"].ToString();
            var filtersJson = context.Request.Query["filtersJson"].ToString();

            if (string.IsNullOrEmpty(projectId))
            {
                return Results.Json(new ApiResponse<object> { Success = false, Message = "Project ID is required" }, statusCode: 400);
            }

            var events = await _repo.GetDrillDownEventsAsync(projectId, eventKey, propertyName, label, datasetLabel, chartType, filtersJson);

            // Map BSON to standard .NET types for JSON serialization
            var cleanEvents = events.Select(e => new 
            {
                e.Id,
                e.Key,
                e.Timestamp,
                Properties = e.Properties != null 
                    ? BsonTypeMapper.MapToDotNetValue(e.Properties) 
                    : null
            }).ToList();

            return Results.Json(new ApiResponse<object>
            {
                Success = true,
                Data = cleanEvents
            });
        }
        catch (Exception ex)
        {
            return Results.Json(new ApiResponse<object> { Success = false, Message = ex.Message }, statusCode: 500);
        }
    };
}