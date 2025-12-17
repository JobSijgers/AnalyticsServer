using MongoDB.Driver;
using MongoDB.Bson;
using KHSWeb.Models;
using Utils;

namespace KHSWeb.Repositories;

public class ChartCacheRepository
{
    private readonly IMongoCollection<CachedChartDocument> _cache;

    public ChartCacheRepository()
    {
        var database = Config.GetDatabase();
        _cache = database.GetCollection<CachedChartDocument>(Config.ChartCacheCollectionName);
    }

    public async Task<CachedChartDocument?> GetCachedDataAsync(string configId, int days)
    {
        try
        {
            var id = $"{configId}_{days}";
            return await _cache.Find(x => x.Id == id).FirstOrDefaultAsync();
        }
        catch (Exception ex)
        {
            DebugUtils.PrintError($"Error retrieving cache for {configId}: {ex.Message}");
            return null;
        }
    }

    public async Task SaveCacheDataAsync(string configId, int days, BsonDocument bsonData)
    {
        try
        {
            var id = $"{configId}_{days}";

            var document = new CachedChartDocument
            {
                Id = id,
                ConfigId = configId,
                Days = days,
                Data = bsonData,
                UpdatedAt = DateTime.UtcNow
            };

            await _cache.ReplaceOneAsync(
                x => x.Id == id,
                document,
                new ReplaceOptions { IsUpsert = true }
            );
        }
        catch (Exception ex)
        {
            DebugUtils.PrintError($"Error writing to chart cache DB: {ex.Message}");
            throw;
        }
    }

    public async Task<long> DeleteOrphanedCachesAsync(List<string> activeConfigIds)
    {
        try
        {
            var filter = Builders<CachedChartDocument>.Filter.Not(
                Builders<CachedChartDocument>.Filter.In(x => x.ConfigId, activeConfigIds)
            );

            var result = await _cache.DeleteManyAsync(filter);
            return result.DeletedCount;
        }
        catch (Exception ex)
        {
            DebugUtils.PrintError($"Error cleaning up orphaned caches: {ex.Message}");
            return 0;
        }
    }
}

public class CachedChartDocument
{
    [MongoDB.Bson.Serialization.Attributes.BsonId] 
    public string Id { get; set; } = string.Empty;
    public string ConfigId { get; set; } = string.Empty;
    public int Days { get; set; }
    public BsonDocument Data { get; set; } = new();
    public DateTime UpdatedAt { get; set; }
}