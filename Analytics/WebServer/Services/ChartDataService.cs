﻿using KHSWeb.Models;
using MongoDB.Driver;
using MongoDB.Driver.Linq;
using Utils;
using System.Text.Json;
using MongoDB.Bson;
using System.Collections.Concurrent;
using KHSWeb.Endpoints;

namespace KHSWeb.Services;

public class ChartDataService
{
    public async Task<object> ProcessChartData(
        string projectId,
        string eventKey,
        string propertyName,
        string chartType,
        int days,
        string filtersJson)
    {
        var database = Config.GetDatabase();
        var collection = database.GetCollection<AnalyticEventDocument>(Config.MetricsCollectionName);

        return await ProcessChartDataWithAggregation(collection, projectId, eventKey, propertyName, chartType, days, filtersJson);
    }

    private async Task<object> ProcessChartDataWithAggregation(
        IMongoCollection<AnalyticEventDocument> collection,
        string projectId,
        string eventKey,
        string propertyName,
        string chartType,
        int days,
        string filtersJson)
    {
        var filterBuilder = Builders<AnalyticEventDocument>.Filter;
        var filters = new List<FilterDefinition<AnalyticEventDocument>>
        {
            filterBuilder.Eq(x => x.Key, eventKey)
        };

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

        if (days >= 36500)
        {
            var dateCheckFilter = filterBuilder.And(filters);
            var firstEntry = await collection.Find(dateCheckFilter)
                .SortBy(x => x.Timestamp)
                .Project(x => x.Timestamp)
                .FirstOrDefaultAsync();

            if (firstEntry != default)
            {
                var timeDiff = DateTime.UtcNow - firstEntry;
                var actualDays = (int)Math.Ceiling(timeDiff.TotalDays);
                days = actualDays < 30 ? 30 : actualDays;
            }
            else
            {
                days = 30;
            }
        }

        var startDate = DateTime.UtcNow.AddDays(-days);
        filters.Add(filterBuilder.Gte(x => x.Timestamp, startDate));

        var finalFilter = filterBuilder.And(filters);
        var isEmptyProperty = string.IsNullOrEmpty(propertyName);
        var typeLower = chartType?.ToLower() ?? "linechart";

        if (projectId == "GLOBAL" && chartType == "BarChart" && string.IsNullOrEmpty(propertyName))
        {
            var aggregation = await collection.Aggregate()
                .Match(finalFilter)
                .Group(new BsonDocument
                {
                    { "_id", "$ProjectId" },
                    { "count", new BsonDocument("$sum", 1) }
                })
                .Sort(new BsonDocument("count", -1))
                .Project(new BsonDocument
                {
                    { "label", new BsonDocument("$concat", new BsonArray 
                        { 
                            new BsonDocument("$cond", new BsonDocument
                            {
                                { "if", new BsonDocument("$eq", new BsonArray { new BsonDocument("$indexOfCP", new BsonArray { "$_id", "_" }), -1 }) },
                                { "then", "$_id" },
                                { "else", new BsonDocument("$substr", new BsonArray { "$_id", new BsonDocument("$add", new BsonArray { new BsonDocument("$indexOfCP", new BsonArray { "$_id", "_" }), 1 }), new BsonDocument("$strLenCP", "$_id") }) }
                            })
                        })
                    },
                    { "value", "$count" }
                })
                .ToListAsync();

            return new { type = "bar", data = aggregation.Select(x => new { label = x["label"].AsString, value = x["count"].AsInt32 }) };
        }

        switch (typeLower)
        {
            case "linechart":
                return await ProcessLineChartAggregation(collection, finalFilter, propertyName, days, projectId, isEmptyProperty);
            
            case "stackedbarchart":
                // FIX: Always use LineChartAggregation (Time-Series) for StackedBarChart
                // This ensures we get data grouped by DATE, which allows stacking over time.
                return await ProcessLineChartAggregation(collection, finalFilter, propertyName, days, projectId, isEmptyProperty);
            
            case "barchart":
                return await ProcessBarChartAggregation(collection, finalFilter, propertyName, projectId, isEmptyProperty);
            
            case "piechart":
                return await ProcessPieChartAggregation(collection, finalFilter, propertyName, projectId, isEmptyProperty);
            
            case "numbercard":
                return await ProcessNumberCardAggregation(collection, finalFilter, propertyName, isEmptyProperty);
            
            default:
                return await ProcessLineChartAggregation(collection, finalFilter, propertyName, days, projectId, isEmptyProperty);
        }
    }

