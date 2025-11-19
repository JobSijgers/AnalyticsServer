// Add this to EventConfigEndpoint.cs temporarily

using KHSWeb;
using MongoDB.Driver;

public class DebugEventConfigEndpoint : WebEndpoint
{
    public override string Path => "/api/debug/event-configs";
    public override METHOD Method => METHOD.GET;
    
    public override Delegate Action => async (HttpContext context) =>
    {
        try
        {
            var projectId = context.Request.Query["projectId"].ToString();
            
            var database = Config.GetDatabase();
            var collection = database.GetCollection<EventDisplayConfig>("EventDisplayConfigs");

            // Check if collection exists and get all configs
            var allConfigs = await collection.Find(_ => true).ToListAsync();
            var projectConfigs = await collection.Find(c => c.ProjectId == projectId).ToListAsync();

            return Results.Json(new 
            {
                success = true,
                totalConfigs = allConfigs.Count,
                projectConfigs = projectConfigs,
                allConfigs = allConfigs
            });
        }
        catch (Exception ex)
        {
            return Results.Json(new { success = false, error = ex.Message });
        }
    };
}