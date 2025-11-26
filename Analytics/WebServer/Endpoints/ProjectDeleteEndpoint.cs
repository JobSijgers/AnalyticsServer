using KHSWeb.Services;
using Utils;
using MongoDB.Driver;
using KHSWeb.Models;

namespace KHSWeb.Endpoints
{
    public class ProjectDeleteEndpoint : WebEndpoint
    {
        private readonly MongoService _mongoService;

        public ProjectDeleteEndpoint()
        {
            _mongoService = new MongoService();
        }

        public override string Path => "/api/projects/delete";
        public override METHOD Method => METHOD.POST;
        public override Delegate Action => async (HttpContext context) =>
        {
            try
            {
                var request = await context.Request.ReadFromJsonAsync<DeleteProjectRequest>();
                if (request == null || string.IsNullOrEmpty(request.ProjectId))
                {
                    return Results.BadRequest(new { success = false, message = "Project ID is required" });
                }

                var database = Config.GetDatabase();
                var eventsCollection = database.GetCollection<AnalyticEventDocument>(Config.MetricsCollectionName);

                // Delete all events for this project
                var filter = Builders<AnalyticEventDocument>.Filter.Eq("ProjectId", request.ProjectId);
                var deleteResult = await eventsCollection.DeleteManyAsync(filter);

                DebugUtils.PrintSuccess($"Deleted project '{request.ProjectId}' - Removed {deleteResult.DeletedCount} events");

                return Results.Ok(new { 
                    success = true, 
                    message = $"Project deleted successfully. Removed {deleteResult.DeletedCount} events.",
                    deletedCount = deleteResult.DeletedCount 
                });
            }
            catch (Exception ex)
            {
                DebugUtils.PrintError($"Error deleting project: {ex.Message}");
                return Results.Problem($"Error deleting project: {ex.Message}");
            }
        };

        public class DeleteProjectRequest
        {
            public string ProjectId { get; set; } = string.Empty;
        }
    }
}