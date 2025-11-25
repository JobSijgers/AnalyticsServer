using KHSWeb.Models;
using MongoDB.Driver;
using Utils;
using System.Text.Json;
using MongoDB.Bson; 

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
                return Results.Json(new ApiResponse<ChartDataResponse> { Success = false, Message = "Required fields missing" }, statusCode: 400);
            }

            var database = Config.GetDatabase();
            var collection = database.GetCollection<AnalyticEventDocument>(Config.MetricsCollectionName);
            var startDate = DateTime.UtcNow.AddDays(-days);
            var filterBuilder = Builders<AnalyticEventDocument>.Filter;
            var filters = new List<FilterDefinition<AnalyticEventDocument>>();

            filters.Add(filterBuilder.Eq(x => x.Key, eventKey));
            filters.Add(filterBuilder.Gte(x => x.Timestamp, startDate));

            if (projectId != "GLOBAL")
            {
                filters.Add(filterBuilder.Eq(x => x.ProjectId, projectId));
            }

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
                            if (dynamicFilter != null) filters.Add(dynamicFilter);
                        }
                    }
                }
                catch (Exception ex) { DebugUtils.PrintError($"Filter parse error: {ex.Message}"); }
            }

            var finalFilter = filterBuilder.And(filters);
            var events = await collection.Find(finalFilter).SortBy(x => x.Timestamp).ToListAsync();

            // Special Case: Global Bar Chart (Project Counts Summary)
            if (projectId == "GLOBAL" && chartType == "BarChart" && string.IsNullOrEmpty(propertyName))
            {
                var projectGroups = events
                    .GroupBy(e => e.ProjectId)
                    .Select(g => new { Label = CleanProjectName(g.Key), Value = g.Count() })
                    .OrderByDescending(x => x.Value)
                    .ToList();

                return Results.Json(new ApiResponse<ChartDataResponse>
                {
                    Success = true,
                    Data = new ChartDataResponse 
                    { 
                        ChartData = new { type = "bar", data = projectGroups.Select(x => new { label = x.Label, value = x.Value }) }
                    }
                });
            }

            var chartData = ProcessChartData(events, propertyName, chartType, days, projectId);

            return Results.Json(new ApiResponse<ChartDataResponse>
            {
                Success = true,
                Data = new ChartDataResponse { ChartData = chartData }
            });
        }
        catch (Exception ex)
        {
            return Results.Json(new ApiResponse<ChartDataResponse> { Success = false, Message = ex.Message }, statusCode: 500);
        }
    };

    private string CleanProjectName(string projectId)
    {
        if (string.IsNullOrEmpty(projectId)) return "Unknown";
        int idx = projectId.IndexOf('_');
        return idx >= 0 ? projectId.Substring(idx + 1) : projectId;
    }

    private FilterDefinition<AnalyticEventDocument> BuildDynamicFilter(FilterDefinitionBuilder<AnalyticEventDocument> builder, FilterCondition condition)
    {
        var fieldName = $"Properties.{condition.Property}";
        object val = condition.Value;
        bool isNumericComparison = false;
        
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

        if (isNumericComparison)
        {
             var mongoOp = condition.Operator switch {
                 "=" => "$eq", "!=" => "$ne", ">" => "$gt", "<" => "$lt", ">=" => "$gte", "<=" => "$lte", _ => "$eq"
             };
             return new BsonDocument("$expr", new BsonDocument(mongoOp, new BsonArray { new BsonDocument("$toDouble", $"${fieldName}"), BsonValue.Create(val) }));
        }

        if (val is bool boolVal && condition.Operator == "=")
        {
            return builder.Or(builder.Eq(fieldName, boolVal), builder.Eq(fieldName, boolVal.ToString()), builder.Eq(fieldName, boolVal.ToString().ToLower()));
        }

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

    private object ProcessChartData(List<AnalyticEventDocument> events, string propertyName, string chartType, int days, string projectId)
    {
        var isEmptyProperty = string.IsNullOrEmpty(propertyName);
        var typeLower = chartType?.ToLower() ?? "linechart";

        switch (typeLower)
        {
            case "linechart":
                return ProcessLineChart(events, propertyName, days, isEmptyProperty, projectId);

            case "stackedbarchart":
                // GLOBAL: Stacked Bar follows time-series logic (MultiLine)
                // SINGLE: Stacked Bar follows distribution logic (Standard Bar)
                if (projectId == "GLOBAL")
                    return ProcessLineChart(events, propertyName, days, isEmptyProperty, projectId);
                else
                    return ProcessBarChart(events, propertyName, isEmptyProperty, projectId);

            case "barchart":
                return ProcessBarChart(events, propertyName, isEmptyProperty, projectId);

            case "piechart":
                return ProcessPieChart(events, propertyName, isEmptyProperty, projectId);

            case "numbercard":
                return ProcessNumberCard(events, propertyName, isEmptyProperty);

            default:
                return ProcessLineChart(events, propertyName, days, isEmptyProperty, projectId);
        }
    }

    private object ProcessLineChart(List<AnalyticEventDocument> events, string propertyName, int days, bool isEmptyProperty, string projectId)
    {
        // GLOBAL MODE: Always split by ProjectID for Line/StackedBar Charts
        if (projectId == "GLOBAL")
        {
            var filteredEvents = events;
            if (!isEmptyProperty)
            {
                filteredEvents = events.Where(e => e.PropertiesDict.ContainsKey(propertyName)).ToList();
            }

            var projectGroups = filteredEvents
                .GroupBy(e => e.ProjectId)
                .OrderByDescending(g => g.Count())
                .Take(15) // Limit to top 15 projects
                .ToList();

            var multiLineData = new List<object>();

            foreach (var group in projectGroups)
            {
                var pName = CleanProjectName(group.Key);
                var dailyCounts = group.GroupBy(e => e.Timestamp.Date)
                                       .Select(g => new { Date = g.Key, Count = g.Count() })
                                       .ToList();

                var points = new List<object>();
                for (var i = 0; i < days; i++)
                {
                    var date = DateTime.UtcNow.Date.AddDays(-days + i + 1);
                    var count = dailyCounts.FirstOrDefault(d => d.Date == date)?.Count ?? 0;
                    points.Add(new { date = date.ToString("MMM dd"), count });
                }
                multiLineData.Add(new { label = pName, data = points });
            }

            return new { type = "multiLine", data = multiLineData };
        }

        // SINGLE PROJECT MODE
        if (isEmptyProperty)
        {
            var dailyCounts = events.GroupBy(e => e.Timestamp.Date).Select(g => new { Date = g.Key, Count = g.Count() }).ToList();
            var result = new List<object>();
            for (var i = 0; i < days; i++)
            {
                var date = DateTime.UtcNow.Date.AddDays(-days + i + 1);
                var count = dailyCounts.FirstOrDefault(d => d.Date == date)?.Count ?? 0;
                result.Add(new { date = date.ToString("MMM dd"), count });
            }
            return new { type = "line", data = result };
        }

        return ProcessDistribution(events, propertyName, "line", projectId); 
    }

    private object ProcessPieChart(List<AnalyticEventDocument> events, string propertyName, bool isEmptyProperty, string projectId)
    {
        if (isEmptyProperty) return new { type = "pie", data = new[] { new { label = "Total Events", value = events.Count } } };
        return ProcessDistribution(events, propertyName, "pie", projectId);
    }

    private object ProcessBarChart(List<AnalyticEventDocument> events, string propertyName, bool isEmptyProperty, string projectId)
    {
        if (isEmptyProperty)
        {
            var dailyCounts = events.GroupBy(e => e.Timestamp.Date).Select(g => new { label = g.Key.ToString("MMM dd"), value = g.Count() }).OrderBy(x => x.label).Take(100).ToList();
            return new { type = "bar", data = dailyCounts };
        }
        return ProcessDistribution(events, propertyName, "bar", projectId);
    }

    private object ProcessDistribution(List<AnalyticEventDocument> events, string propertyName, string type, string projectId)
    {
        var propertyData = events
            .Where(e => e.PropertiesDict.ContainsKey(propertyName))
            .SelectMany(e =>
            {
                var propValue = e.PropertiesDict[propertyName];
                IEnumerable<string> values;
                
                if (propValue is string s && s.StartsWith("[\"") && s.EndsWith("\"]")) {
                    try { 
                        values = s.Trim('[', ']').Replace("\"", "").Split(',').Where(v => !string.IsNullOrWhiteSpace(v)).Select(v => v.Trim()); 
                    }
                    catch { values = new[] { s }; }
                }
                else {
                    values = new[] { propValue?.ToString() ?? "Unknown" };
                }
                
                return values.Select(val => new { Value = val, ProjectId = e.ProjectId });
            }).ToList();

        var groupedData = propertyData.GroupBy(x => x.Value);

        if (projectId == "GLOBAL")
        {
            groupedData = groupedData.Where(g => g.Select(x => x.ProjectId).Distinct().Count() >= 2);
        }

        var distribution = groupedData
            .Select(g => new { label = g.Key, value = g.Count() })
            .OrderByDescending(x => x.value)
            .Take(100)
            .ToList();
            
        if (type == "line") {
             var lineData = distribution.Select(d => new { date = d.label, count = d.value }).ToList<object>();
             return new { type = "line", data = lineData };
        }

        return new { type = type, data = distribution };
    }

    private object ProcessNumberCard(List<AnalyticEventDocument> events, string propertyName, bool isEmptyProperty)
    {
        if (isEmptyProperty) return new { type = "number", data = new { total = events.Count, sumValue = 0.0, avgValue = 0.0 } };
        
        var numericProperties = events.Where(e => e.PropertiesDict.ContainsKey(propertyName))
            .Select(e => e.PropertiesDict[propertyName]?.ToString())
            .Where(s => double.TryParse(s, out _)).Select(s => double.Parse(s)).ToList();

        return new { type = "number", data = new { total = events.Count, sumValue = numericProperties.Sum(), avgValue = numericProperties.Any() ? numericProperties.Average() : 0.0 } };
    }
}