using System.Text.Json;
using Utils;

namespace KHSWeb.Endpoints;

public class ExternalMetricEndpoint : WebEndpoint
{
    public override string Path => "/api/public/metric";
    public override METHOD Method => METHOD.GET;

    public override EndpointSecurity Security => EndpointSecurity.Public;

    private static readonly string CacheDirectory = System.IO.Path.Combine(System.AppContext.BaseDirectory, "Data", "Cache");

    public override Delegate Action => async (HttpContext context) =>
    {
        try
        {
            var configId = context.Request.Query["id"].ToString();
            var days = int.TryParse(context.Request.Query["days"], out int d) ? d : 36500;
            var targetField = context.Request.Query["field"].ToString().ToLower(); 

            if (string.IsNullOrEmpty(configId))
            {
                return Results.Json(new { error = "Missing 'id' parameter" }, statusCode: 400);
            }

            var safeConfigId = string.Join("_", configId.Split(System.IO.Path.GetInvalidFileNameChars()));
            var cacheFileName = $"chart_{safeConfigId}_{days}.json";
            var cacheFilePath = System.IO.Path.Combine(CacheDirectory, cacheFileName);

            if (!File.Exists(cacheFilePath))
            {
                return Results.Json(new { error = "Data not found or not yet cached." }, statusCode: 404);
            }

            var jsonString = await File.ReadAllTextAsync(cacheFilePath);
            using var doc = JsonDocument.Parse(jsonString);
            
            if (!doc.RootElement.TryGetProperty("data", out var dataElem) ||
                !dataElem.TryGetProperty("chartData", out var chartDataElem) ||
                !chartDataElem.TryGetProperty("data", out var innerData))
            {
                return Results.Json(new { error = "Invalid cache format" }, statusCode: 500);
            }

            double resultValue = 0;

            if (innerData.ValueKind == JsonValueKind.Object)
            {
                if (!string.IsNullOrEmpty(targetField) && innerData.TryGetProperty(targetField, out var specificVal))
                {
                    resultValue = specificVal.GetDouble();
                }
                else if (innerData.TryGetProperty("sumValue", out var sumVal) && sumVal.GetDouble() > 0)
                {
                    resultValue = sumVal.GetDouble();
                }
                else if (innerData.TryGetProperty("total", out var totalVal))
                {
                    resultValue = totalVal.GetDouble();
                }
            }
            else if (innerData.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in innerData.EnumerateArray())
                {
                    if (item.TryGetProperty("value", out var val))
                    {
                        resultValue += val.GetDouble();
                    }
                    else if (item.TryGetProperty("count", out var count))
                    {
                        resultValue += count.GetDouble();
                    }
                }
            }

            return Results.Json(new 
            { 
                value = resultValue,
                formatted = resultValue.ToString("N0"),
            });
        }
        catch (Exception ex)
        {
            return Results.Json(new { error = ex.Message }, statusCode: 500);
        }
    };
}