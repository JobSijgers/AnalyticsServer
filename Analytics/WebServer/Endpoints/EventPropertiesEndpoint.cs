using KHSWeb.Models;
using MongoDB.Driver;

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
                return Results.Json(new ApiResponse<object> { Success = false, Message = "Missing parameters" }, statusCode: 400);
            }
            
            var database = Config.GetDatabase();
            var collection = database.GetCollection<AnalyticEventDocument>(Config.MetricsCollectionName);
            
            var filterBuilder = Builders<AnalyticEventDocument>.Filter;
            var filter = filterBuilder.Eq(x => x.Key, eventKey);

            if (projectId != "GLOBAL")
            {
                filter = filterBuilder.And(filter, filterBuilder.Eq(x => x.ProjectId, projectId));
            }

            var recentEvents = await collection.Find(filter)
                .SortByDescending(x => x.Timestamp)
                .Limit(50)
                .ToListAsync();

            var propertyKeys = new HashSet<string>();

            foreach (var evt in recentEvents)
            {
                if (evt.PropertiesDict != null)
                {
                    foreach (var key in evt.PropertiesDict.Keys)
                    {
                        propertyKeys.Add(key);
                    }
                }
            }
            
            var sortedKeys = propertyKeys.OrderBy(x => x).ToList();

            return Results.Json(new ApiResponse<object>
            {
                Success = true,
                Data = new { propertyKeys = sortedKeys }
            });
        }
        catch (Exception ex)
        {
            return Results.Json(new ApiResponse<object> { Success = false, Message = ex.Message }, statusCode: 500);
        }
    };
}