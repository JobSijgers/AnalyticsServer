using System.Text.Json;
using System.Text.Json.Serialization;
using KHSWeb.Models;
using KHSWeb.Services;
using Utils;

namespace KHSWeb.Endpoints;

public class SaveEventConfigEndpoint : WebEndpoint
{
    private readonly ChartConfigService _configService;
    private readonly ChartDataService _chartDataService;
    private static readonly string CacheDirectory = System.IO.Path.Combine(System.AppContext.BaseDirectory, "Data", "Cache");
    private readonly int[] _daysToCache = new[] { 7, 30, 90, 365, 36500 };

    public SaveEventConfigEndpoint()
    {
        _configService = new ChartConfigService();
        _chartDataService = new ChartDataService();

        if (!Directory.Exists(CacheDirectory))
        {
            Directory.CreateDirectory(CacheDirectory);
        }
    }

    public override string Path => "/api/event-config/save";
    public override METHOD Method => METHOD.POST;
    
    public override Delegate Action => async (HttpContext context) =>
    {
        try
        {
            var jsonOptions = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
                Converters = { new JsonStringEnumConverter() }
            };
            
            var config = await context.Request.ReadFromJsonAsync<EventDisplayConfig>(jsonOptions);
            
            if (config == null)
            {
                return Results.Json(new ApiResponse<SaveConfigResponse> 
                { 
                    Success = false, 
                    Message = "Invalid config data" 
                }, statusCode: 400);
            }

            var allConfigs = await _configService.LoadAllConfigs();

            config.UpdatedAt = DateTime.UtcNow;

            bool isNewConfig = string.IsNullOrEmpty(config.Id);
            
            if (isNewConfig)
            {
                // New config - generate ID
                config.Id = Guid.NewGuid().ToString();
                config.CreatedAt = DateTime.UtcNow;
                allConfigs.Add(config);
            }
            else
            {
                // Update existing
                var existingIndex = allConfigs.FindIndex(c => c.Id == config.Id && c.ProjectId == config.ProjectId);
                if (existingIndex >= 0)
                {
                    allConfigs[existingIndex] = config;
                }
                else
                {
                    allConfigs.Add(config);
                }
            }

            await _configService.SaveAllConfigs(allConfigs);

            // Generate cache for all date ranges immediately for new or updated enabled configs
            if (config.IsEnabled)
            {
                _ = Task.Run(async () => await GenerateCacheForConfig(config));
            }

            return Results.Json(new ApiResponse<SaveConfigResponse>
            {
                Success = true,
                Data = new SaveConfigResponse { ConfigId = config.Id }
            });
        }
        catch (Exception ex)
        {
            DebugUtils.PrintError($"Error saving event config: {ex.Message}");
            return Results.Json(new ApiResponse<SaveConfigResponse>
            {
                Success = false,
                Message = $"Error saving event config: {ex.Message}"
            }, statusCode: 500);
        }
    };

    private async Task GenerateCacheForConfig(EventDisplayConfig config)
    {
        try
        {
            DebugUtils.Print($"Generating immediate cache for new chart: {config.DisplayName}");

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

                    DebugUtils.Print($"Cached {days} days data for chart: {config.DisplayName}");
                }
                catch (Exception ex)
                {
                    DebugUtils.PrintError($"Error generating cache for {config.DisplayName} ({days} days): {ex.Message}");
                }
            }

            DebugUtils.Print($"Completed immediate cache generation for: {config.DisplayName}");
        }
        catch (Exception ex)
        {
            DebugUtils.PrintError($"Critical error generating immediate cache for {config.DisplayName}: {ex.Message}");
        }
    }
}