using Utils;
using System.Text.Json;
using KHSWeb.Models;

namespace KHSWeb.Endpoints;

public class LoginEndpoint : WebEndpoint
{
    public override string Path => "/api/auth/login";
    public override METHOD Method => METHOD.POST;
    public override EndpointSecurity Security => EndpointSecurity.Public;

    public override Delegate Action => async (HttpContext context) =>
    {
        try
        {
            var requestBody = await new StreamReader(context.Request.Body).ReadToEndAsync();
            DebugUtils.Print($"Login attempt for user");

            var loginRequest = JsonSerializer.Deserialize<LoginRequest>(requestBody, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            if (string.IsNullOrEmpty(loginRequest?.Username) || string.IsNullOrEmpty(loginRequest.Password))
            {
                return Results.BadRequest(new { success = false, message = "Username and password are required" });
            }

            if (IsValidUser(loginRequest.Username, loginRequest.Password))
            {
                var token = TokenManager.CreateToken();
                DebugUtils.PrintSuccess($"Login successful for user: {loginRequest.Username}");

                return Results.Ok(new
                {
                    success = true,
                    token = token,
                    message = "Login successful"
                });
            }
            else
            {
                DebugUtils.PrintError($"Login failed for user: {loginRequest.Username}");
                return Results.Unauthorized();
            }
        }
        catch (Exception ex)
        {
            DebugUtils.PrintError($"Login error: {ex.Message}");
            return Results.Problem($"Login error: {ex.Message}");
        }
    };

    private bool IsValidUser(string username, string passwordHash)
    {
        return username == Config.Username && passwordHash == Config.PasswordHash;
    }
}