namespace KHSAnalytics.KHSAnalytics.KHSAnalytics;

    public class FetchRequest
    {
        public string Name { get; set; } = string.Empty;
        public string ProjectId { get; set; } = string.Empty;
        public string EnvironmentId { get; set; } = string.Empty;
        public string ChartName { get; set; } = string.Empty;
        public string SqlQuery { get; set; } = string.Empty;
    }
