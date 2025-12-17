using KHSWeb.Services;
using KHSWeb.Repositories;
using MongoDB.Bson;
using Utils;

namespace KHSWeb.Workers;

public class CacheUpdateWorker : BackgroundService
{
    private readonly ChartConfigRepository _configRepo;
    private readonly ChartCacheRepository _cacheRepo;
    private readonly ChartDataService _chartDataService;
    private readonly int[] _daysToCache = new[] { 7, 30, 90, 365, 36500 };

    public CacheUpdateWorker()
    {
        _configRepo = new ChartConfigRepository();
        _cacheRepo = new ChartCacheRepository();
        _chartDataService = new ChartDataService();
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await UpdateAllCaches();

        using var timer = new PeriodicTimer(TimeSpan.FromHours(1));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            await UpdateAllCaches();
        }
    }

    private async Task UpdateAllCaches()
    {
        try
        {
            DebugUtils.Print("Starting background cache update...");
            
            var configs = await _configRepo.GetAllActiveConfigsAsync();
            var activeConfigIds = new List<string>();
            int updatedCount = 0;

            foreach (var config in configs)
            {
                if (!config.IsEnabled || string.IsNullOrEmpty(config.Id)) continue;
                
                activeConfigIds.Add(config.Id);

                await GenerateCacheForConfigAsync(config);
                updatedCount++;
            }

            var deletedCount = await _cacheRepo.DeleteOrphanedCachesAsync(activeConfigIds);

            DebugUtils.Print($"Background cache update complete. Processed {updatedCount} configs. Deleted {deletedCount} obsolete cache entries.");
        }
        catch (Exception ex)
        {
            DebugUtils.PrintError($"Critical error in CacheUpdateWorker: {ex.Message}");
        }
    }

    private async Task GenerateCacheForConfigAsync(KHSWeb.Models.EventDisplayConfig config)
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

                    var bsonData = chartData.ToBsonDocument();
                    await _cacheRepo.SaveCacheDataAsync(config.Id, days, bsonData);
                }
                catch (Exception ex)
                {
                    DebugUtils.PrintError($"Error generating data for {config.DisplayName} ({days} days): {ex.Message}");
                }
            }
        }
        catch (Exception ex)
        {
            DebugUtils.PrintError($"Critical error in cache generation for {config.DisplayName}: {ex.Message}");
        }
    }
}