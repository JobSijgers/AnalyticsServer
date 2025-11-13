// [file name]: MetricsQueryEndpoint.cs
using KHSWeb.Services;
using KHSWeb.Models;
using Utils;
using System.Text.Json;

namespace KHSWeb.Endpoints
{
    public class MetricsQueryEndpoint : WebEndpoint
    {
        private readonly MongoService _mongoService;

        public MetricsQueryEndpoint()
        {
            _mongoService = new MongoService();
        }

        public override string Path => "/api/metrics/query";
        public override METHOD Method => METHOD.GET;
        public override Delegate Action => async (HttpContext context) =>
        {
            try
            {
                var query = new MetricQuery
                {
                    ProjectId = context.Request.Query["projectId"].ToString(),
                    Category = context.Request.Query["category"].ToString(),
                    MetricKey = context.Request.Query["metricKey"].ToString(),
                    StartDate = DateTime.TryParse(context.Request.Query["startDate"], out var startDate) ? startDate : null,
                    EndDate = DateTime.TryParse(context.Request.Query["endDate"], out var endDate) ? endDate : null,
                    Limit = int.TryParse(context.Request.Query["limit"], out var limit) ? limit : 100,
                    Skip = int.TryParse(context.Request.Query["skip"], out var skip) ? skip : 0
                };

                var metrics = await _mongoService.GetMetricsAsync(query);
                DebugUtils.PrintSuccess($"Retrieved {metrics.Count} metrics");
                return Results.Ok(new { metrics, success = true });
            }
            catch (Exception ex)
            {
                DebugUtils.PrintError($"Error querying metrics: {ex.Message}");
                return Results.Problem($"Error querying metrics: {ex.Message}");
            }
        };
    }
}