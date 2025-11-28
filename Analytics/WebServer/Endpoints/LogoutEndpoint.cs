using Utils;

namespace KHSWeb.Endpoints;

public class LogoutEndpoint : WebEndpoint
{
    public override string Path => "/api/auth/logout";
    public override METHOD Method => METHOD.POST;

    public override Delegate Action => (HttpContext context) =>
    {
        try
        {
            var token = GetTokenFromHeader(context.Request.Headers);

            if (!string.IsNullOrEmpty(token))
            {
                TokenManager.InvalidateToken(token);
                DebugUtils.PrintSuccess("User logged out successfully");
            }

            return Results.Ok(new
            {
                success = true,
                message = "Logout successful"
            });
        }
        catch (Exception ex)
        {
            DebugUtils.PrintError($"Logout error: {ex.Message}");
            return Results.Problem($"Logout error: {ex.Message}");
        }
    };

    private string GetTokenFromHeader(IHeaderDictionary headers)
    {
        if (headers.TryGetValue("Authorization", out var authHeader))
        {
            var headerValue = authHeader.ToString();
            if (headerValue.StartsWith("Bearer "))
            {
                return headerValue.Substring(7);
            }
        }

        if (headers.TryGetValue("X-Auth-Token", out var xAuthHeader))
        {
            return xAuthHeader.ToString();
        }

        return null!;
    }
}