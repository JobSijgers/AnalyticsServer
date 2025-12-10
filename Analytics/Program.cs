using KHSWeb;
using Utils;
using KHSWeb.Background;
using KHSWeb.Services;
using Microsoft.Extensions.Hosting;

namespace KHS;

class Program
{
    private static readonly CancellationTokenSource _cts = new();
    private static CacheUpdateService _cacheService = null!;

    static async Task Main(string[] args)
    {
        DebugUtils.SetPrintLevel(DebugUtils.PRINT_LEVEL.ALL);
        DebugUtils.SetPrintCollections(true);

        var webServer = new WebServer();
        await TestMongoConnection();
        new MongoService().EnsureIndexesAsync().Wait();

        try
        {
            DebugUtils.Print("Starting Services...");

            // Start Cache Service
            _cacheService = new CacheUpdateService();
            await _cacheService.StartAsync(_cts.Token);
            DebugUtils.PrintSuccess("Cache Update Service started.");

            // Start Analytics Background Service
            await AnalyticsProcessingService.Instance.StartAsync(_cts.Token);
            DebugUtils.PrintSuccess("Analytics Processing Service started.");
        }
        catch (Exception ex)
        {
            DebugUtils.PrintError($"Failed to start services: {ex.Message}");
        }

        while (true)
        {
            var input = Console.ReadLine()?.ToLower().Trim();

            switch (input)
            {
                case "q":
                    Quit();
                    return;
            }
        }
    }

    private static void Quit()
    {
        DebugUtils.PrintWarning("Shutting down application...");
        _cts.Cancel();

        // Stop Cache Service
        if (_cacheService != null)
        {
            try
            {
                _cacheService.StopAsync(CancellationToken.None).Wait();
            }
            catch (Exception ex)
            {
                DebugUtils.PrintError($"Error stopping cache service: {ex.Message}");
            }
        }

        // Stop Analytics Service
        try
        {
            AnalyticsProcessingService.Instance.StopAsync().Wait();
        }
        catch (Exception ex)
        {
            DebugUtils.PrintError($"Error stopping analytics service: {ex.Message}");
        }

        DebugUtils.PrintWarning("Application shutdown complete");
    }

    static async Task TestMongoConnection()
    {
        try
        {
            var database = Config.GetDatabase();
            await database.ListCollectionNamesAsync();
            DebugUtils.PrintSuccess("MongoDB connection successful!");
        }
        catch (Exception ex)
        {
            DebugUtils.PrintError($"MongoDB connection failed: {ex.Message}");
        }
    }
}