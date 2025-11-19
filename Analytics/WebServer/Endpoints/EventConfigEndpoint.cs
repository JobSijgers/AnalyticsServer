using System.Text.Json;
using System.Text.Json.Serialization;
using KHSWeb.Models;
using MongoDB.Driver;
using Utils;

namespace KHSWeb.Endpoints;

public class EventConfigEndpoint : WebEndpoint
{
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

            var database = Config.GetDatabase();
            var collection = database.GetCollection<EventDisplayConfig>("EventDisplayConfigs");

            var configs = await collection.Find(c => c.ProjectId == projectId && c.IsEnabled)
                .SortBy(c => c.DisplayOrder)
                .ToListAsync();

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

// In EventConfigEndpoint.cs - Update the save endpoint
public class SaveEventConfigEndpoint : WebEndpoint
{
    public override string Path => "/api/event-config/save";
    public override METHOD Method => METHOD.POST;
    
    public override Delegate Action => async (HttpContext context) =>
    {
        try
        {
            // Add JSON options to handle enum conversion
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

            var database = Config.GetDatabase();
            var collection = database.GetCollection<EventDisplayConfig>("EventDisplayConfigs");

            config.UpdatedAt = DateTime.UtcNow;

            if (string.IsNullOrEmpty(config.Id))
            {
                // New config
                await collection.InsertOneAsync(config);
            }
            else
            {
                // Update existing
                await collection.ReplaceOneAsync(
                    c => c.Id == config.Id && c.ProjectId == config.ProjectId, 
                    config
                );
            }

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

public class UpdateEventConfigOrderEndpoint : WebEndpoint
{
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

            var database = Config.GetDatabase();
            var collection = database.GetCollection<EventDisplayConfig>("EventDisplayConfigs");

            foreach (var order in request.Orders)
            {
                var update = Builders<EventDisplayConfig>.Update
                    .Set(c => c.DisplayOrder, order.DisplayOrder)
                    .Set(c => c.UpdatedAt, DateTime.UtcNow);

                await collection.UpdateOneAsync(
                    c => c.Id == order.Id && c.ProjectId == request.ProjectId,
                    update
                );
            }

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