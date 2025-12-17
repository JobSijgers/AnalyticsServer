using KHSWeb.Repositories;
using Utils;
using MongoDB.Driver;
using KHSWeb.Models;

namespace KHSWeb.Endpoints;

public class ProjectDeleteEndpoint : WebEndpoint
{
    private const string HardcodedPasswordHash = "8c55b8a724c389f8cea8764c66424dedd59033ea7043b0c08e8d1f676fde5e8c";
    
    private readonly AnalyticsRepository _analyticsRepo;
    private readonly ChartConfigRepository _configRepo;
    private readonly ProjectImageRepository _imageRepo;

    public ProjectDeleteEndpoint(
        AnalyticsRepository analyticsRepo, 
        ChartConfigRepository configRepo, 
        ProjectImageRepository imageRepo)
    {
        _analyticsRepo = analyticsRepo;
        _configRepo = configRepo;
        _imageRepo = imageRepo;
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

            // 1. Delete Events
            // Accessing the collection directly via the repository to perform DeleteMany
            var eventsCollection = _analyticsRepo.GetCollection();
            var filter = Builders<AnalyticEventDocument>.Filter.Eq("ProjectId", request.ProjectId);
            var deleteResult = await eventsCollection.DeleteManyAsync(filter);

            // 2. Delete Configs
            long configsRemoved = await _configRepo.DeleteConfigsForProjectAsync(request.ProjectId);

            // 3. Delete Image
            bool imageDeleted = await _imageRepo.DeleteImageAsync(request.ProjectId);

            DebugUtils.PrintSuccess(
                $"Deleted project '{request.ProjectId}' - Removed {deleteResult.DeletedCount} events, {configsRemoved} chart configs, Image Deleted: {imageDeleted}");

            return Results.Ok(new
            {
                success = true,
                message =
                    $"Project deleted successfully. Removed {deleteResult.DeletedCount} events, {configsRemoved} configurations.",
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