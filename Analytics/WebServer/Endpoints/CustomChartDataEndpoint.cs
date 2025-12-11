﻿using KHSWeb.Models;
using KHSWeb.Services;
using Utils;
using MongoDB.Bson; // Added for BsonTypeMapper

namespace KHSWeb.Endpoints;

public class CustomChartDataEndpoint : WebEndpoint
{
    public override string Path => "/api/dashboard/custom-chart";
    public override METHOD Method => METHOD.GET;
    public override EndpointSecurity Security => EndpointSecurity.Public;
    
    private readonly ChartDataService _chartDataService = new();
    private readonly ChartCacheService _cacheService = new();
    private readonly ChartConfigService _configService = new();

    public override Delegate Action => async (HttpContext context) =>
    {
        try
        {
            var projectId = context.Request.Query["projectId"].ToString();
            var eventKey = context.Request.Query["eventKey"].ToString();
            var propertyName = context.Request.Query["propertyName"].ToString();
            var chartType = context.Request.Query["chartType"].ToString();
            var configId = context.Request.Query["configId"].ToString();
            var useCache = context.Request.Query["useCache"].ToString() == "true";
            var days = int.TryParse(context.Request.Query["days"], out int d) ? d : 30;
            var filtersJson = context.Request.Query["filtersJson"].ToString();

            if (string.IsNullOrEmpty(projectId) || string.IsNullOrEmpty(eventKey))
            {
                return Results.Json(new ApiResponse<ChartDataResponse> { Success = false, Message = "Required fields missing" }, statusCode: 400);
            }

            string widgetSize = "normal"; 
            
            if (!string.IsNullOrEmpty(configId))
            {
                var config = await _configService.GetConfigById(configId);
                if (config != null && !string.IsNullOrEmpty(config.WidgetSize))
                {
                    widgetSize = config.WidgetSize;
                }
            }

            if (useCache && !string.IsNullOrEmpty(configId))
            {
                var cachedDoc = await _cacheService.GetCachedDataAsync(configId, days);

                if (cachedDoc != null)
                {
                    var cleanData = BsonTypeMapper.MapToDotNetValue(cachedDoc.Data);

                    return Results.Json(new ApiResponse<ChartDataResponse>
                    {
                        Success = true,
                        Data = new ChartDataResponse 
                        { 
                            ChartData = cleanData,
                            WidgetSize = widgetSize
                        }
                    });
                }
                else
                {
                    return Results.NoContent();
                }
            }

            var chartData = await _chartDataService.ProcessChartData(projectId, eventKey, propertyName, chartType, days, filtersJson);

            if (!string.IsNullOrEmpty(configId))
            {
                _ = Task.Run(async () => 
                {
                    try
                    {
                        await _cacheService.CacheChartDataAsync(configId, days, chartData);
                    }
                    catch (Exception ex)
                    {
                        DebugUtils.PrintError($"Failed to background cache chart {configId}: {ex.Message}");
                    }
                });
            }

            return Results.Json(new ApiResponse<ChartDataResponse>
            {
                Success = true,
                Data = new ChartDataResponse 
                { 
                    ChartData = chartData,
                    WidgetSize = widgetSize
                }
            });
        }
        catch (Exception ex)
        {
            return Results.Json(new ApiResponse<ChartDataResponse> { Success = false, Message = ex.Message }, statusCode: 500);
        }
    };
}