    private async Task<object> ProcessLineChartAggregation(
        IMongoCollection<AnalyticEventDocument> collection,
        FilterDefinition<AnalyticEventDocument> filter,
        string propertyName,
        int days,
        string projectId,
        bool isEmptyProperty)
    {
        if (projectId == "GLOBAL")
        {
            if (!isEmptyProperty)
            {
                return await ProcessGlobalModeWithPropertyAggregation(collection, filter, propertyName, days);
            }
            else
            {
                return await ProcessGlobalModeWithoutPropertyAggregation(collection, filter, days);
            }
        }

        if (!isEmptyProperty)
        {
            var sample = await collection.Find(filter)
                .Project<BsonDocument>(Builders<AnalyticEventDocument>.Projection.Include("Properties." + propertyName))
                .Limit(100)
                .ToListAsync();

            bool isIntegerProperty = IsIntegerPropertySample(sample, propertyName);
            
            if (isIntegerProperty)
            {
                return await ProcessIntegerPropertySumAggregation(collection, filter, propertyName, days);
            }
            else
            {
                return await ProcessCategoricalPropertyLinesAggregation(collection, filter, propertyName, days);
            }
        }

        var aggregation = await collection.Aggregate()
            .Match(filter)
            .Group(new BsonDocument
            {
                { "_id", new BsonDocument("$dateToString", new BsonDocument("format", "%Y-%m-%d").Add("date", "$Timestamp")) },
                { "count", new BsonDocument("$sum", 1) }
            })
            .Sort("_id")
            .ToListAsync();

        var result = new List<object>();
        var allDates = GenerateDateRange(days);

        foreach (var date in allDates)
        {
            var countDoc = aggregation.FirstOrDefault(a => a["_id"].AsString == date.standard);
            result.Add(new { date = date.display, value = countDoc?.GetValue("count", 0).AsInt32 ?? 0 });
        }

        return new { type = "line", data = result };
    }

    private async Task<object> ProcessGlobalModeWithPropertyAggregation(
        IMongoCollection<AnalyticEventDocument> collection,
        FilterDefinition<AnalyticEventDocument> filter,
        string propertyName,
        int days)
    {
        var aggregation = await collection.Aggregate()
            .Match(filter)
            .Project(new BsonDocument
            {
                { "ProjectId", 1 },
                { "Timestamp", 1 },
                { "PropertyValue", "$Properties." + propertyName }  // Changed: Removed $ifNull
            })
            // Add filter to exclude documents without the property
            .Match(new BsonDocument("PropertyValue", new BsonDocument("$exists", true)))
            .Match(new BsonDocument("PropertyValue", new BsonDocument("$ne", BsonNull.Value)))
            .Project(new BsonDocument
            {
                { "ProjectId", 1 },
                { "Timestamp", 1 },
                { "Values", new BsonDocument("$cond", new BsonDocument
                    {
                        { "if", new BsonDocument("$isArray", "$PropertyValue") },
                        { "then", "$PropertyValue" },
                        { "else", new BsonDocument("$cond", new BsonDocument
                            {
                                { "if", new BsonDocument("$regexMatch", new BsonDocument
                                    {
                                        { "input", "$PropertyValue" },
                                        { "regex", new BsonRegularExpression("^\\s*\\[.*\\]\\s*$") }
                                    })
                                },
                                { "then", new BsonDocument("$split", 
                                    new BsonArray { 
                                        new BsonDocument("$trim", new BsonDocument("input", 
                                            new BsonDocument("$substr", new BsonArray { "$PropertyValue", 1, 
                                                new BsonDocument("$subtract", new BsonArray { 
                                                    new BsonDocument("$strLenCP", "$PropertyValue"), 2 
                                                })
                                            })
                                        )),
                                        ","
                                    })
                                },
                                { "else", new BsonArray { "$PropertyValue" } }
                            })
                        }
                    })
                }
            })
            .Unwind("Values")
            .Project(new BsonDocument
            {
                { "ProjectId", 1 },
                { "Timestamp", 1 },
                { "PropertyValue", new BsonDocument("$trim", new BsonDocument("input", "$Values")) }
            })
            .Match(new BsonDocument("PropertyValue", new BsonDocument("$ne", "")))
            .Group(new BsonDocument
            {
                { "_id", new BsonDocument
                    {
                        { "date", new BsonDocument("$dateToString", new BsonDocument("format", "%Y-%m-%d").Add("date", "$Timestamp")) },
                        { "propertyValue", "$PropertyValue" }
                    }
                },
                { "count", new BsonDocument("$sum", 1) }
            })
            .Group(new BsonDocument
            {
                { "_id", "$_id.propertyValue" },
                { "dailyCounts", new BsonDocument("$push", new BsonDocument
                    {
                        { "date", "$_id.date" },
                        { "count", "$count" }
                    })
                },
                { "totalCount", new BsonDocument("$sum", "$count") }
            })
            .Sort(new BsonDocument("totalCount", -1))
            .Limit(15)
            .ToListAsync();

        var multiLineData = new List<object>();
        var allDates = GenerateDateRange(days);

        foreach (var doc in aggregation)
        {
            var propertyValue = doc["_id"].AsString;
            var dailyCounts = doc["dailyCounts"].AsBsonArray.ToDictionary(
                x => x["date"].AsString,
                x => x["count"].AsInt32
            );

            var points = allDates.Select(date => new 
            { 
                date = date.display, 
                count = dailyCounts.ContainsKey(date.standard) ? dailyCounts[date.standard] : 0 
            }).ToList<object>();

            multiLineData.Add(new { label = propertyValue, data = points });
        }

        return new { type = "multiLine", data = multiLineData };
    }

