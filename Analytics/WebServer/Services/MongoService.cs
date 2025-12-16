using MongoDB.Driver;
using KHSWeb.Models;
using System.Text.Json;
using MongoDB.Bson;
using Utils; 

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

    // [NEW] Get a cursor for streaming export
    public async Task<IAsyncCursor<AnalyticEventDocument>> GetProjectEventsCursorAsync(string projectId)
    {
        var filter = Builders<AnalyticEventDocument>.Filter.Eq(x => x.ProjectId, projectId);
        // Return cursor without fetching all documents into memory
        return await events.Find(filter).ToCursorAsync();
    }

    // [NEW] Bulk insert for streaming import
    public async Task BulkInsertEventsAsync(IEnumerable<AnalyticEventDocument> eventBatch)
    {
        if (eventBatch == null || !eventBatch.Any()) return;
        
        // Ordered: false ensures that if one fails, the others still try to insert
        await events.InsertManyAsync(eventBatch, new InsertManyOptions { IsOrdered = false });
    }
    
    public async Task<IAsyncCursor<BsonDocument>> GetProjectEventsRawCursorAsync(string projectId)
    {
        var filter = Builders<AnalyticEventDocument>.Filter.Eq(x => x.ProjectId, projectId);
    
        // Get the underlying IMongoCollection<BsonDocument> to bypass strict mapping
        var rawCollection = events.Database.GetCollection<BsonDocument>(Config.MetricsCollectionName);
        var rawFilter = Builders<BsonDocument>.Filter.Eq("ProjectId", projectId);
    
        return await rawCollection.Find(rawFilter).ToCursorAsync();
    }
}