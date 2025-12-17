using MongoDB.Driver;
using MongoDB.Driver.Linq;
using KHSWeb.Models;
using System.Text.Json;
using MongoDB.Bson;
using Utils; 
using System.Linq;

namespace KHSWeb.Repositories;

public class AnalyticsRepository
{
    private readonly IMongoCollection<AnalyticEventDocument> _events;

    public AnalyticsRepository()
    {
        var database = Config.GetDatabase();
        _events = database.GetCollection<AnalyticEventDocument>(Config.MetricsCollectionName);
    }

    public IMongoCollection<AnalyticEventDocument> GetCollection()
    {
        return _events;
    }

    public async Task EnsureIndexesAsync()
    {
        try
        {
            var indexKeys = Builders<AnalyticEventDocument>.IndexKeys
                .Ascending(x => x.Key)
                .Ascending(x => x.ProjectId)
                .Ascending(x => x.Timestamp);

            var indexModel = new CreateIndexModel<AnalyticEventDocument>(
                indexKeys,
                new CreateIndexOptions { Name = "Key_Project_Time_Idx" }
            );

            await _events.Indexes.CreateOneAsync(indexModel);
            DebugUtils.PrintSuccess("MongoDB Indexes created successfully.");
        }
        catch (Exception ex)
        {
            DebugUtils.PrintError($"Failed to create MongoDB indexes: {ex.Message}");
        }
    }

    public async Task BulkInsertEventsAsync(IEnumerable<AnalyticEventDocument> eventBatch)
    {
        if (eventBatch == null || !eventBatch.Any()) return;
        await _events.InsertManyAsync(eventBatch, new InsertManyOptions { IsOrdered = false });
    }

    public async Task<List<string>> GetProjectsAsync()
    {
        return await _events
            .AsQueryable()
            .Select(x => x.ProjectId)
            .Distinct()
            .OrderBy(x => x)
            .ToListAsync();
    }

    public async Task<bool> DeleteEventAsync(string id, string projectId)
    {
        var filter = Builders<AnalyticEventDocument>.Filter.Eq(x => x.Id, id) & 
                     Builders<AnalyticEventDocument>.Filter.Eq(x => x.ProjectId, projectId);
        
        var result = await _events.DeleteOneAsync(filter);
        return result.DeletedCount > 0;
    }

    public async Task<List<string>> GetEventKeysAsync(string projectId)
    {
        var query = _events.AsQueryable();

        if (projectId == "GLOBAL")
        {
            return await query
                .GroupBy(x => x.Key)
                .Select(g => new 
                { 
                    Key = g.Key, 
                    ProjectCount = g.Select(x => x.ProjectId).Distinct().Count() 
                })
                .Where(x => x.ProjectCount >= 2)
                .Select(x => x.Key)
                .OrderBy(x => x)
                .ToListAsync();
        }
        
        return await query
            .Where(x => x.ProjectId == projectId)
            .Select(x => x.Key)
            .Distinct()
            .OrderBy(x => x)
            .ToListAsync();
    }

    public async Task<List<string>> GetEventPropertiesAsync(string projectId, string eventKey)
    {
        var filterBuilder = Builders<AnalyticEventDocument>.Filter;
        var filter = filterBuilder.Eq(x => x.Key, eventKey);

        if (projectId != "GLOBAL")
        {
            filter &= filterBuilder.Eq(x => x.ProjectId, projectId);
        }

        var recentEvents = await _events.Find(filter)
            .SortByDescending(x => x.Timestamp)
            .Limit(200)
            .ToListAsync();

        if (projectId == "GLOBAL")
        {
            var propertyProjectMap = new Dictionary<string, HashSet<string>>();

            foreach (var evt in recentEvents)
            {
                if (evt.PropertiesDict != null)
                {
                    foreach (var key in evt.PropertiesDict.Keys)
                    {
                        if (!propertyProjectMap.ContainsKey(key))
                            propertyProjectMap[key] = new HashSet<string>();
                        
                        propertyProjectMap[key].Add(evt.ProjectId);
                    }
                }
            }

            return propertyProjectMap
                .Where(x => x.Value.Count >= 2)
                .Select(x => x.Key)
                .OrderBy(x => x)
                .ToList();
        }
        
        var propertyKeys = new HashSet<string>();
        foreach (var evt in recentEvents)
        {
            if (evt.PropertiesDict != null)
            {
                foreach (var key in evt.PropertiesDict.Keys)
                {
                    propertyKeys.Add(key);
                }
            }
        }
        
        return propertyKeys.OrderBy(x => x).ToList();
    }