    private async Task<object> ProcessGlobalModeWithoutPropertyAggregation(
        IMongoCollection<AnalyticEventDocument> collection,
        FilterDefinition<AnalyticEventDocument> filter,
        int days)
    {
        var aggregation = await collection.Aggregate()
            .Match(filter)
            .Group(new BsonDocument
            {
                { "_id", new BsonDocument
                    {
                        { "date", new BsonDocument("$dateToString", new BsonDocument("format", "%Y-%m-%d").Add("date", "$Timestamp")) },
                        { "projectId", "$ProjectId" }
                    }
                },
                { "count", new BsonDocument("$sum", 1) }
            })
            .Group(new BsonDocument
            {
                { "_id", "$_id.projectId" },
                { "dailyCounts", new BsonDocument("$push", new BsonDocument
                    {
                        { "date", "$_id.date" },
                        { "count", "$count" }
                    })
                },
                { "totalCount", new BsonDocument("$sum", "$count") }
            })
            .Sort(new BsonDocument("totalCount", -1))
            .Limit(15)
            .ToListAsync();

        var multiLineData = new List<object>();
        var allDates = GenerateDateRange(days);

        foreach (var doc in aggregation)
        {
            var projectId = doc["_id"].AsString;
            var dailyCounts = doc["dailyCounts"].AsBsonArray.ToDictionary(
                x => x["date"].AsString,
                x => x["count"].AsInt32
            );

            var points = allDates.Select(date => new 
            { 
                date = date.display, 
                count = dailyCounts.ContainsKey(date.standard) ? dailyCounts[date.standard] : 0 
            }).ToList<object>();

            multiLineData.Add(new { label = CleanProjectName(projectId), data = points });
        }

        return new { type = "multiLine", data = multiLineData };
    }

    private async Task<object> ProcessIntegerPropertySumAggregation(
        IMongoCollection<AnalyticEventDocument> collection,
        FilterDefinition<AnalyticEventDocument> filter,
        string propertyName,
        int days)
    {
        var aggregation = await collection.Aggregate()
            .Match(filter)
            .Project(new BsonDocument
            {
                { "Timestamp", 1 },
                { "PropertyValue", "$Properties." + propertyName }  // Changed: Removed $ifNull
            })
            // Add filter to exclude documents without the property
            .Match(new BsonDocument("PropertyValue", new BsonDocument("$exists", true)))
            .Match(new BsonDocument("PropertyValue", new BsonDocument("$ne", BsonNull.Value)))
            .Match(new BsonDocument("PropertyValue", new BsonDocument("$regex", new BsonRegularExpression("^\\d+$"))))
            .Group(new BsonDocument
            {
                { "_id", new BsonDocument("$dateToString", new BsonDocument("format", "%Y-%m-%d").Add("date", "$Timestamp")) },
                { "sum", new BsonDocument("$sum", new BsonDocument("$toInt", "$PropertyValue")) }
            })
            .Sort("_id")
            .ToListAsync();

        var result = new List<object>();
        var allDates = GenerateDateRange(days);

        foreach (var date in allDates)
        {
            var sumDoc = aggregation.FirstOrDefault(a => a["_id"].AsString == date.standard);
            result.Add(new { date = date.display, value = sumDoc?.GetValue("sum", 0).AsInt32 ?? 0 });
        }

        return new { type = "line", data = result };
    }

