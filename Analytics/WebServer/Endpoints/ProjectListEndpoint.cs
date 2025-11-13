using KHSWeb.Services;
using Utils;
using System.Text.Json;

namespace KHSWeb.Endpoints
{
    public class ProjectListEndpoint : WebEndpoint
    {
        private readonly MongoService _mongoService;

        public ProjectListEndpoint()
        {
            _mongoService = new MongoService();
        }

        public override string Path => "/api/projects";
        public override METHOD Method => METHOD.GET;
        public override Delegate Action => async (HttpContext context) =>
        {
            try
            {
                var projects = await _mongoService.GetProjectsAsync();
                DebugUtils.PrintSuccess($"Retrieved {projects.Count} projects");
                return Results.Ok(new { projects, success = true });
            }
            catch (Exception ex)
            {
                DebugUtils.PrintError($"Error retrieving projects: {ex.Message}");
                return Results.Problem($"Error retrieving projects: {ex.Message}");
            }
        };
    }
}