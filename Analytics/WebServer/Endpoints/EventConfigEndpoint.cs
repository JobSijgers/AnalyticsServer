using KHSWeb.Models;
using KHSWeb.Services;
using Utils;

namespace KHSWeb.Endpoints;

public class EventConfigEndpoint : WebEndpoint
{
    private readonly ChartConfigService _configService;

    public EventConfigEndpoint()
    {
        _configService = new ChartConfigService();
    }

    public override string Path => "/api/event-config";
    public override METHOD Method => METHOD.GET;
    
    public override Delegate Action => async (HttpContext context) =>
    {
        try
        {
            var projectId = context.Request.Query["projectId"].ToString();
            
            if (string.IsNullOrEmpty(projectId))
            {
                return Results.Json(new ApiResponse<ChartConfigsResponse> 
                { 
                    Success = false, 
                    Message = "ProjectId is required" 
                }, statusCode: 400);
            }

            var configs = await _configService.LoadConfigsForProject(projectId);

            return Results.Json(new ApiResponse<ChartConfigsResponse>
            {
                Success = true,
                Data = new ChartConfigsResponse { Configs = configs }
            });
        }
        catch (Exception ex)
        {
            DebugUtils.PrintError($"Error getting event configs: {ex.Message}");
            return Results.Json(new ApiResponse<ChartConfigsResponse>
            {
                Success = false,
                Message = $"Error getting event configs: {ex.Message}"
            }, statusCode: 500);
        }
    };
}