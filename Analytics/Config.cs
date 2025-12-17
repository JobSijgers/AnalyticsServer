using MongoDB.Driver;

namespace KHSWeb;

public static class Config
{
    public static string AppUrl => Environment.GetEnvironmentVariable("ASPNETCORE_URLS") ?? "http://*:5001";
    public static string MongoConnectionString => Environment.GetEnvironmentVariable("MONGO_CONNECTION_STRING") ?? "mongodb://localhost:27017";
    public static string DeletionPasswordHash => Environment.GetEnvironmentVariable("PROJECT_DELETE_HASH") ?? "8c55b8a724c389f8cea8764c66424dedd59033ea7043b0c08e8d1f676fde5e8c";
    public static string UnityClientToken => Environment.GetEnvironmentVariable("UNITY_CLIENT_TOKEN") ?? "KHS_UNITY_CLIENT_TOKEN";
    
    public const string DatabaseName = "AnalyticsDB";
    public const string MetricsCollectionName = "AnalyticsEvents";
    public const string ChartConfigsCollectionName = "ChartConfigs";
    public const string ChartCacheCollectionName = "ChartCache";
    public const string ProjectImagesCollectionName = "ProjectImages";

    public static string Username => Environment.GetEnvironmentVariable("ADMIN_USERNAME") ?? "KHSAdmin";
    public static string PasswordHash => Environment.GetEnvironmentVariable("ADMIN_PASSWORD_HASH") ?? "c66b6463023a5e39572ea5c1df66599c9c44e637a1c0318324db46315700b6f8";

    private static IMongoDatabase? _database;
    
    public static IMongoDatabase GetDatabase()
    {
        if (_database != null) return _database;
        var client = new MongoClient(MongoConnectionString);
        _database = client.GetDatabase(DatabaseName);
        return _database;
    }
}