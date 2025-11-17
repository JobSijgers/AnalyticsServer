// [file name]: AuthMiddleware.cs
using Utils;

namespace KHSWeb.Middleware
{
    public class AuthMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly List<string> _publicEndpoints = new List<string>
        {
            "/api/auth/login",
            "/api/auth/validate",
            "/", // Root path
            "/index.html", // Login page
            "/dashboard.html" // Let through but TokenManager.js will handle redirect
        };

        // Add file extensions that should be publicly accessible
        private readonly List<string> _publicExtensions = new List<string>
        {
            ".html",
            ".css",
            ".js",
            ".png",
            ".jpg",
            ".jpeg",
            ".gif",
            ".ico",
            ".svg"
        };

        public AuthMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            var path = context.Request.Path;

            // Check if this is a public endpoint or static file
            if (IsPublicPath(path))
            {
                await _next(context);
                return;
            }

            // Check if this is an API endpoint
            if (path.StartsWithSegments("/api"))
            {
                // Extract token from headers
                var token = ExtractToken(context.Request.Headers);

                if (string.IsNullOrEmpty(token))
                {
                    DebugUtils.PrintError($"No token provided for protected endpoint: {context.Request.Path}");
                    context.Response.StatusCode = 401;
                    await context.Response.WriteAsJsonAsync(new { 
                        success = false, 
                        message = "Authentication token required" 
                    });
                    return;
                }

                // Validate token
                if (!TokenManager.IsTokenValid(token))
                {
                    DebugUtils.PrintError($"Invalid token for endpoint: {context.Request.Path}");
                    context.Response.StatusCode = 401;
                    await context.Response.WriteAsJsonAsync(new { 
                        success = false, 
                        message = "Invalid or expired token" 
                    });
                    return;
                }

                DebugUtils.PrintSuccess($"Token validated for endpoint: {context.Request.Path}");
            }

            await _next(context);
        }

        private bool IsPublicPath(PathString path)
        {
            // Check exact public endpoints
            if (_publicEndpoints.Contains(path))
                return true;

            // Check if it's a static file
            foreach (var extension in _publicExtensions)
            {
                if (path.Value.EndsWith(extension, StringComparison.OrdinalIgnoreCase))
                    return true;
            }

            // Root path
            if (path == "/" || string.IsNullOrEmpty(path.Value) || path.Value == "/")
                return true;

            return false;
        }

        private string ExtractToken(IHeaderDictionary headers)
        {
            // Check Authorization header
            if (headers.TryGetValue("Authorization", out var authHeader))
            {
                var headerValue = authHeader.ToString();
                if (headerValue.StartsWith("Bearer "))
                {
                    return headerValue.Substring(7);
                }
            }

            // Check X-Auth-Token header
            if (headers.TryGetValue("X-Auth-Token", out var xAuthHeader))
            {
                return xAuthHeader.ToString();
            }

            return null;
        }
    }

    // Extension method to use the middleware
    public static class AuthMiddlewareExtensions
    {
        public static IApplicationBuilder UseAuthMiddleware(this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<AuthMiddleware>();
        }
    }
}