    private async Task<object> ProcessCategoricalPropertyLinesAggregation(
        IMongoCollection<AnalyticEventDocument> collection,
        FilterDefinition<AnalyticEventDocument> filter,
        string propertyName,
        int days)
    {
        var aggregation = await collection.Aggregate()
            .Match(filter)
            .Project(new BsonDocument
            {
                { "Timestamp", 1 },
                { "PropertyValue", "$Properties." + propertyName }  // Changed: Removed $ifNull
            })
            // Add filter to exclude documents without the property
            .Match(new BsonDocument("PropertyValue", new BsonDocument("$exists", true)))
            .Match(new BsonDocument("PropertyValue", new BsonDocument("$ne", BsonNull.Value)))
            .Project(new BsonDocument
            {
                { "Timestamp", 1 },
                { "Values", new BsonDocument("$cond", new BsonDocument
                    {
                        { "if", new BsonDocument("$isArray", "$PropertyValue") },
                        { "then", "$PropertyValue" },
                        { "else", new BsonDocument("$cond", new BsonDocument
                            {
                                { "if", new BsonDocument("$regexMatch", new BsonDocument
                                    {
                                        { "input", "$PropertyValue" },
                                        { "regex", new BsonRegularExpression("^\\s*\\[.*\\]\\s*$") }
                                    })
                                },
                                { "then", new BsonDocument("$split", 
                                    new BsonArray { 
                                        new BsonDocument("$trim", new BsonDocument("input", 
                                            new BsonDocument("$substr", new BsonArray { "$PropertyValue", 1, 
                                                new BsonDocument("$subtract", new BsonArray { 
                                                    new BsonDocument("$strLenCP", "$PropertyValue"), 2 
                                                })
                                            })
                                        )),
                                        ","
                                    })
                                },
                                { "else", new BsonArray { "$PropertyValue" } }
                            })
                        }
                    })
                }
            })
            .Unwind("Values")
            .Project(new BsonDocument
            {
                { "Timestamp", 1 },
                { "PropertyValue", new BsonDocument("$trim", new BsonDocument("input", "$Values")) }
            })
            .Match(new BsonDocument("PropertyValue", new BsonDocument("$ne", "")))
            .Group(new BsonDocument
            {
                { "_id", new BsonDocument
                    {
                        { "date", new BsonDocument("$dateToString", new BsonDocument("format", "%Y-%m-%d").Add("date", "$Timestamp")) },
                        { "propertyValue", "$PropertyValue" }
                    }
                },
                { "count", new BsonDocument("$sum", 1) }
            })
            .Group(new BsonDocument
            {
                { "_id", "$_id.propertyValue" },
                { "dailyCounts", new BsonDocument("$push", new BsonDocument
                    {
                        { "date", "$_id.date" },
                        { "count", "$count" }
                    })
                },
                { "totalCount", new BsonDocument("$sum", "$count") }
            })
            .Sort(new BsonDocument("totalCount", -1))
            .Limit(20)
            .ToListAsync();

        var multiLineData = new List<object>();
        var allDates = GenerateDateRange(days);

        foreach (var doc in aggregation)
        {
            var propertyValue = doc["_id"].AsString;
            var dailyCounts = doc["dailyCounts"].AsBsonArray.ToDictionary(
                x => x["date"].AsString,
                x => x["count"].AsInt32
            );

            var points = allDates.Select(date => new 
            { 
                date = date.display, 
                count = dailyCounts.ContainsKey(date.standard) ? dailyCounts[date.standard] : 0 
            }).ToList<object>();

            multiLineData.Add(new { label = propertyValue, data = points });
        }

        return new { type = "multiLine", data = multiLineData };
    }

