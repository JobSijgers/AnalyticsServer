using MongoDB.Driver;

public static class Config
{
    public static string AppUrl { get; set; } = "http://localhost:5000";
    public static string MongoConnectionString { get; set; } = "mongodb://localhost:27017";
    public static string DatabaseName { get; set; } = "AnalyticsDB";
    public static string MetricsCollectionName { get; set; } = "metrics";
    
    public static IMongoDatabase GetDatabase()
    {
        var client = new MongoClient(MongoConnectionString);
        return client.GetDatabase(DatabaseName);
    }
}