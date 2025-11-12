using KHSWeb;
using Utils;

namespace KHS
{
    class Program
    {
        private static readonly CancellationTokenSource _cts = new();

        static void Main(string[] args)
        {
            DebugUtils.SetPrintLevel(DebugUtils.PRINT_LEVEL.ERRORS_WARNINGS_SUCCESS);
            DebugUtils.SetPrintCollections(true);

            var webServer = new WebServer();
            TestMongoConnection().Wait();
            
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