using KHSWeb.Models;
using KHSWeb.Repositories;

namespace KHSWeb.Endpoints;

public class EventPropertiesEndpoint : WebEndpoint
{
    private readonly AnalyticsRepository _repo;

    public EventPropertiesEndpoint(AnalyticsRepository repo)
    {
        _repo = repo;
    }

    public override string Path => "/api/events/properties";
    public override METHOD Method => METHOD.GET;

    public override Delegate Action => async (HttpContext context) =>
    {
        try
        {
            var projectId = context.Request.Query["projectId"].ToString();
            var eventKey = context.Request.Query["eventKey"].ToString();

            if (string.IsNullOrEmpty(projectId) || string.IsNullOrEmpty(eventKey))
            {
                return Results.Json(new ApiResponse<object> { Success = false, Message = "Missing parameters" }, statusCode: 400);
            }

            var properties = await _repo.GetEventPropertiesAsync(projectId, eventKey);

            return Results.Json(new ApiResponse<object>
            {
                Success = true,
                Data = new { propertyKeys = properties }
            });
        }
        catch (Exception ex)
        {
            return Results.Json(new ApiResponse<object> { Success = false, Message = ex.Message }, statusCode: 500);
        }
    };
}