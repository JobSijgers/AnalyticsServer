using KHSWeb.Services;
using Utils;
using MongoDB.Driver;
using KHSWeb.Models;

namespace KHSWeb.Endpoints
{
    public class ProjectDeleteEndpoint : WebEndpoint
    {
        private const string HardcodedPasswordHash = "8c55b8a724c389f8cea8764c66424dedd59033ea7043b0c08e8d1f676fde5e8c";
        private readonly ChartConfigService _configService;

        public ProjectDeleteEndpoint()
        {
            _configService = new ChartConfigService();
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

                if (string.IsNullOrEmpty(request.PasswordHash) || request.PasswordHash != HardcodedPasswordHash)
                {
                    return Results.Json(new { success = false, message = "Invalid deletion password." }, statusCode: 403);
                }

                // 1. Delete Events from MongoDB
                var database = Config.GetDatabase();
                var eventsCollection = database.GetCollection<AnalyticEventDocument>(Config.MetricsCollectionName);

                var filter = Builders<AnalyticEventDocument>.Filter.Eq("ProjectId", request.ProjectId);
                var deleteResult = await eventsCollection.DeleteManyAsync(filter);

                // 2. Delete Configurations from JSON
                var allConfigs = await _configService.LoadAllConfigs();
                int configsRemoved = allConfigs.RemoveAll(c => c.ProjectId == request.ProjectId);
                
                if (configsRemoved > 0)
                {
                    await _configService.SaveAllConfigs(allConfigs);
                }

                // 3. Delete Project Image
                bool imageDeleted = false;
                try 
                {
                    var basePath = System.AppContext.BaseDirectory;
                    var imagePath = System.IO.Path.Combine(basePath, "Data", "ProjectImages", $"{request.ProjectId}.jpg");
                    
                    if (System.IO.File.Exists(imagePath))
                    {
                        System.IO.File.Delete(imagePath);
                        imageDeleted = true;
                    }
                }
                catch (Exception imgEx)
                {
                    DebugUtils.PrintError($"Could not delete image for project {request.ProjectId}: {imgEx.Message}");
                    // We don't fail the whole request if just the image fails, but we log it.
                }

                DebugUtils.PrintSuccess($"Deleted project '{request.ProjectId}' - Removed {deleteResult.DeletedCount} events, {configsRemoved} chart configs, Image Deleted: {imageDeleted}");

                return Results.Ok(new { 
                    success = true, 
                    message = $"Project deleted successfully. Removed {deleteResult.DeletedCount} events, {configsRemoved} configurations.",
                    deletedCount = deleteResult.DeletedCount,
                    configsRemoved = configsRemoved,
                    imageDeleted = imageDeleted
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
            public string PasswordHash { get; set; } = string.Empty;
        }
    }
}