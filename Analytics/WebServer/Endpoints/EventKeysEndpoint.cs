using KHSWeb.Models;
using MongoDB.Driver;
using Utils;

namespace KHSWeb.Endpoints;

public class EventKeysEndpoint : WebEndpoint
{
    public override string Path => "/api/events/keys";
    public override METHOD Method => METHOD.GET;
    
    public override Delegate Action => async (HttpContext context) =>
    {
        try
        {
            var projectId = context.Request.Query["projectId"].ToString();

            if (string.IsNullOrEmpty(projectId))
            {
                return Results.Json(new ApiResponse<EventKeysResponse> 
                { 
                    Success = false, 
                    Message = "ProjectId is required" 
                }, statusCode: 400);
            }

            var database = Config.GetDatabase();
            var collection = database.GetCollection<AnalyticEventDocument>(Config.MetricsCollectionName);

            var filter = Builders<AnalyticEventDocument>.Filter.Eq(x => x.ProjectId, projectId);
            
            // Get distinct event keys
            var eventKeys = await collection
                .Distinct<string>("Key", filter)
                .ToListAsync();

            return Results.Json(new ApiResponse<EventKeysResponse>
            {
                Success = true,
                Data = new EventKeysResponse { EventKeys = eventKeys.OrderBy(k => k).ToList() }
            });
        }
        catch (Exception ex)
        {
            DebugUtils.PrintError($"Error getting event keys: {ex.Message}");
            return Results.Json(new ApiResponse<EventKeysResponse>
            {
                Success = false,
                Message = $"Error getting event keys: {ex.Message}"
            }, statusCode: 500);
        }
    };
}