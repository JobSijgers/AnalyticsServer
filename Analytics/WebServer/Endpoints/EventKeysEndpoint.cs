using KHSWeb.Models;
using MongoDB.Driver;
using Utils;
using System.Linq;

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
            
            var database = Config.GetDatabase();
            var collection = database.GetCollection<AnalyticEventDocument>(Config.MetricsCollectionName);
            
            List<string> keys;

            if (projectId == "GLOBAL")
            {
                keys = await collection.Aggregate()
                    .Group(x => x.Key, g => new 
                    { 
                        Key = g.Key, 
                        ProjectIds = g.Select(x => x.ProjectId).Distinct() 
                    })
                    .Match(x => x.ProjectIds.Count() >= 2)
                    .Project(x => x.Key)
                    .ToListAsync();
            }
            else if (!string.IsNullOrEmpty(projectId))
            {
                var filter = Builders<AnalyticEventDocument>.Filter.Eq(x => x.ProjectId, projectId);
                keys = await collection.Distinct(x => x.Key, filter).ToListAsync();
            }
            else
            {
                return Results.Json(new ApiResponse<object> { Success = false, Message = "ProjectId required" }, statusCode: 400);
            }
            
            keys.Sort();

            return Results.Json(new ApiResponse<object>
            {
                Success = true,
                Data = new { eventKeys = keys }
            });
        }
        catch (Exception ex)
        {
            return Results.Json(new ApiResponse<object> { Success = false, Message = ex.Message }, statusCode: 500);
        }
    };
}