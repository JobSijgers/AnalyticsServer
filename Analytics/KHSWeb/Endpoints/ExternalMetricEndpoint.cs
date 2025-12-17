using System.Text.Json;
using KHSWeb.Repositories;
using Utils;
using MongoDB.Bson;
using MongoDB.Bson.IO;

namespace KHSWeb.Endpoints;

public class ExternalMetricEndpoint : WebEndpoint
{
    private readonly ChartCacheRepository _cacheRepo;

    public ExternalMetricEndpoint(ChartCacheRepository cacheRepo)
    {
        _cacheRepo = cacheRepo;
    }

    public override string Path => "/api/public/metric";
    public override METHOD Method => METHOD.GET;

    public override EndpointSecurity Security => EndpointSecurity.Public;

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

            var cachedDoc = await _cacheRepo.GetCachedDataAsync(configId, days);

            if (cachedDoc == null || cachedDoc.Data == null)
            {
                return Results.Json(new { error = "Data not found or not yet cached." }, statusCode: 404);
            }

            var jsonSettings = new JsonWriterSettings { OutputMode = JsonOutputMode.RelaxedExtendedJson };
            var jsonString = cachedDoc.Data.ToJson(jsonSettings);

            using var doc = JsonDocument.Parse(jsonString);
            
            if (!doc.RootElement.TryGetProperty("data", out var innerData))
            {
                 innerData = doc.RootElement;
                 if (innerData.ValueKind == JsonValueKind.Object && !innerData.TryGetProperty("data", out _))
                 {
                     // Keep innerData as RootElement
                 }
            }

            double resultValue = 0;

            if (innerData.ValueKind == JsonValueKind.Object)
            {
                if (!string.IsNullOrEmpty(targetField) && innerData.TryGetProperty(targetField, out var specificVal))
                {
                    resultValue = GetDoubleValue(specificVal);
                }
                else if (innerData.TryGetProperty("sumValue", out var sumVal) && GetDoubleValue(sumVal) > 0)
                {
                    resultValue = GetDoubleValue(sumVal);
                }
                else if (innerData.TryGetProperty("total", out var totalVal))
                {
                    resultValue = GetDoubleValue(totalVal);
                }
            }
            else if (innerData.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in innerData.EnumerateArray())
                {
                    if (item.TryGetProperty("value", out var val))
                    {
                        resultValue += GetDoubleValue(val);
                    }
                    else if (item.TryGetProperty("count", out var count))
                    {
                        resultValue += GetDoubleValue(count);
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
            DebugUtils.PrintError($"Error in ExternalMetricEndpoint: {ex.Message}");
            return Results.Json(new { error = ex.Message }, statusCode: 500);
        }
    };

    private double GetDoubleValue(JsonElement element)
    {
        if (element.ValueKind == JsonValueKind.Number)
            return element.GetDouble();
        if (element.ValueKind == JsonValueKind.String && double.TryParse(element.GetString(), out double val))
            return val;
        return 0;
    }
}