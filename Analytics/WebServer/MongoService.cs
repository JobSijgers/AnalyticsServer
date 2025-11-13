// [file name]: MongoService.cs (updated)
using MongoDB.Driver;
using KHSWeb.Models;
using System.Text.Json;

namespace KHSWeb.Services
{
    public class MongoService
    {
        private readonly IMongoCollection<MetricDocument> _metrics;

        public MongoService()
        {
            var database = Config.GetDatabase();
            _metrics = database.GetCollection<MetricDocument>(Config.MetricsCollectionName);
            
            // Create indexes for better query performance
            CreateIndexes();
        }

        private void CreateIndexes()
        {
            var indexKeys = Builders<MetricDocument>.IndexKeys
                .Ascending(m => m.MetricKey)
                .Ascending(m => m.Category)
                .Ascending(m => m.Source)
                .Descending(m => m.Timestamp);
            
            _metrics.Indexes.CreateOne(new CreateIndexModel<MetricDocument>(indexKeys));
        }

        public async Task<string> InsertMetricAsync(MetricDocument metric)
        {
            await _metrics.InsertOneAsync(metric);
            return metric.Id;
        }

        public async Task<List<MetricDocument>> GetMetricsAsync(MetricQuery query)
        {
            var filterBuilder = Builders<MetricDocument>.Filter;
            var filter = filterBuilder.Empty;

            if (!string.IsNullOrEmpty(query.MetricKey))
                filter &= filterBuilder.Eq(m => m.MetricKey, query.MetricKey);
    
            if (!string.IsNullOrEmpty(query.Category))
                filter &= filterBuilder.Eq(m => m.Category, query.Category);
    
            if (!string.IsNullOrEmpty(query.Source))
                filter &= filterBuilder.Eq(m => m.Source, query.Source);
    
            if (!string.IsNullOrEmpty(query.ProjectId))
                filter &= filterBuilder.Eq(m => m.ProjectId, query.ProjectId);
    
            if (query.StartDate.HasValue)
                filter &= filterBuilder.Gte(m => m.Timestamp, query.StartDate.Value);
    
            if (query.EndDate.HasValue)
                filter &= filterBuilder.Lte(m => m.Timestamp, query.EndDate.Value);

            return await _metrics
                .Find(filter)
                .SortByDescending(m => m.Timestamp)
                .Skip(query.Skip)
                .Limit(query.Limit)
                .ToListAsync();
        }

        public async Task<List<string>> GetMetricTypesAsync()
        {
            return await _metrics
                .Distinct<string>("MetricKey", FilterDefinition<MetricDocument>.Empty)
                .ToListAsync();
        }

        public async Task<List<MetricDocument>> GetMetricsByKeyAsync(string metricKey, int limit = 100)
        {
            return await _metrics
                .Find(m => m.MetricKey == metricKey)
                .SortByDescending(m => m.Timestamp)
                .Limit(limit)
                .ToListAsync();
        }

        public async Task<List<MetricDocument>> ExportMetricsAsync(DateTime? startDate = null, DateTime? endDate = null)
        {
            var filterBuilder = Builders<MetricDocument>.Filter;
            var filter = filterBuilder.Empty;

            if (startDate.HasValue)
                filter &= filterBuilder.Gte(m => m.Timestamp, startDate.Value);
            
            if (endDate.HasValue)
                filter &= filterBuilder.Lte(m => m.Timestamp, endDate.Value);

            return await _metrics
                .Find(filter)
                .SortByDescending(m => m.Timestamp)
                .Limit(1000) 
                .ToListAsync();
        }

        // New methods for dashboard
        public async Task<List<string>> GetProjectsAsync()
        {
            return await _metrics
                .Distinct<string>("ProjectId", FilterDefinition<MetricDocument>.Empty)
                .ToListAsync();
        }

        public async Task<List<string>> GetCategoriesAsync(string projectId)
        {
            var filter = Builders<MetricDocument>.Filter.Eq(m => m.ProjectId, projectId);
            return await _metrics
                .Distinct<string>("Category", filter)
                .ToListAsync();
        }

        public async Task<DashboardSummary> GetDashboardSummaryAsync(string projectId, string category = null)
        {
            var filterBuilder = Builders<MetricDocument>.Filter;
            var filter = filterBuilder.Eq(m => m.ProjectId, projectId);
    
            if (!string.IsNullOrEmpty(category))
                filter &= filterBuilder.Eq(m => m.Category, category);

            // Get top metrics by frequency (we only need this now)
            var topMetrics = await _metrics.Aggregate()
                .Match(filter)
                .Group(m => m.MetricKey, g => new MetricFrequency 
                { 
                    MetricKey = g.Key, 
                    Count = g.Count() 
                })
                .SortByDescending(m => m.Count)
                .Limit(10) // Increased limit for better chart data
                .ToListAsync();

            return new DashboardSummary
            {
                TopMetrics = topMetrics
            };
        }
    }
}