// EventConfigEndpoint.cs
using System.Text.Json;
using System.Text.Json.Serialization;
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

// Save Event Config Endpoint
public class SaveEventConfigEndpoint : WebEndpoint
{
    private readonly ChartConfigService _configService;

    public SaveEventConfigEndpoint()
    {
        _configService = new ChartConfigService();
    }

    public override string Path => "/api/event-config/save";
    public override METHOD Method => METHOD.POST;
    
    public override Delegate Action => async (HttpContext context) =>
    {
        try
        {
            var jsonOptions = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
                Converters = { new JsonStringEnumConverter() }
            };
            
            var config = await context.Request.ReadFromJsonAsync<EventDisplayConfig>(jsonOptions);
            
            if (config == null)
            {
                return Results.Json(new ApiResponse<SaveConfigResponse> 
                { 
                    Success = false, 
                    Message = "Invalid config data" 
                }, statusCode: 400);
            }

            var allConfigs = await _configService.LoadAllConfigs();

            config.UpdatedAt = DateTime.UtcNow;

            if (string.IsNullOrEmpty(config.Id))
            {
                // New config - generate ID
                config.Id = Guid.NewGuid().ToString();
                config.CreatedAt = DateTime.UtcNow;
                allConfigs.Add(config);
            }
            else
            {
                // Update existing
                var existingIndex = allConfigs.FindIndex(c => c.Id == config.Id && c.ProjectId == config.ProjectId);
                if (existingIndex >= 0)
                {
                    allConfigs[existingIndex] = config;
                }
                else
                {
                    allConfigs.Add(config);
                }
            }

            await _configService.SaveAllConfigs(allConfigs);

            return Results.Json(new ApiResponse<SaveConfigResponse>
            {
                Success = true,
                Data = new SaveConfigResponse { ConfigId = config.Id }
            });
        }
        catch (Exception ex)
        {
            DebugUtils.PrintError($"Error saving event config: {ex.Message}");
            return Results.Json(new ApiResponse<SaveConfigResponse>
            {
                Success = false,
                Message = $"Error saving event config: {ex.Message}"
            }, statusCode: 500);
        }
    };
}

// Delete Event Config Endpoint
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

// Update Order Endpoint
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