using KHSWeb.Models;
using KHSWeb.Services;
using MongoDB.Driver;
using Utils;

namespace KHSWeb.Endpoints
{
    public class ProjectsEndpoint : WebEndpoint
    {
        private readonly MongoService _mongoService;

        public ProjectsEndpoint()
        {
            _mongoService = new MongoService();
        }

        public override string Path => "/api/projects";
        public override METHOD Method => METHOD.GET;
        public override Delegate Action => async (HttpContext context) =>
        {
            try
            {
                var database = Config.GetDatabase();
                var collection = database.GetCollection<MetricDocument>(Config.MetricsCollectionName);
                
                // Get distinct projects
                var projects = await collection
                    .Distinct<string>("ProjectId", FilterDefinition<MetricDocument>.Empty)
                    .ToListAsync();

                DebugUtils.PrintSuccess($"Retrieved {projects.Count} projects");
                return Results.Ok(new { projects });
            }
            catch (Exception ex)
            {
                DebugUtils.PrintError($"Error retrieving projects: {ex.Message}");
                return Results.Problem($"Error retrieving projects: {ex.Message}");
            }
        };
    }
}