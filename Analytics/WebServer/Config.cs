using MongoDB.Bson;
using MongoDB.Driver;

public static class Config
{
    public static string AppUrl => Environment.GetEnvironmentVariable("ASPNETCORE_URLS") ?? "https://*:5000";
    public const string MongoConnectionString = "mongodb://analytics_app:JungleBeef@localhost:27017/AnalyticsDB?authSource=AnalyticsDB";
    public const string DatabaseName = "AnalyticsDB";
    public const string MetricsCollectionName = "AnalyticsEvents";
    public const string ChartConfigsCollectionName = "ChartConfigs";
    public const string ChartCacheCollectionName = "ChartCache";
    public const string ProjectImagesCollectionName = "ProjectImages";
    public const string UnityClientToken = "KHS_UNITY_CLIENT_TOKEN";

    public const string Username = "KHSAdmin";
    public const string PasswordHash = "c66b6463023a5e39572ea5c1df66599c9c44e637a1c0318324db46315700b6f8";

    private static IMongoDatabase? _database;
    
    public static IMongoDatabase GetDatabase()
    {
        if (_database != null)
            return _database;
        
        var client = new MongoClient(MongoConnectionString);
        var database = client.GetDatabase(DatabaseName);
        
        _database = database;
        return database;
    }
}