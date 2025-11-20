using KHSWeb.Services;
using Utils;

namespace KHSWeb.Endpoints;

public class DeleteEventConfigEndpoint : WebEndpoint
{
    private readonly ChartConfigService _configService;

    public DeleteEventConfigEndpoint()
    {
        _configService = new ChartConfigService();
    }

    public override string Path => "/api/event-config/delete";
    public override METHOD Method => METHOD.POST;
    
    public override Delegate Action => async (HttpContext context) =>
    {
        try
        {
            var request = await context.Request.ReadFromJsonAsync<DeleteConfigRequest>();
            if (request == null || string.IsNullOrEmpty(request.Id))
            {
                return Results.Json(new ApiResponse<object> 
                { 
                    Success = false, 
                    Message = "Invalid request data" 
                }, statusCode: 400);
            }

            var allConfigs = await _configService.LoadAllConfigs();

            // Remove the config
            allConfigs.RemoveAll(c => c.Id == request.Id && c.ProjectId == request.ProjectId);

            await _configService.SaveAllConfigs(allConfigs);

            return Results.Json(new ApiResponse<object>
            {
                Success = true
            });
        }
        catch (Exception ex)
        {
            DebugUtils.PrintError($"Error deleting event config: {ex.Message}");
            return Results.Json(new ApiResponse<object>
            {
                Success = false,
                Message = $"Error deleting event config: {ex.Message}"
            }, statusCode: 500);
        }
    };
}