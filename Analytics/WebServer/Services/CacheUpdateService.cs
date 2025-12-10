using KHSWeb.Models;
using KHSWeb.Services;
using Utils;

namespace KHSWeb.Services;

public class CacheUpdateService : BackgroundService
{
    private readonly ChartConfigService _configService;
    private readonly ChartCacheService _cacheService;

    public CacheUpdateService()
    {
        _configService = new ChartConfigService();
        _cacheService = new ChartCacheService();
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
            
            var configs = await _configService.LoadAllActiveConfigs();
            var activeConfigIds = new List<string>();
            int updatedCount = 0;

            foreach (var config in configs)
            {
                if (!config.IsEnabled || string.IsNullOrEmpty(config.Id)) continue;
                
                activeConfigIds.Add(config.Id);

                await _cacheService.GenerateCacheForConfigAsync(config);
                updatedCount++;
            }

            var deletedCount = await _cacheService.CleanupOrphanedCachesAsync(activeConfigIds);

            DebugUtils.Print($"Background cache update complete. Processed {updatedCount} configs. Deleted {deletedCount} obsolete cache entries.");
        }
        catch (Exception ex)
        {
            DebugUtils.PrintError($"Critical error in CacheUpdateService: {ex.Message}");
        }
    }
}