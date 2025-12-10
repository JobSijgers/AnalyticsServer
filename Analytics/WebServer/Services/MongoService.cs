using MongoDB.Driver;
using KHSWeb.Models;
using System.Text.Json;
using Utils; // Added to access DebugUtils

namespace KHSWeb.Services;

public class MongoService
{
    private readonly IMongoCollection<AnalyticEventDocument> events;

    public MongoService()
    {
        var database = Config.GetDatabase();
        events = database.GetCollection<AnalyticEventDocument>(Config.MetricsCollectionName);
    }

    public async Task EnsureIndexesAsync()
    {
        try
        {
            var indexKeys = Builders<AnalyticEventDocument>.IndexKeys
                .Ascending(x => x.Key)
                .Ascending(x => x.ProjectId)
                .Ascending(x => x.Timestamp);

            var indexModel = new CreateIndexModel<AnalyticEventDocument>(
                indexKeys,
                new CreateIndexOptions { Name = "Key_Project_Time_Idx" }
            );

            await events.Indexes.CreateOneAsync(indexModel);
            DebugUtils.PrintSuccess("MongoDB Indexes created successfully.");
        }
        catch (Exception ex)
        {
            DebugUtils.PrintError($"Failed to create MongoDB indexes: {ex.Message}");
        }
    }

    public async Task<string> InsertAnalyticsEventAsync(AnalyticEventDocument analyticEvent)
    {
        await events.InsertOneAsync(analyticEvent);
        return analyticEvent.Id;
    }

    public async Task<List<string>> GetProjectsAsync()
    {
        return await events
            .Distinct<string>("ProjectId", FilterDefinition<AnalyticEventDocument>.Empty)
            .ToListAsync();
    }
}