    private async Task<object> ProcessBarChartAggregation(
        IMongoCollection<AnalyticEventDocument> collection,
        FilterDefinition<AnalyticEventDocument> filter,
        string propertyName,
        string projectId,
        bool isEmptyProperty)
    {
        if (isEmptyProperty)
        {
            var aggregation = await collection.Aggregate()
                .Match(filter)
                .Group(new BsonDocument
                {
                    { "_id", new BsonDocument("$dateToString", new BsonDocument("format", "%Y-%m-%d").Add("date", "$Timestamp")) },
                    { "count", new BsonDocument("$sum", 1) }
                })
                .Sort("_id")
                .Limit(100)
                .ToListAsync();

            var data = aggregation.Select(doc => new 
            { 
                label = DateTime.Parse(doc["_id"].AsString).ToString("MMM dd"), 
                value = doc["count"].AsInt32 
            }).ToList<object>();

            return new { type = "bar", data = data };
        }

        return await ProcessDistributionAggregation(collection, filter, propertyName, "bar", projectId);
    }

    private async Task<object> ProcessPieChartAggregation(
        IMongoCollection<AnalyticEventDocument> collection,
        FilterDefinition<AnalyticEventDocument> filter,
        string propertyName,
        string projectId,
        bool isEmptyProperty)
    {
        if (isEmptyProperty)
        {
            var count = await collection.CountDocumentsAsync(filter);
            return new { type = "pie", data = new[] { new { label = "Total Events", value = count } } };
        }

        return await ProcessDistributionAggregation(collection, filter, propertyName, "pie", projectId);
    }

    private async Task<object> ProcessDistributionAggregation(
        IMongoCollection<AnalyticEventDocument> collection,
        FilterDefinition<AnalyticEventDocument> filter,
        string propertyName,
        string type,
        string projectId)
    {
        var aggregation = await collection.Aggregate()
            .Match(filter)
            .Project(new BsonDocument
            {
                { "ProjectId", 1 },
                { "PropertyValue", "$Properties." + propertyName }  // Changed: Removed $ifNull
            })
            // Add filter to exclude documents without the property
            .Match(new BsonDocument("PropertyValue", new BsonDocument("$exists", true)))
            .Match(new BsonDocument("PropertyValue", new BsonDocument("$ne", BsonNull.Value)))
            .Project(new BsonDocument
            {
                { "ProjectId", 1 },
                { "Values", new BsonDocument("$cond", new BsonDocument
                    {
                        { "if", new BsonDocument("$isArray", "$PropertyValue") },
                        { "then", "$PropertyValue" },
                        { "else", new BsonDocument("$cond", new BsonDocument
                            {
                                { "if", new BsonDocument("$regexMatch", new BsonDocument
                                    {
                                        { "input", "$PropertyValue" },
                                        { "regex", new BsonRegularExpression("^\\s*\\[.*\\]\\s*$") }
                                    })
                                },
                                { "then", new BsonDocument("$split", 
                                    new BsonArray { 
                                        new BsonDocument("$trim", new BsonDocument("input", 
                                            new BsonDocument("$substr", new BsonArray { "$PropertyValue", 1, 
                                                new BsonDocument("$subtract", new BsonArray { 
                                                    new BsonDocument("$strLenCP", "$PropertyValue"), 2 
                                                })
                                            })
                                        )),
                                        ","
                                    })
                                },
                                { "else", new BsonArray { "$PropertyValue" } }
                            })
                        }
                    })
                }
            })
            .Unwind("Values")
            .Project(new BsonDocument
            {
                { "ProjectId", 1 },
                { "Value", new BsonDocument("$trim", new BsonDocument("input", "$Values")) }
            })
            .Match(new BsonDocument("Value", new BsonDocument("$ne", "")))
            .Group(new BsonDocument
            {
                { "_id", "$Value" },
                { "count", new BsonDocument("$sum", 1) },
                { "projects", new BsonDocument("$addToSet", "$ProjectId") }
            })
            .Project(new BsonDocument
            {
                { "label", "$_id" },
                { "value", "$count" },
                { "projectCount", new BsonDocument("$size", "$projects") }
            })
            .Match(projectId == "GLOBAL" ? 
                new BsonDocument("projectCount", new BsonDocument("$gte", 2)) : 
                new BsonDocument())
            .Sort(new BsonDocument("value", -1))
            .Limit(100)
            .ToListAsync();

        var distribution = aggregation.Select(doc => new 
        { 
            label = doc["label"].AsString, 
            value = doc["value"].AsInt32 
        }).ToList();

        if (type == "line")
        {
            var lineData = distribution.Select(d => new { label = d.label, value = d.value }).ToList<object>();
            return new { type = "line", data = lineData };
        }

        return new { type = type, data = distribution };
    }

