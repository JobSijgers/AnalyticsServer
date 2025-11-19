// [file name]: MongoService.cs (updated)
using MongoDB.Driver;
using KHSWeb.Models;
using System.Text.Json;

namespace KHSWeb.Services
{
    public class MongoService
    {
        private readonly IMongoCollection<AnalyticEventDocument> events;

        public MongoService()
        {
            var database = Config.GetDatabase();
            events = database.GetCollection<AnalyticEventDocument>(Config.MetricsCollectionName);
            
            CreateIndexes();
        }

        private void CreateIndexes()
        {
            var indexKeys = Builders<AnalyticEventDocument>.IndexKeys
                .Ascending(m => m.Key)
                .Descending(m => m.Timestamp);
            
            events.Indexes.CreateOne(new CreateIndexModel<AnalyticEventDocument>(indexKeys));
        }

        public async Task<string> InsertAnalyticsEventAsync(AnalyticEventDocument analyticEvent)
        {
            await events.InsertOneAsync(analyticEvent);
            return analyticEvent.Id;
        }

        public async Task<List<string>> GetProjectsAsync()
        {
            return await events
                .Distinct<string>("ProjectId", FilterDefinition<AnalyticEventDocument>.Empty)
                .ToListAsync();
        }
    }
}