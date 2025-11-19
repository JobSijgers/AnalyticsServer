using KHSWeb.Models;
using MongoDB.Driver;
using Utils;

namespace KHSWeb.Endpoints;

public class EventPropertiesEndpoint : WebEndpoint
{
    public override string Path => "/api/events/properties";
    public override METHOD Method => METHOD.GET;
    
    public override Delegate Action => async (HttpContext context) =>
    {
        try
        {
            var projectId = context.Request.Query["projectId"].ToString();
            var eventKey = context.Request.Query["eventKey"].ToString();

            if (string.IsNullOrEmpty(projectId) || string.IsNullOrEmpty(eventKey))
            {
                return Results.Json(new ApiResponse<EventPropertiesResponse> 
                { 
                    Success = false, 
                    Message = "ProjectId and EventKey are required" 
                }, statusCode: 400);
            }

            var database = Config.GetDatabase();
            var collection = database.GetCollection<AnalyticEventDocument>(Config.MetricsCollectionName);

            var filter = Builders<AnalyticEventDocument>.Filter.And(
                Builders<AnalyticEventDocument>.Filter.Eq(x => x.ProjectId, projectId),
                Builders<AnalyticEventDocument>.Filter.Eq(x => x.Key, eventKey)
            );

            // Get sample events to extract property keys
            var sampleEvents = await collection.Find(filter)
                .Limit(50)
                .ToListAsync();

            var propertyKeys = new HashSet<string>();
            foreach (var eventDoc in sampleEvents)
            {
                foreach (var key in eventDoc.PropertiesDict.Keys)
                {
                    propertyKeys.Add(key);
                }
            }

            return Results.Json(new ApiResponse<EventPropertiesResponse>
            {
                Success = true,
                Data = new EventPropertiesResponse { PropertyKeys = propertyKeys.OrderBy(k => k).ToList() }
            });
        }
        catch (Exception ex)
        {
            DebugUtils.PrintError($"Error getting event properties: {ex.Message}");
            return Results.Json(new ApiResponse<EventPropertiesResponse>
            {
                Success = false,
                Message = $"Error getting event properties: {ex.Message}"
            }, statusCode: 500);
        }
    };
}