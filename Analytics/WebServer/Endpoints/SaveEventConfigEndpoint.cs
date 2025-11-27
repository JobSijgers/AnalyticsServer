using System.Text.Json;
using System.Text.Json.Serialization;
using KHSWeb.Models;
using KHSWeb.Services;
using Utils;

namespace KHSWeb.Endpoints;

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