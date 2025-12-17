using System.Text.Json;
using System.Text.Json.Serialization;
using KHSWeb.Models;
using KHSWeb.Repositories;
using KHSWeb.Services;
using MongoDB.Bson;
using Utils;

namespace KHSWeb.Endpoints;

public class SaveEventConfigEndpoint : WebEndpoint
{
    private readonly ChartConfigRepository _configRepo;
    private readonly ChartCacheRepository _cacheRepo;
    private readonly ChartDataService _chartDataService;
    
    // Days to cache, matching the background worker logic
    private readonly int[] _daysToCache = new[] { 7, 30, 90, 365, 36500 };

    public SaveEventConfigEndpoint(
        ChartConfigRepository configRepo,
        ChartCacheRepository cacheRepo,
        ChartDataService chartDataService)
    {
        _configRepo = configRepo;
        _cacheRepo = cacheRepo;
        _chartDataService = chartDataService;
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

            if (string.IsNullOrEmpty(config.SortOrder))
            {
                config.SortOrder = "highest";
            }

            config.UpdatedAt = DateTime.UtcNow;

            if (string.IsNullOrEmpty(config.Id))
            {
                config.Id = Guid.NewGuid().ToString();
                config.CreatedAt = DateTime.UtcNow;
            }

            // 1. Save Config to Repo
            await _configRepo.SaveConfigAsync(config);

            // 2. Trigger Background Cache Generation (Fire and Forget)
            if (config.IsEnabled)
            {
                _ = Task.Run(async () => 
                {
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
                            DebugUtils.PrintError($"Error generating background cache for {config.Id} ({days} days): {ex.Message}");
                        }
                    }
                });
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
}