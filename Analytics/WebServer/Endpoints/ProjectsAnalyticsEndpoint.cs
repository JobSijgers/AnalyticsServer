using KHSWeb.Models;
using KHSWeb.Services;
using MongoDB.Driver;
using Utils;

namespace KHSWeb.Endpoints
{
    public class ProjectAnalyticsEndpoint : WebEndpoint
    {
        private readonly MongoService _mongoService;

        public ProjectAnalyticsEndpoint()
        {
            _mongoService = new MongoService();
        }

        public override string Path => "/api/analytics/{projectId}";
        public override METHOD Method => METHOD.GET;
        public override Delegate Action => async (HttpContext context) =>
        {
            try
            {
                var projectId = context.Request.RouteValues["projectId"]?.ToString();
                var startDateStr = context.Request.Query["startDate"].ToString();
                var endDateStr = context.Request.Query["endDate"].ToString();
                var category = context.Request.Query["category"].ToString();
                var metricKey = context.Request.Query["metricKey"].ToString();

                if (string.IsNullOrEmpty(projectId))
                {
                    return Results.BadRequest("Project ID is required");
                }

                DateTime? startDate = null;
                DateTime? endDate = null;

                if (!string.IsNullOrEmpty(startDateStr) && DateTime.TryParse(startDateStr, out var start))
                    startDate = start;
                if (!string.IsNullOrEmpty(endDateStr) && DateTime.TryParse(endDateStr, out var end))
                    endDate = end;

                var query = new MetricQuery
                {
                    ProjectId = projectId,
                    StartDate = startDate,
                    EndDate = endDate,
                    Category = string.IsNullOrEmpty(category) ? null : category,
                    MetricKey = string.IsNullOrEmpty(metricKey) ? null : metricKey,
                    Limit = 1000
                };

                // Get metrics for the project
                var metrics = await _mongoService.GetMetricsAsync(query);
                
                // Calculate analytics
                var analytics = CalculateAnalytics(metrics, projectId);
                
                DebugUtils.PrintSuccess($"Retrieved analytics for project {projectId}: {metrics.Count} metrics");
                return Results.Ok(analytics);
            }
            catch (Exception ex)
            {
                DebugUtils.PrintError($"Error retrieving analytics: {ex.Message}");
                return Results.Problem($"Error retrieving analytics: {ex.Message}");
            }
        };

        private object CalculateAnalytics(List<MetricDocument> metrics, string projectId)
        {
            if (metrics.Count == 0)
            {
                return new
                {
                    projectId,
                    totalMetrics = 0,
                    categories = new string[0],
                    metricKeys = new string[0],
                    categoryDistribution = new object[0],
                    timelineData = new object[0],
                    metricKeysDistribution = new object[0],
                    sourceDistribution = new object[0],
                    lastUpdated = DateTime.UtcNow
                };
            }

            // Category distribution
            var categoryDistribution = metrics
                .GroupBy(m => m.Category)
                .Select(g => new { category = g.Key, count = g.Count() })
                .OrderByDescending(x => x.count)
                .ToList();

            // Timeline data (last 30 days by default)
            var thirtyDaysAgo = DateTime.UtcNow.AddDays(-30);
            var timelineData = metrics
                .Where(m => m.Timestamp >= thirtyDaysAgo)
                .GroupBy(m => m.Timestamp.Date)
                .Select(g => new { date = g.Key.ToString("yyyy-MM-dd"), count = g.Count() })
                .OrderBy(x => x.date)
                .ToList();

            // Metric keys distribution
            var metricKeysDistribution = metrics
                .GroupBy(m => m.MetricKey)
                .Select(g => new { metricKey = g.Key, count = g.Count() })
                .OrderByDescending(x => x.count)
                .Take(10)
                .ToList();

            // Source distribution
            var sourceDistribution = metrics
                .GroupBy(m => m.Source)
                .Select(g => new { source = g.Key, count = g.Count() })
                .OrderByDescending(x => x.count)
                .ToList();

            return new
            {
                projectId,
                totalMetrics = metrics.Count,
                categories = categoryDistribution.Select(c => c.category).Distinct().ToList(),
                metricKeys = metricKeysDistribution.Select(m => m.metricKey).Distinct().ToList(),
                categoryDistribution,
                timelineData,
                metricKeysDistribution,
                sourceDistribution,
                lastUpdated = metrics.Max(m => m.Timestamp)
            };
        }
    }
}