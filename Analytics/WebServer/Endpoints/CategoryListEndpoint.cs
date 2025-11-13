using KHSWeb.Services;
using Utils;
using System.Text.Json;

namespace KHSWeb.Endpoints
{
    public class CategoryListEndpoint : WebEndpoint
    {
        private readonly MongoService _mongoService;

        public CategoryListEndpoint()
        {
            _mongoService = new MongoService();
        }

        public override string Path => "/api/categories";
        public override METHOD Method => METHOD.GET;
        public override Delegate Action => async (HttpContext context) =>
        {
            try
            {
                var projectId = context.Request.Query["projectId"].ToString();
                if (string.IsNullOrEmpty(projectId))
                {
                    return Results.BadRequest("Project ID is required");
                }

                var categories = await _mongoService.GetCategoriesAsync(projectId);
                DebugUtils.PrintSuccess($"Retrieved {categories.Count} categories for project {projectId}");
                return Results.Ok(new { categories, success = true });
            }
            catch (Exception ex)
            {
                DebugUtils.PrintError($"Error retrieving categories: {ex.Message}");
                return Results.Problem($"Error retrieving categories: {ex.Message}");
            }
        };
    }
}