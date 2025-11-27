using KHSWeb.Models;
using KHSWeb.Services;
using Utils;
using System.Text.Json;

namespace KHSWeb.Background;

public class CacheUpdateService : BackgroundService
{
    private readonly ChartConfigService _configService;
    private readonly ChartDataService _chartDataService;
    private static readonly string CacheDirectory = System.IO.Path.Combine(System.AppContext.BaseDirectory, "Data", "Cache");
    private readonly int[] _daysToCache = new[] { 7, 30, 90, 365, 36500 };

    public CacheUpdateService()
    {
        _configService = new ChartConfigService();
        _chartDataService = new ChartDataService();

        if (!Directory.Exists(CacheDirectory))
        {
            Directory.CreateDirectory(CacheDirectory);
        }
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
            
            var configs = await _configService.LoadAllConfigs();
            int updatedCount = 0;
            var validCacheFiles = new HashSet<string>();

            foreach (var config in configs)
            {
                if (!config.IsEnabled || string.IsNullOrEmpty(config.Id)) continue;

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

                        var response = new ApiResponse<ChartDataResponse>
                        {
                            Success = true,
                            Data = new ChartDataResponse { ChartData = chartData }
                        };

                        var safeConfigId = string.Join("_", config.Id.Split(System.IO.Path.GetInvalidFileNameChars()));
                        var cacheFileName = $"chart_{safeConfigId}_{days}.json";
                        var cacheFilePath = System.IO.Path.Combine(CacheDirectory, cacheFileName);

                        var jsonOptions = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
                        var jsonString = JsonSerializer.Serialize(response, jsonOptions);
                        await File.WriteAllTextAsync(cacheFilePath, jsonString);
                        
                        validCacheFiles.Add(cacheFilePath);
                        updatedCount++;
                    }
                    catch (Exception ex)
                    {
                        DebugUtils.PrintError($"Error updating cache for config {config.DisplayName} ({days} days): {ex.Message}");
                    }
                }
            }

            int deletedCount = 0;
            var existingFiles = Directory.GetFiles(CacheDirectory, "chart_*.json");

            foreach (var file in existingFiles)
            {
                if (!validCacheFiles.Contains(file))
                {
                    try
                    {
                        File.Delete(file);
                        deletedCount++;
                    }
                    catch (Exception ex)
                    {
                        DebugUtils.PrintError($"Error deleting old cache file {file}: {ex.Message}");
                    }
                }
            }

            DebugUtils.Print($"Background cache update complete. Updated {updatedCount} cache files. Deleted {deletedCount} obsolete files.");
        }
        catch (Exception ex)
        {
            DebugUtils.PrintError($"Critical error in CacheUpdateService: {ex.Message}");
        }
    }
}