using KHSWeb.Models;
using MongoDB.Driver;
using Utils;
using System.Text.Json;
using MongoDB.Bson; // Required for BsonDocument

namespace KHSWeb.Endpoints;

public class FilterCondition
{
    public string Property { get; set; }
    public string Operator { get; set; } 
    public object Value { get; set; }
}

public class CustomChartDataEndpoint : WebEndpoint
{
    public override string Path => "/api/dashboard/custom-chart";
    public override METHOD Method => METHOD.GET;
    
    public override Delegate Action => async (HttpContext context) =>
    {
        try
        {
            var projectId = context.Request.Query["projectId"].ToString();
            var eventKey = context.Request.Query["eventKey"].ToString();
            var propertyName = context.Request.Query["propertyName"].ToString(); 
            var chartType = context.Request.Query["chartType"].ToString();
            var days = int.TryParse(context.Request.Query["days"], out int d) ? d : 30;
            var filtersJson = context.Request.Query["filtersJson"].ToString(); 

            if (string.IsNullOrEmpty(projectId) || string.IsNullOrEmpty(eventKey))
            {
                return Results.Json(new ApiResponse<ChartDataResponse> 
                { 
                    Success = false, 
                    Message = "ProjectId and EventKey are required" 
                }, statusCode: 400);
            }

            var database = Config.GetDatabase();
            var collection = database.GetCollection<AnalyticEventDocument>(Config.MetricsCollectionName);

            var startDate = DateTime.UtcNow.AddDays(-days);
            var filterBuilder = Builders<AnalyticEventDocument>.Filter;
            
            var filters = new List<FilterDefinition<AnalyticEventDocument>>
            {
                filterBuilder.Eq(x => x.ProjectId, projectId),
                filterBuilder.Eq(x => x.Key, eventKey),
                filterBuilder.Gte(x => x.Timestamp, startDate)
            };

            if (!string.IsNullOrEmpty(filtersJson))
            {
                try 
                {
                    var conditions = JsonSerializer.Deserialize<List<FilterCondition>>(filtersJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                    if (conditions != null)
                    {
                        foreach (var cond in conditions)
                        {
                            var dynamicFilter = BuildDynamicFilter(filterBuilder, cond);
                            if (dynamicFilter != null)
                            {
                                filters.Add(dynamicFilter);
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    DebugUtils.PrintError($"Error parsing filters: {ex.Message}");
                }
            }

            var finalFilter = filterBuilder.And(filters);

            var events = await collection.Find(finalFilter)
                .SortBy(x => x.Timestamp)
                .ToListAsync();

            var chartData = ProcessChartData(events, propertyName, chartType, days);

            return Results.Json(new ApiResponse<ChartDataResponse>
            {
                Success = true,
                Data = new ChartDataResponse { ChartData = chartData }
            });
        }
        catch (Exception ex)
        {
            DebugUtils.PrintError($"Error getting custom chart data: {ex.Message}");
            return Results.Json(new ApiResponse<ChartDataResponse>
            {
                Success = false,
                Message = $"Error getting custom chart data: {ex.Message}"
            }, statusCode: 500);
        }
    };

    private FilterDefinition<AnalyticEventDocument> BuildDynamicFilter(FilterDefinitionBuilder<AnalyticEventDocument> builder, FilterCondition condition)
    {
        var fieldName = $"Properties.{condition.Property}";
        object val = condition.Value;
        bool isNumericComparison = false;
        
        // 1. Normalize JSON Element & Detect Type
        if (val is JsonElement element)
        {
            if (element.ValueKind == JsonValueKind.Number) 
            {
                if (element.TryGetInt64(out long l)) val = l;
                else val = element.GetDouble();
                isNumericComparison = true;
            }
            else if (element.ValueKind == JsonValueKind.True) val = true;
            else if (element.ValueKind == JsonValueKind.False) val = false;
            else val = element.ToString();
        }

        // 2. SMART NUMERIC LOGIC (The Fix for "10" > 6)
        if (isNumericComparison)
        {
             var mongoOp = condition.Operator switch {
                 "=" => "$eq", "!=" => "$ne", ">" => "$gt", "<" => "$lt", ">=" => "$gte", "<=" => "$lte", _ => "$eq"
             };
             
             return new BsonDocument("$expr", 
                new BsonDocument(mongoOp, new BsonArray { 
                    new BsonDocument("$toDouble", $"${fieldName}"), 
                    BsonValue.Create(val) // FIX: Wrapped in BsonValue.Create()
                })
             );
        }

        // 3. SMART BOOLEAN LOGIC (The Fix for true vs "True")
        if (val is bool boolVal && condition.Operator == "=")
        {
            return builder.Or(
                builder.Eq(fieldName, boolVal),
                builder.Eq(fieldName, boolVal.ToString()),
                builder.Eq(fieldName, boolVal.ToString().ToLower())
            );
        }

        // 4. Standard Logic
        return condition.Operator switch
        {
            "=" => builder.Eq(fieldName, val),
            "!=" => builder.Ne(fieldName, val),
            ">" => builder.Gt(fieldName, val),
            "<" => builder.Lt(fieldName, val),
            ">=" => builder.Gte(fieldName, val),
            "<=" => builder.Lte(fieldName, val),
            _ => null
        };
    }

    private object ProcessChartData(List<AnalyticEventDocument> events, string propertyName, string chartType, int days)
    {
        var isEmptyProperty = string.IsNullOrEmpty(propertyName);
        return chartType?.ToLower() switch
        {
            "linechart" => ProcessLineChart(events, propertyName, days, isEmptyProperty),
            "piechart" => ProcessPieChart(events, propertyName, isEmptyProperty),
            "barchart" => ProcessBarChart(events, propertyName, isEmptyProperty),
            "numbercard" => ProcessNumberCard(events, propertyName, isEmptyProperty),
            _ => ProcessLineChart(events, propertyName, days, isEmptyProperty)
        };
    }

    private object ProcessLineChart(List<AnalyticEventDocument> events, string propertyName, int days, bool isEmptyProperty)
    {
        if (isEmptyProperty)
        {
            var dailyCounts = events
                .GroupBy(e => e.Timestamp.Date)
                .Select(g => new { Date = g.Key, Count = g.Count() })
                .OrderBy(x => x.Date)
                .ToList();

            var result = new List<object>();
            for (var i = 0; i < days; i++)
            {
                var date = DateTime.UtcNow.Date.AddDays(-days + i + 1);
                var count = dailyCounts.FirstOrDefault(d => d.Date == date)?.Count ?? 0;
                result.Add(new { date = date.ToString("MMM dd"), count });
            }
            return new { type = "line", data = result };
        }
        else
        {
            var allPropertyValues = events
                .Where(e => e.PropertiesDict.ContainsKey(propertyName))
                .SelectMany(e =>
                {
                    var propValue = e.PropertiesDict[propertyName];
                    if (propValue is string s && s.StartsWith("[\"") && s.EndsWith("\"]"))
                    {
                        try { return s.Trim('[', ']').Replace("\"", "").Split(',').Where(v => !string.IsNullOrWhiteSpace(v)).Select(v => v.Trim()); }
                        catch { return new[] { s }; }
                    }
                    return new[] { propValue?.ToString() ?? "Unknown" };
                })
                .ToList();

            var distribution = allPropertyValues
                .GroupBy(key => key)
                .Select(g => new { label = g.Key, value = g.Count() });

            var sortedDistribution = distribution.OrderByDescending(x => x.value).ThenBy(x => x.label).Take(50).ToList();
            var result = sortedDistribution.Select(d => new { date = d.label, count = d.value }).ToList<object>();
            return new { type = "line", data = result };
        }
    }

    private object ProcessPieChart(List<AnalyticEventDocument> events, string propertyName, bool isEmptyProperty)
    {
        if (isEmptyProperty) return new { type = "pie", data = new[] { new { label = "Total Events", value = events.Count } } };
        
        var allPropertyValues = events
            .Where(e => e.PropertiesDict.ContainsKey(propertyName))
            .SelectMany(e =>
            {
                var propValue = e.PropertiesDict[propertyName];
                if (propValue is string s && s.StartsWith("[\"") && s.EndsWith("\"]"))
                {
                    try { return s.Trim('[', ']').Replace("\"", "").Split(',').Where(v => !string.IsNullOrWhiteSpace(v)).Select(v => v.Trim()); }
                    catch { return new[] { s }; }
                }
                return new[] { propValue?.ToString() ?? "Unknown" };
            })
            .ToList();

        var distribution = allPropertyValues.GroupBy(key => key).Select(g => new { label = g.Key, value = g.Count() }).OrderByDescending(x => x.value).Take(25).ToList();
        return new { type = "pie", data = distribution };
    }

    private object ProcessBarChart(List<AnalyticEventDocument> events, string propertyName, bool isEmptyProperty)
    {
        if (isEmptyProperty)
        {
            var dailyCounts = events.GroupBy(e => e.Timestamp.Date).Select(g => new { label = g.Key.ToString("MMM dd"), value = g.Count() }).OrderBy(x => x.label).Take(25).ToList();
            return new { type = "bar", data = dailyCounts };
        }
        else
        {
            var allPropertyValues = events
                .Where(e => e.PropertiesDict.ContainsKey(propertyName))
                .SelectMany(e =>
                {
                    var propValue = e.PropertiesDict[propertyName];
                    if (propValue is string s && s.StartsWith("[\"") && s.EndsWith("\"]"))
                    {
                        try { return s.Trim('[', ']').Replace("\"", "").Split(',').Where(v => !string.IsNullOrWhiteSpace(v)).Select(v => v.Trim()); }
                        catch { return new[] { s }; }
                    }
                    return new[] { propValue?.ToString() ?? "Unknown" };
                })
                .ToList();

            var distribution = allPropertyValues.GroupBy(key => key).Select(g => new { label = g.Key, value = g.Count() }).OrderByDescending(x => x.value).Take(25).ToList();
            return new { type = "bar", data = distribution };
        }
    }

    private object ProcessNumberCard(List<AnalyticEventDocument> events, string propertyName, bool isEmptyProperty)
    {
        if (isEmptyProperty) return new { type = "number", data = new { total = events.Count, sumValue = 0.0, avgValue = 0.0 } };
        
        var withProperty = events.Count(e => e.PropertiesDict.ContainsKey(propertyName));
        var numericProperties = events
            .Where(e => e.PropertiesDict.ContainsKey(propertyName))
            .Select(e => e.PropertiesDict[propertyName]?.ToString())
            .Where(s => double.TryParse(s, out _))
            .Select(s => double.Parse(s))
            .ToList();

        var sumValue = numericProperties.Sum();
        var avgValue = numericProperties.Any() ? numericProperties.Average() : 0.0;
        var uniqueValues = numericProperties.Distinct().Count();

        return new { type = "number", data = new { total = events.Count, withProperty, uniqueValues, coverage = events.Count > 0 ? (withProperty * 100.0 / events.Count) : 0, sumValue = sumValue, avgValue = avgValue } };
    }
}