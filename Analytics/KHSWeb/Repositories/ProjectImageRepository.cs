using MongoDB.Driver;
using MongoDB.Bson.Serialization.Attributes;
using Utils;

namespace KHSWeb.Repositories;

public class ProjectImageRepository
{
    private readonly IMongoCollection<ProjectImageDocument> _images;

    public ProjectImageRepository()
    {
        var database = Config.GetDatabase();
        _images = database.GetCollection<ProjectImageDocument>(Config.ProjectImagesCollectionName);
    }

    public async Task<byte[]?> GetImageAsync(string projectId)
    {
        try
        {
            var doc = await _images.Find(x => x.ProjectId == projectId).FirstOrDefaultAsync();
            return doc?.ImageData;
        }
        catch (Exception ex)
        {
            DebugUtils.PrintError($"Error retrieving image for project {projectId}: {ex.Message}");
            return null;
        }
    }

    public async Task SaveImageAsync(string projectId, byte[] imageData)
    {
        try
        {
            var doc = new ProjectImageDocument
            {
                ProjectId = projectId,
                ImageData = imageData,
                UpdatedAt = DateTime.UtcNow
            };

            await _images.ReplaceOneAsync(
                x => x.ProjectId == projectId,
                doc,
                new ReplaceOptions { IsUpsert = true }
            );
        }
        catch (Exception ex)
        {
            DebugUtils.PrintError($"Error saving image for project {projectId}: {ex.Message}");
            throw;
        }
    }

    public async Task<bool> DeleteImageAsync(string projectId)
    {
        try
        {
            var result = await _images.DeleteOneAsync(x => x.ProjectId == projectId);
            return result.DeletedCount > 0;
        }
        catch (Exception ex)
        {
            DebugUtils.PrintError($"Error deleting image for project {projectId}: {ex.Message}");
            return false;
        }
    }
}

public class ProjectImageDocument
{
    [BsonId] public string ProjectId { get; set; } = string.Empty;
    public byte[] ImageData { get; set; } = Array.Empty<byte>();
    public DateTime UpdatedAt { get; set; }
}