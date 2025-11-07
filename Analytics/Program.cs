using KHSAnalytics.KHSAnalytics;
using KHSWeb;
using Utils;

namespace KHS
{
    class Program
    {
        private static readonly CancellationTokenSource _cts = new();
        public static AnalyticsService? AnalyticsService { get; private set; }

        static void Main(string[] args)
        {
            DebugUtils.SetPrintLevel(DebugUtils.PRINT_LEVEL.ERRORS_WARNINGS_SUCCESS);
            DebugUtils.SetPrintCollections(true);

            // Initialize web server
            var webServer = new WebServer();
            
            // Initialize analytics service (this will automatically start the fetch loop)
            AnalyticsService = new AnalyticsService(_cts.Token);

            Console.WriteLine("Application started successfully!");
            Console.WriteLine("Fetch loop is running and processing configured requests");
            Console.WriteLine("Type 'q' to quit, 'p' to process requests manually, 's' for status");

            while (true)
            {
                var input = Console.ReadLine()?.ToLower().Trim();
                
                switch (input)
                {
                    case "q":
                        Quit();
                        return;
                    case "p":
                        ProcessRequestsManually();
                        break;
                    case "s":
                        ShowStatus();
                        break;
                    case "r":
                        ReloadRequests();
                        break;
                    default:
                        Console.WriteLine("Commands: q=quit, p=process manually, s=status, r=reload requests");
                        break;
                }
            }
        }

        private static void Quit()
        {
            DebugUtils.PrintWarning("Shutting down application...");
            _cts.Cancel();
            AnalyticsService?.StopFetchLoop();
            DebugUtils.PrintWarning("Application shutdown complete");
        }

        private static async void ProcessRequestsManually()
        {
            if (AnalyticsService == null)
            {
                Console.WriteLine("Analytics service not initialized");
                return;
            }

            Console.WriteLine("Manually processing all requests...");
            await AnalyticsService.ProcessAllRequestsNow();
        }

        private static void ShowStatus()
        {
            if (AnalyticsService == null)
            {
                Console.WriteLine("Analytics service not initialized");
                return;
            }

            Console.WriteLine($"Fetch Requests: {AnalyticsService.FetchRequests.Count}");
            foreach (var request in AnalyticsService.FetchRequests)
            {
                Console.WriteLine($"  - {request.Name}: {request.ProjectId} -> {request.EnvironmentId}");
            }
        }

        private static void ReloadRequests()
        {
            if (AnalyticsService == null)
            {
                Console.WriteLine("Analytics service not initialized");
                return;
            }

            AnalyticsService.ReloadFetchRequests();
            Console.WriteLine($"Reloaded {AnalyticsService.FetchRequests.Count} requests");
        }
    }
}