using KHSWeb;
using Utils;
using KHSWeb.Background;
using KHSWeb.Services; // Required for CacheUpdateService
using Microsoft.Extensions.Hosting; // Required for StartAsync/StopAsync

namespace KHS
{
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
                DebugUtils.Print("Starting Cache Update Service...");
                _cacheService = new CacheUpdateService();
                await _cacheService.StartAsync(_cts.Token);
                DebugUtils.PrintSuccess("Cache Update Service is running in the background.");
            }
            catch (Exception ex)
            {
                DebugUtils.PrintError($"Failed to start Cache Update Service: {ex.Message}");
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

            if (_cacheService != null)
            {
                try 
                {
                    _cacheService.StopAsync(CancellationToken.None).Wait();
                }
                catch (Exception ex)
                {
                    DebugUtils.PrintError($"Error stopping service: {ex.Message}");
                }
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
}