using KHSWeb.Models;
using MongoDB.Driver;
using Utils;


namespace KHSWeb.Endpoints;

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
            var propertyName = context.Request.Query["propertyName"].ToString(); // Optional
            var chartType = context.Request.Query["chartType"].ToString();
            var days = int.TryParse(context.Request.Query["days"], out int d) ? d : 30;

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
            var filter = Builders<AnalyticEventDocument>.Filter.And(
                Builders<AnalyticEventDocument>.Filter.Eq(x => x.ProjectId, projectId),
                Builders<AnalyticEventDocument>.Filter.Eq(x => x.Key, eventKey),
                Builders<AnalyticEventDocument>.Filter.Gte(x => x.Timestamp, startDate)
            );

            var events = await collection.Find(filter)
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

    private object ProcessChartData(List<AnalyticEventDocument> events, string propertyName, string chartType, int days)
    {
        // Handle empty property name (count events)
        var isEmptyProperty = string.IsNullOrEmpty(propertyName);
        
        return chartType?.ToLower() switch
        {
            "linechart" => ProcessLineChart(events, propertyName, days, isEmptyProperty),
            "piechart" => ProcessPieChart(events, propertyName, isEmptyProperty),
            "barchart" => ProcessBarChart(events, propertyName, isEmptyProperty),
            "numbercard" => ProcessNumberCard(events, propertyName, isEmptyProperty),
            "donutchart" => ProcessDonutChart(events, propertyName, isEmptyProperty),
            "areachart" => ProcessAreaChart(events, propertyName, days, isEmptyProperty),
            _ => ProcessLineChart(events, propertyName, days, isEmptyProperty) // Default
        };
    }

    private object ProcessLineChart(List<AnalyticEventDocument> events, string propertyName, int days, bool isEmptyProperty)
    {
        if (isEmptyProperty)
        {
            // Count events over time
            var dailyCounts = events
                .GroupBy(e => e.Timestamp.Date)
                .Select(g => new { Date = g.Key, Count = g.Count() })
                .OrderBy(x => x.Date)
                .ToList();

            // Fill in missing days
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
            // Show property value distribution over time (simplified)
            var dailyPropertyValues = events
                .Where(e => e.PropertiesDict.ContainsKey(propertyName))
                .GroupBy(e => e.Timestamp.Date)
                .Select(g => new { 
                    Date = g.Key, 
                    Count = g.Count(),
                    AvgValue = g.Average(e => Convert.ToDouble(e.PropertiesDict[propertyName] ?? 0))
                })
                .OrderBy(x => x.Date)
                .ToList();

            var result = new List<object>();
            for (var i = 0; i < days; i++)
            {
                var date = DateTime.UtcNow.Date.AddDays(-days + i + 1);
                var dailyData = dailyPropertyValues.FirstOrDefault(d => d.Date == date);
                result.Add(new { 
                    date = date.ToString("MMM dd"), 
                    count = dailyData?.Count ?? 0,
                    value = dailyData?.AvgValue ?? 0
                });
            }

            return new { type = "line", data = result };
        }
    }

    private object ProcessPieChart(List<AnalyticEventDocument> events, string propertyName, bool isEmptyProperty)
    {
        if (isEmptyProperty)
        {
            // Just show total count as a single slice
            return new { 
                type = "pie", 
                data = new[] { new { label = "Total Events", value = events.Count } } 
            };
        }
        else
        {
            // Show property value distribution
            var distribution = events
                .Where(e => e.PropertiesDict.ContainsKey(propertyName))
                .GroupBy(e => e.PropertiesDict[propertyName]?.ToString() ?? "Unknown")
                .Select(g => new { label = g.Key, value = g.Count() })
                .OrderByDescending(x => x.value)
                .Take(8) // Limit to top 8 values
                .ToList();

            return new { type = "pie", data = distribution };
        }
    }

    private object ProcessBarChart(List<AnalyticEventDocument> events, string propertyName, bool isEmptyProperty)
    {
        if (isEmptyProperty)
        {
            // Show events by day
            var dailyCounts = events
                .GroupBy(e => e.Timestamp.Date)
                .Select(g => new { label = g.Key.ToString("MMM dd"), value = g.Count() })
                .OrderBy(x => x.label)
                .Take(14) // Last 14 days
                .ToList();

            return new { type = "bar", data = dailyCounts };
        }
        else
        {
            // Show property value distribution
            var distribution = events
                .Where(e => e.PropertiesDict.ContainsKey(propertyName))
                .GroupBy(e => e.PropertiesDict[propertyName]?.ToString() ?? "Unknown")
                .Select(g => new { label = g.Key, value = g.Count() })
                .OrderByDescending(x => x.value)
                .Take(10)
                .ToList();

            return new { type = "bar", data = distribution };
        }
    }

    private object ProcessNumberCard(List<AnalyticEventDocument> events, string propertyName, bool isEmptyProperty)
    {
        if (isEmptyProperty)
        {
            return new { 
                type = "number", 
                data = new { total = events.Count } 
            };
        }
        else
        {
            var withProperty = events.Count(e => e.PropertiesDict.ContainsKey(propertyName));
            var uniqueValues = events
                .Where(e => e.PropertiesDict.ContainsKey(propertyName))
                .Select(e => e.PropertiesDict[propertyName]?.ToString())
                .Distinct()
                .Count();

            return new { 
                type = "number", 
                data = new { 
                    total = events.Count,
                    withProperty,
                    uniqueValues,
                    coverage = events.Count > 0 ? (withProperty * 100.0 / events.Count) : 0
                }
            };
        }
    }

    private object ProcessDonutChart(List<AnalyticEventDocument> events, string propertyName, bool isEmptyProperty)
    {
        // Same logic as pie chart
        var pieData = ProcessPieChart(events, propertyName, isEmptyProperty);
        return new { type = "doughnut", data = ((dynamic)pieData).data };
    }

    private object ProcessAreaChart(List<AnalyticEventDocument> events, string propertyName, int days, bool isEmptyProperty)
    {
        // Cumulative events over time
        var dailyCounts = events
            .GroupBy(e => e.Timestamp.Date)
            .Select(g => new { Date = g.Key, Count = g.Count() })
            .OrderBy(x => x.Date)
            .ToList();

        // Fill in missing days and calculate cumulative sum
        var result = new List<object>();
        var cumulative = 0;
        
        for (var i = 0; i < days; i++)
        {
            var date = DateTime.UtcNow.Date.AddDays(-days + i + 1);
            var dailyCount = dailyCounts.FirstOrDefault(d => d.Date == date)?.Count ?? 0;
            cumulative += dailyCount;
            result.Add(new { date = date.ToString("MMM dd"), count = cumulative });
        }

        return new { type = "line", data = result }; // Area chart is just a filled line chart
    }
}