// EventConfigEndpoint.cs

using KHSWeb.Models;
using KHSWeb.Services; // Add this
using Utils;
using System.IO;
using System.Collections.Generic;
using System.Linq;

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

// Request Models
public class DeleteConfigRequest
{
    public string Id { get; set; } = string.Empty;
    public string ProjectId { get; set; } = string.Empty;
}

public class UpdateOrderRequest
{
    public string ProjectId { get; set; } = string.Empty;
    public List<ChartOrder> Orders { get; set; } = new List<ChartOrder>();
}

public class ChartOrder
{
    public string Id { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
}

// Response Models
public class EventKeysResponse
{
    public List<string> EventKeys { get; set; } = new List<string>();
}

public class EventPropertiesResponse
{
    public List<string> PropertyKeys { get; set; } = new List<string>();
}

public class ChartConfigsResponse
{
    public List<EventDisplayConfig> Configs { get; set; } = new List<EventDisplayConfig>();
}

public class SaveConfigResponse
{
    public string ConfigId { get; set; } = string.Empty;
}

public class ChartDataResponse
{
    public object ChartData { get; set; } = new();
}

public class ApiResponse<T>
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public T Data { get; set; } = default!;
}