    private async Task<object> ProcessNumberCardAggregation(
        IMongoCollection<AnalyticEventDocument> collection,
        FilterDefinition<AnalyticEventDocument> filter,
        string propertyName,
        bool isEmptyProperty)
    {
        if (isEmptyProperty)
        {
            var count = await collection.CountDocumentsAsync(filter);
            return new { type = "number", data = new { total = count, sumValue = 0.0, avgValue = 0.0 } };
        }

        var aggregation = await collection.Aggregate()
            .Match(filter)
            .Project(new BsonDocument
            {
                { "PropertyValue", "$Properties." + propertyName }  // Changed: Removed $ifNull
            })
            // Add filter to exclude documents without the property
            .Match(new BsonDocument("PropertyValue", new BsonDocument("$exists", true)))
            .Match(new BsonDocument("PropertyValue", new BsonDocument("$ne", BsonNull.Value)))
            .Match(new BsonDocument("PropertyValue", new BsonDocument("$regex", new BsonRegularExpression("^-?\\d+(\\.\\d+)?$"))))
            .Group(new BsonDocument
            {
                { "_id", BsonNull.Value },
                { "total", new BsonDocument("$sum", 1) },
                { "sumValue", new BsonDocument("$sum", new BsonDocument("$toDouble", "$PropertyValue")) },
                { "avgValue", new BsonDocument("$avg", new BsonDocument("$toDouble", "$PropertyValue")) }
            })
            .FirstOrDefaultAsync();

        if (aggregation == null)
        {
            return new { type = "number", data = new { total = 0, sumValue = 0.0, avgValue = 0.0 } };
        }

        return new { type = "number", data = new 
        { 
            total = aggregation.GetValue("total", 0).AsInt32, 
            sumValue = aggregation.GetValue("sumValue", 0.0).AsDouble, 
            avgValue = aggregation.GetValue("avgValue", 0.0).AsDouble 
        } };
    }

    private List<(string standard, string display)> GenerateDateRange(int days)
    {
        var dates = new List<(string, string)>();
        for (var i = 0; i < days; i++)
        {
            var date = DateTime.UtcNow.Date.AddDays(-days + i + 1);
            dates.Add((date.ToString("yyyy-MM-dd"), date.ToString("MMM dd")));
        }
        return dates;
    }

    private bool IsIntegerPropertySample(List<BsonDocument> sample, string propertyName)
    {
        if (sample.Count == 0) return false;

        var fieldPath = "Properties." + propertyName;
        int integerCount = 0;

        foreach (var doc in sample)
        {
            if (doc.Contains(fieldPath))
            {
                var value = doc[fieldPath];
                if (value.IsString && int.TryParse(value.AsString, out _))
                {
                    integerCount++;
                }
                else if (value.IsInt32 || value.IsInt64)
                {
                    integerCount++;
                }
                else if (value.IsBsonArray)
                {
                    var array = value.AsBsonArray;
                    if (array.Count > 0 && array[0].IsString && int.TryParse(array[0].AsString, out _))
                    {
                        integerCount++;
                    }
                    else if (array.Count > 0 && (array[0].IsInt32 || array[0].IsInt64))
                    {
                        integerCount++;
                    }
                }
            }
        }

        return (integerCount * 1.0 / sample.Count) > 0.8;
    }

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

        return (condition.Operator switch
        {
            "=" => builder.Eq(fieldName, val),
            "!=" => builder.Ne(fieldName, val),
            ">" => builder.Gt(fieldName, val),
            "<" => builder.Lt(fieldName, val),
            ">=" => builder.Gte(fieldName, val),
            "<=" => builder.Lte(fieldName, val),
            _ => null
        })!;
    }
}