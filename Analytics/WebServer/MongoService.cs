using MongoDB.Driver;
using KHSWeb.Models;

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
    
            if (!string.IsNullOrEmpty(query.ProjectId)) // Added project filter
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
    }
}