// [file name]: DashboardSummaryEndpoint.cs
using KHSWeb.Services;
using Utils;
using System.Text.Json;

namespace KHSWeb.Endpoints
{
    public class DashboardSummaryEndpoint : WebEndpoint
    {
        private readonly MongoService _mongoService;

        public DashboardSummaryEndpoint()
        {
            _mongoService = new MongoService();
        }

        public override string Path => "/api/dashboard/summary";
        public override METHOD Method => METHOD.GET;
        public override Delegate Action => async (HttpContext context) =>
        {
            try
            {
                var projectId = context.Request.Query["projectId"].ToString();
                var category = context.Request.Query["category"].ToString();
                
                if (string.IsNullOrEmpty(projectId))
                {
                    return Results.BadRequest("Project ID is required");
                }

                var summary = await _mongoService.GetDashboardSummaryAsync(projectId, category);
                DebugUtils.PrintSuccess($"Retrieved dashboard summary for project {projectId}, category {category}");
                return Results.Ok(new { summary, success = true });
            }
            catch (Exception ex)
            {
                DebugUtils.PrintError($"Error retrieving dashboard summary: {ex.Message}");
                return Results.Problem($"Error retrieving dashboard summary: {ex.Message}");
            }
        };
    }
}