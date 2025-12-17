using KHSWeb.Models;
using KHSWeb.Services;
using Utils;

namespace KHSWeb.Endpoints;

public class UpdateEventEndpoint : WebEndpoint
{
    public override string Path => "/api/events/update";
    public override METHOD Method => METHOD.POST;
    public override EndpointSecurity Security => EndpointSecurity.Public; // Or Authenticated
    
    private readonly MongoService _mongoService = new();

    public override Delegate Action => async (HttpContext context) =>
    {
        try
        {
            var request = await context.Request.ReadFromJsonAsync<UpdateEventRequest>();
            if (request == null || string.IsNullOrEmpty(request.Id) || string.IsNullOrEmpty(request.ProjectId))
            {
                return Results.Json(new ApiResponse<object> { Success = false, Message = "Missing ID or ProjectId" }, statusCode: 400);
            }

            var success = await _mongoService.UpdateEventPropertiesAsync(request.Id, request.ProjectId, request.Properties);

            return Results.Json(new ApiResponse<object>
            {
                Success = success,
                Message = success ? "Event updated" : "Event not found"
            });
        }
        catch (Exception ex)
        {
            return Results.Json(new ApiResponse<object> { Success = false, Message = ex.Message }, statusCode: 500);
        }
    };
}

public class UpdateEventRequest
{
    public string Id { get; set; }
    public string ProjectId { get; set; }
    public Dictionary<string, object> Properties { get; set; }
}