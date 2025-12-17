using KHSWeb.Models;
using KHSWeb.Repositories;

namespace KHSWeb.Endpoints;

public class EventKeysEndpoint : WebEndpoint
{
    private readonly AnalyticsRepository _repo;

    public EventKeysEndpoint(AnalyticsRepository repo)
    {
        _repo = repo;
    }

    public override string Path => "/api/events/keys";
    public override METHOD Method => METHOD.GET;

    public override Delegate Action => async (HttpContext context) =>
    {
        try
        {
            var projectId = context.Request.Query["projectId"].ToString();
            
            if (string.IsNullOrEmpty(projectId))
            {
                return Results.Json(new ApiResponse<object> { Success = false, Message = "ProjectId required" }, statusCode: 400);
            }
            
            var keys = await _repo.GetEventKeysAsync(projectId);

            return Results.Json(new ApiResponse<object>
            {
                Success = true,
                Data = new { eventKeys = keys }
            });
        }
        catch (Exception ex)
        {
            return Results.Json(new ApiResponse<object> { Success = false, Message = ex.Message }, statusCode: 500);
        }
    };
}