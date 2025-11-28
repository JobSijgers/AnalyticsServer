using KHSWeb.Models;
using KHSWeb.Services;
using Utils;
using System.Text.Json;

namespace KHSWeb.Endpoints;

public class CustomChartDataEndpoint : WebEndpoint
{
    public override string Path => "/api/dashboard/custom-chart";
    public override METHOD Method => METHOD.GET;
    public override EndpointSecurity Security => EndpointSecurity.Public;
    
    private static readonly string CacheDirectory = System.IO.Path.Combine(System.AppContext.BaseDirectory, "Data", "Cache");
    private readonly ChartDataService _chartDataService;

    public CustomChartDataEndpoint()
    {
        _chartDataService = new ChartDataService();

        if (!Directory.Exists(CacheDirectory))
        {
            Directory.CreateDirectory(CacheDirectory);
        }
    }

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

            string cacheFilePath = null!;
            if (!string.IsNullOrEmpty(configId))
            {
                var safeConfigId = string.Join("_", configId.Split(System.IO.Path.GetInvalidFileNameChars()));
                var cacheFileName = $"chart_{safeConfigId}_{days}.json";
                cacheFilePath = System.IO.Path.Combine(CacheDirectory, cacheFileName);
            }

            if (useCache && !string.IsNullOrEmpty(cacheFilePath) && File.Exists(cacheFilePath))
            {
                var cachedJson = await File.ReadAllTextAsync(cacheFilePath);
                return Results.Text(cachedJson, "application/json");
            }

            if (useCache && !string.IsNullOrEmpty(cacheFilePath) && !File.Exists(cacheFilePath))
            {
                return Results.NoContent();
            }

            var chartData = await _chartDataService.ProcessChartData(projectId, eventKey, propertyName, chartType, days, filtersJson);

            var response = new ApiResponse<ChartDataResponse>
            {
                Success = true,
                Data = new ChartDataResponse { ChartData = chartData }
            };

            if (!string.IsNullOrEmpty(cacheFilePath))
            {
                var jsonOptions = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
                var jsonString = JsonSerializer.Serialize(response, jsonOptions);
                await File.WriteAllTextAsync(cacheFilePath, jsonString);
            }

            return Results.Json(response);
        }
        catch (Exception ex)
        {
            return Results.Json(new ApiResponse<ChartDataResponse> { Success = false, Message = ex.Message }, statusCode: 500);
        }
    };
}