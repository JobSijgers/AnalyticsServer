using KHSWeb.Models;
using KHSWeb.Services;
using System.Text.Json;
using Utils;
using MongoDB.Driver;

namespace KHSWeb.Endpoints;

public class AnalyticBatchEndpoint : WebEndpoint
{
    [System.Serializable]
    private class UnityAnalyticsEvent
    {
        public string key { get; set; } = string.Empty;
        public Dictionary<string, object> properties { get; set; } = new Dictionary<string, object>();
        public string project { get; set; } = string.Empty;
    }

    [System.Serializable]
    private class UnityAnalyticBatch
    {
        public List<UnityAnalyticsEvent> events { get; set; } = new List<UnityAnalyticsEvent>();
    }

    private readonly MongoService _mongoService = new();

    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public override string Path => "/api/analytics/batch";
    public override METHOD Method => METHOD.POST;

    public override Delegate Action => async (HttpContext context) =>
    {
        try
        {
            string requestBody = await new StreamReader(context.Request.Body).ReadToEndAsync();

            DebugUtils.Print(
                $"Received batch request with {System.Text.Encoding.UTF8.GetByteCount(requestBody)} bytes");

            UnityAnalyticBatch unityRequest =
                JsonSerializer.Deserialize<UnityAnalyticBatch>(requestBody, _jsonOptions) ??
                throw new InvalidOperationException();

            if (unityRequest.events == null || unityRequest.events.Count == 0)
            {
                return Results.Ok(new { success = true, message = "No events to process" });
            }

            // Use bulk insert for maximum performance
            var database = Config.GetDatabase();
            var collection = database.GetCollection<AnalyticEventDocument>(Config.MetricsCollectionName);
            var batchTimestamp = DateTime.UtcNow;

            var writes = new List<WriteModel<AnalyticEventDocument>>();

            foreach (var unityEvent in unityRequest.events)
            {
                var processedProperties = ConvertJsonStringArrays(unityEvent.properties);

                var analyticEvent = new AnalyticEventDocument
                {
                    Key = unityEvent.key,
                    PropertiesDict = processedProperties,
                    ProjectId = unityEvent.project,
                    Timestamp = batchTimestamp
                };

                writes.Add(new InsertOneModel<AnalyticEventDocument>(analyticEvent));
            }

            if (writes.Count > 0)
            {
                await collection.BulkWriteAsync(writes, new BulkWriteOptions { IsOrdered = false });

                DebugUtils.PrintSuccess($"Batch recorded: {writes.Count} events");
            }

            return Results.Ok(new
            {
                success = true,
                count = writes.Count
            });
        }
        catch (Exception ex)
        {
            DebugUtils.PrintError($"Error recording batch metrics: {ex.Message}");
            return Results.Problem($"Error recording batch metrics: {ex.Message}");
        }
    };

    /// <summary>
    /// Converts JSON string arrays like "[\"value1\",\"value2\"]" to proper List<string> arrays
    /// Only processes strings that match the exact JSON array pattern
    /// </summary>
    private Dictionary<string, object> ConvertJsonStringArrays(Dictionary<string, object> properties)
    {
        if (properties == null || properties.Count == 0)
            return properties ?? new Dictionary<string, object>();

        var processed = new Dictionary<string, object>(properties.Count);

        foreach (var prop in properties)
        {
            // Only convert if it's a string that looks like a JSON array
            if (prop.Value is string stringValue && IsJsonStringArray(stringValue))
            {
                processed[prop.Key] = ParseJsonStringArray(stringValue);
            }
            else
            {
                processed[prop.Key] = prop.Value;
            }
        }

        return processed;
    }

    /// <summary>
    /// Checks if a string is a JSON array in the format: ["value1","value2"]
    /// </summary>
    private bool IsJsonStringArray(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return false;

        var trimmed = value.Trim();

        // Must start with [" and end with "] - exact pattern from your example
        return trimmed.StartsWith("[\"") &&
               trimmed.EndsWith("\"]") &&
               trimmed.Length > 4; // Minimum: [" "]
    }

    /// <summary>
    /// Parses JSON string arrays in the format: ["value1","value2","value3"]
    /// This is optimized for the exact format shown in your example
    /// </summary>
    private object ParseJsonStringArray(string value)
    {
        try
        {
            var trimmed = value.Trim();

            // Fast path: remove the brackets and split by ","
            var content = trimmed.Substring(2, trimmed.Length - 4); // Remove [" and "]

            if (string.IsNullOrEmpty(content))
                return new List<string>();

            // Split by "," and remove any escaped quotes
            var items = content.Split(new[] { "\",\"" }, StringSplitOptions.None);

            var result = new List<string>(items.Length);
            foreach (var item in items)
            {
                // Remove any remaining quotes and unescape
                var cleaned = item.Replace("\\\"", "\""); // Handle escaped quotes
                result.Add(cleaned);
            }

            return result;
        }
        catch (Exception ex)
        {
            DebugUtils.PrintError($"Failed to parse JSON array: {value}, Error: {ex.Message}");
            // Return original value if parsing fails
            return value;
        }
    }
}