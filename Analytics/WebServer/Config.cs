using MongoDB.Bson;
using MongoDB.Driver;

public static class Config
{
    public const string AppUrl = "http://localhost:5000";
    public const string MongoConnectionString = "mongodb://analytics_app:JungleBeef@145.223.34.202:27017/AnalyticsDB?authSource=AnalyticsDB";
    public const string DatabaseName = "AnalyticsDB";
    public const string MetricsCollectionName = "AnalyticsEvents";
    public const string UnityClientToken = "KHS_UNITY_CLIENT_TOKEN";

    public const string Username = "KHSAdmin";
    public const string PasswordHash = "c66b6463023a5e39572ea5c1df66599c9c44e637a1c0318324db46315700b6f8";
    
    public static IMongoDatabase GetDatabase()
    {
        var client = new MongoClient(MongoConnectionString);
        var database = client.GetDatabase(DatabaseName);
        
        var statsCommand = new BsonDocument { { "dbStats", 1 } };
        var stats = database.RunCommand<BsonDocument>(statsCommand);

        Console.WriteLine(stats.ToJson());
        return client.GetDatabase(DatabaseName);
    }
}