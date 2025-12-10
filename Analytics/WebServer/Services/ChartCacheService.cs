using MongoDB.Driver;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using KHSWeb.Models;
using Utils;

namespace KHSWeb.Services;

public class ChartCacheService
{
    private readonly IMongoCollection<CachedChartDocument> _cache;
    private readonly ChartDataService _chartDataService;
    private readonly int[] _daysToCache = new[] { 7, 30, 90, 365, 36500 };

    public ChartCacheService()
    {
        var database = Config.GetDatabase();
        _cache = database.GetCollection<CachedChartDocument>(Config.ChartCacheCollectionName);
        _chartDataService = new ChartDataService();
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

    public async Task GenerateCacheForConfigAsync(EventDisplayConfig config)
    {
        try
        {
            DebugUtils.Print($"Generating cache for chart: {config.DisplayName}");

            foreach (var days in _daysToCache)
            {
                try
                {
                    var chartData = await _chartDataService.ProcessChartData(
                        config.ProjectId,
                        config.EventKey,
                        config.PropertyToDisplay,
                        config.ChartType.ToString(),
                        days,
                        config.FiltersJson
                    );

                    await CacheChartDataAsync(config.Id, days, chartData);
                }
                catch (Exception ex)
                {
                    DebugUtils.PrintError(
                        $"Error generating data for {config.DisplayName} ({days} days): {ex.Message}");
                }
            }
        }
        catch (Exception ex)
        {
            DebugUtils.PrintError($"Critical error in cache generation for {config.DisplayName}: {ex.Message}");
        }
    }

    public async Task CacheChartDataAsync(string configId, int days, object chartData)
    {
        try
        {
            var id = $"{configId}_{days}";

            // Convert the object to a BsonDocument for reliable storage/retrieval
            var bsonData = chartData.ToBsonDocument();

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

    public async Task<long> CleanupOrphanedCachesAsync(List<string> activeConfigIds)
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
    [BsonId] public string Id { get; set; } = string.Empty;
    public string ConfigId { get; set; } = string.Empty;
    public int Days { get; set; }
    
    public BsonDocument Data { get; set; } = new();
    public DateTime UpdatedAt { get; set; }
}

