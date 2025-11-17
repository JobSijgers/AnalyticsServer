// [file name]: AuthValidationEndpoint.cs
using Utils;
using System.Text.Json;

namespace KHSWeb.Endpoints
{
    public class AuthValidationEndpoint : WebEndpoint
    {
        public override string Path => "/api/auth/validate";
        public override METHOD Method => METHOD.POST;
        public override Delegate Action => async (HttpContext context) =>
        {
            try
            {
                var requestBody = await new StreamReader(context.Request.Body).ReadToEndAsync();
                var authRequest = JsonSerializer.Deserialize<AuthValidationRequest>(requestBody, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                if (string.IsNullOrEmpty(authRequest?.Token))
                {
                    return Results.BadRequest(new { success = false, message = "Token is required" });
                }

                if (TokenManager.IsTokenValid(authRequest.Token))
                {
                    DebugUtils.PrintSuccess("Token validation successful");
                    return Results.Ok(new { 
                        success = true, 
                        message = "Token valid",
                        valid = true
                    });
                }
                else
                {
                    DebugUtils.PrintError("Token validation failed");
                    return Results.Ok(new { 
                        success = true, 
                        message = "Token invalid",
                        valid = false
                    });
                }
            }
            catch (Exception ex)
            {
                DebugUtils.PrintError($"Token validation error: {ex.Message}");
                return Results.Problem($"Token validation error: {ex.Message}");
            }
        };
    }

    public class AuthValidationRequest
    {
        public string Token { get; set; }
    }
}