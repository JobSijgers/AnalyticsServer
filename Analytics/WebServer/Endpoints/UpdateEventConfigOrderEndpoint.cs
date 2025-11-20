using KHSWeb.Services;
using Utils;

namespace KHSWeb.Endpoints;

public class UpdateEventConfigOrderEndpoint : WebEndpoint
{
    private readonly ChartConfigService _configService;

    public UpdateEventConfigOrderEndpoint()
    {
        _configService = new ChartConfigService();
    }

    public override string Path => "/api/event-config/update-order";
    public override METHOD Method => METHOD.POST;
    
    public override Delegate Action => async (HttpContext context) =>
    {
        try
        {
            var request = await context.Request.ReadFromJsonAsync<UpdateOrderRequest>();
            if (request == null)
            {
                return Results.Json(new ApiResponse<object> 
                { 
                    Success = false, 
                    Message = "Invalid request data" 
                }, statusCode: 400);
            }

            var allConfigs = await _configService.LoadAllConfigs();

            foreach (var order in request.Orders)
            {
                var config = allConfigs.FirstOrDefault(c => c.Id == order.Id && c.ProjectId == request.ProjectId);
                if (config != null)
                {
                    config.DisplayOrder = order.DisplayOrder;
                    config.UpdatedAt = DateTime.UtcNow;
                }
            }

            await _configService.SaveAllConfigs(allConfigs);

            return Results.Json(new ApiResponse<object>
            {
                Success = true
            });
        }
        catch (Exception ex)
        {
            DebugUtils.PrintError($"Error updating chart order: {ex.Message}");
            return Results.Json(new ApiResponse<object>
            {
                Success = false,
                Message = $"Error updating chart order: {ex.Message}"
            }, statusCode: 500);
        }
    };
}