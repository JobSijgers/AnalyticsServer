using KHSWeb.Models;
using KHSWeb.Services;
using Utils;
using MongoDB.Bson; // Required for BsonTypeMapper

namespace KHSWeb.Endpoints;

public class DrillDownEndpoint : WebEndpoint
{
    public override string Path => "/api/dashboard/drill-down";
    public override METHOD Method => METHOD.GET;
    public override EndpointSecurity Security => EndpointSecurity.Public; 
    
    private readonly MongoService _mongoService = new();

    public override Delegate Action => async (HttpContext context) =>
    {
        try
        {
            var projectId = context.Request.Query["projectId"].ToString();
            
            // Allow eventKey to be empty (for "All Recent" view)
            var eventKey = context.Request.Query["eventKey"].ToString();
            
            var propertyName = context.Request.Query["propertyName"].ToString();
            var chartType = context.Request.Query["chartType"].ToString();
            var label = context.Request.Query["label"].ToString();
            var datasetLabel = context.Request.Query["datasetLabel"].ToString();
            var filtersJson = context.Request.Query["filtersJson"].ToString();

            // validation: Only ProjectId is strictly required now
            if (string.IsNullOrEmpty(projectId))
            {
                return Results.Json(new ApiResponse<object> { Success = false, Message = "Project ID is required" }, statusCode: 400);
            }

            // 1. Get the raw events
            var events = await _mongoService.GetDrillDownEventsAsync(projectId, eventKey, propertyName, label, datasetLabel, chartType, filtersJson);

            // 2. Map BSON to standard .NET types
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