    public async Task<bool> UpdateEventPropertiesAsync(string id, string projectId, Dictionary<string, object> newProperties)
    {
        var filter = Builders<AnalyticEventDocument>.Filter.Eq(x => x.Id, id) &
                     Builders<AnalyticEventDocument>.Filter.Eq(x => x.ProjectId, projectId);

        var bsonProps = new BsonDocument();
        foreach (var kvp in newProperties)
        {
            BsonValue val;
            if (kvp.Value is JsonElement je)
            {
                if (je.ValueKind == JsonValueKind.Number) val = je.GetDouble();
                else if (je.ValueKind == JsonValueKind.True) val = true;
                else if (je.ValueKind == JsonValueKind.False) val = false;
                else val = je.ToString();
            }
            else
            {
                val = BsonValue.Create(kvp.Value);
            }
            bsonProps.Add(kvp.Key, val);
        }

        var update = Builders<AnalyticEventDocument>.Update.Set(x => x.Properties, bsonProps);
        var result = await _events.UpdateOneAsync(filter, update);

        return result.ModifiedCount > 0 || result.MatchedCount > 0;
    }

    public async Task<List<AnalyticEventDocument>> GetDrillDownEventsAsync(string projectId, string eventKey, string propertyName, string clickedLabel, string clickedDatasetLabel, string chartType, string filtersJson)
    {
        var builder = Builders<AnalyticEventDocument>.Filter;
        var filter = builder.Eq(x => x.ProjectId, projectId);

        if (!string.IsNullOrEmpty(eventKey))
        {
            filter &= builder.Eq(x => x.Key, eventKey);
        }

        if (!string.IsNullOrEmpty(filtersJson))
        {
            try
            {
                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var userFilters = JsonSerializer.Deserialize<List<FilterCondition>>(filtersJson, options);
                if (userFilters != null)
                {
                    foreach (var f in userFilters)
                    {
                        if (string.IsNullOrEmpty(f.Property)) continue;
                        
                        BsonValue bsonValue;
                        if (f.Value is JsonElement je)
                        {
                             if (je.ValueKind == JsonValueKind.Number) bsonValue = je.GetDouble();
                             else if (je.ValueKind == JsonValueKind.True) bsonValue = true;
                             else if (je.ValueKind == JsonValueKind.False) bsonValue = false;
                             else bsonValue = je.ToString();
                        }
                        else
                        {
                            bsonValue = BsonValue.Create(f.Value);
                        }

                        var fieldName = $"Properties.{f.Property}";
                        switch (f.Operator)
                        {
                            case "=": filter &= builder.Eq(fieldName, bsonValue); break;
                            case "!=": filter &= builder.Ne(fieldName, bsonValue); break;
                            case ">": filter &= builder.Gt(fieldName, bsonValue); break;
                            case "<": filter &= builder.Lt(fieldName, bsonValue); break;
                            case ">=": filter &= builder.Gte(fieldName, bsonValue); break;
                            case "<=": filter &= builder.Lte(fieldName, bsonValue); break;
                        }
                    }
                }
            }
            catch { }
        }

        if (!string.IsNullOrEmpty(chartType)) 
        {
            if (chartType == "LineChart" || chartType == "StackedBarChart" || chartType == "AreaChart")
            {
                if (!string.IsNullOrEmpty(clickedLabel) && clickedLabel.Contains(" - "))
                {
                    var parts = clickedLabel.Split(" - ");
                    if (parts.Length == 2 && DateTime.TryParse(parts[0], out DateTime start) && DateTime.TryParse(parts[1], out DateTime end))
                    {
                        filter &= builder.Gte(x => x.Timestamp, start) & builder.Lt(x => x.Timestamp, end.AddDays(1));
                    }
                }
                else if (DateTime.TryParse(clickedLabel, out DateTime date))
                {
                    filter &= builder.Gte(x => x.Timestamp, date) & builder.Lt(x => x.Timestamp, date.AddDays(1));
                }

                if (chartType == "StackedBarChart" && !string.IsNullOrEmpty(propertyName) && !string.IsNullOrEmpty(clickedDatasetLabel))
                {
                    filter &= builder.Eq($"Properties.{propertyName}", clickedDatasetLabel);
                }
            }
            else if (chartType == "BarChart" || chartType == "PieChart")
            {
                if (!string.IsNullOrEmpty(propertyName) && !string.IsNullOrEmpty(clickedLabel))
                {
                    if (clickedLabel.Equals("true", StringComparison.OrdinalIgnoreCase)) 
                        filter &= builder.Eq($"Properties.{propertyName}", true);
                    else if (clickedLabel.Equals("false", StringComparison.OrdinalIgnoreCase)) 
                        filter &= builder.Eq($"Properties.{propertyName}", false);
                    else 
                        filter &= builder.Eq($"Properties.{propertyName}", clickedLabel);
                }
            }
        }

        return await _events.Find(filter).Limit(100).SortByDescending(x => x.Timestamp).ToListAsync();
    }
}