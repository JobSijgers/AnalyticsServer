using KHSAnalytics.KHSAnalytics.KHSAnalytics;
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

            var webServer = new WebServer();
            AnalyticsService = new AnalyticsService(_cts.Token);

            while (true)
            {
                var input = Console.ReadLine();
                if (input == "q")
                {
                    Quit();
                    break;
                }
            }
        }

        private static void Quit()
        {
            _cts.Cancel();
        }
    }
}