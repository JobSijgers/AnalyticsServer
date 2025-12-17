using MongoDB.Driver;
using KHSWeb.Models;
using KHSWeb.Services;
using Utils;

namespace KHSWeb.Workers;

public class AnalyticsWorker : BackgroundService
{
    private readonly AnalyticsQueue _queue;

    public AnalyticsWorker(AnalyticsQueue queue)
    {
        _queue = queue;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        DebugUtils.Print("Analytics Background Worker started.");

        while (await _queue.Reader.WaitToReadAsync(stoppingToken))
        {
            while (_queue.Reader.TryRead(out var batch))
            {
                try
                {
                    await ProcessBatchToMongo(batch);
                }
                catch (Exception ex)
                {
                    DebugUtils.PrintError($"Error processing analytics batch: {ex.Message}");
                }
            }
        }
    }

    private async Task ProcessBatchToMongo(UnityAnalyticBatch batch)
    {
        var database = Config.GetDatabase();
        var collection = database.GetCollection<AnalyticEventDocument>(Config.MetricsCollectionName);
        var batchTimestamp = DateTime.UtcNow;

        var writes = new List<WriteModel<AnalyticEventDocument>>();

        foreach (var unityEvent in batch.events)
        {
            var processedProperties = ConvertJsonStringArrays(unityEvent.properties);

            var analyticEvent = new AnalyticEventDocument
            {
                Key = unityEvent.key,
                PropertiesDict = processedProperties,
                ProjectId = unityEvent.project,
                Timestamp = unityEvent.timestamp ?? batchTimestamp
            };

            writes.Add(new InsertOneModel<AnalyticEventDocument>(analyticEvent));
        }

        if (writes.Count > 0)
        {
            await collection.BulkWriteAsync(writes, new BulkWriteOptions { IsOrdered = false });
            DebugUtils.PrintSuccess($"Background wrote: {writes.Count} events");
        }
    }

    private Dictionary<string, object> ConvertJsonStringArrays(Dictionary<string, object> properties)
    {
        if (properties == null || properties.Count == 0)
            return properties ?? new Dictionary<string, object>();

        var processed = new Dictionary<string, object>(properties.Count);

        foreach (var prop in properties)
        {
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

    private bool IsJsonStringArray(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return false;

        var trimmed = value.Trim();

        return trimmed.StartsWith("[\"") &&
               trimmed.EndsWith("\"]") &&
               trimmed.Length > 4;
    }

    private object ParseJsonStringArray(string value)
    {
        try
        {
            var trimmed = value.Trim();
            var content = trimmed.Substring(2, trimmed.Length - 4);

            if (string.IsNullOrEmpty(content))
                return new List<string>();

            var items = content.Split(new[] { "\",\"" }, StringSplitOptions.None);

            var result = new List<string>(items.Length);
            foreach (var item in items)
            {
                var cleaned = item.Replace("\\\"", "\""); 
                result.Add(cleaned);
            }

            return result;
        }
        catch (Exception ex)
        {
            DebugUtils.PrintError($"Failed to parse JSON array: {value}, Error: {ex.Message}");
            return value;
        }
    }
}