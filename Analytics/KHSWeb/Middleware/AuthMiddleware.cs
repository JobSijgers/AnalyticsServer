using KHSWeb.Endpoints;
using Utils;
using KHSWeb.Security;

namespace KHSWeb.Middleware
{
    public class AuthMiddleware
    {
        private readonly RequestDelegate _next;
        
        private readonly List<string> _staticPublicPaths = new List<string>
        {
            "/", 
            "/index.html",
            "/dashboard.html",
            "/project.html"
        };

        private readonly List<string> _publicExtensions = new List<string>
        {
            ".html", ".css", ".js", ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".woff", ".woff2", ".ttf", ".eot"
        };

        public AuthMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            var path = context.Request.Path;
            
            if (path == "/" || path.Value!.EndsWith(".html"))
            {
                DebugUtils.Print($"AuthMiddleware: Processing static file request '{path}'");
            }

            if (IsStaticPublicPath(path))
            {
                DebugUtils.Print($"AuthMiddleware: Allowing public access to '{path}'");
                await _next(context);
                return;
            }

            var securityLevel = RouteSecurityRegistry.GetSecurityLevel(path) ?? EndpointSecurity.AdminOnly;

            switch (securityLevel)
            {
                case EndpointSecurity.Public:
                    await _next(context);
                    return;

                case EndpointSecurity.Unity:
                    if (!await ValidateUnityToken(context)) 
                        return;
                    break;

                case EndpointSecurity.AdminOnly:
                    if (!await ValidateAdminToken(context)) 
                        return;
                    break;
            }

            await _next(context);
        }

        private async Task<bool> ValidateUnityToken(HttpContext context)
        {
            var token = ExtractToken(context.Request.Headers);

            if (string.IsNullOrEmpty(token))
            {
                DebugUtils.PrintError($"No token for Unity endpoint: {context.Request.Path}");
                context.Response.StatusCode = 401;
                await context.Response.WriteAsJsonAsync(new { success = false, message = "Unity Token required" });
                return false;
            }

            if (token != Config.UnityClientToken)
            {
                DebugUtils.PrintError($"Invalid Unity token: {context.Request.Path}");
                context.Response.StatusCode = 401;
                await context.Response.WriteAsJsonAsync(new { success = false, message = "Invalid Unity Token" });
                return false;
            }

            return true;
        }

        private async Task<bool> ValidateAdminToken(HttpContext context)
        {
            if (!context.Request.Path.StartsWithSegments("/api")) return true;

            var token = ExtractToken(context.Request.Headers);

            if (string.IsNullOrEmpty(token) || !TokenManager.IsTokenValid(token))
            {
                DebugUtils.PrintError($"Unauthorized Admin Access: {context.Request.Path}");
                context.Response.StatusCode = 401;
                await context.Response.WriteAsJsonAsync(new { success = false, message = "Unauthorized" });
                return false;
            }

            return true;
        }

        private bool IsStaticPublicPath(PathString path)
        {
            if (_staticPublicPaths.Contains(path)) 
            {
                DebugUtils.Print($"AuthMiddleware: Path '{path}' is in static public paths list");
                return true;
            }
            
            foreach (var extension in _publicExtensions)
            {
                if (path.Value!.EndsWith(extension, StringComparison.OrdinalIgnoreCase)) 
                {
                    DebugUtils.Print($"AuthMiddleware: Path '{path}' has public extension '{extension}'");
                    return true;
                }
            }
            
            DebugUtils.Print($"AuthMiddleware: Path '{path}' requires authentication");
            return false;
        }

        private string ExtractToken(IHeaderDictionary headers)
        {
            if (headers.TryGetValue("Authorization", out var authHeader))
            {
                var val = authHeader.ToString();
                if (val.StartsWith("Bearer ")) return val.Substring(7);
            }
            if (headers.TryGetValue("X-Auth-Token", out var xHeader)) return xHeader.ToString();
            
            return null!;
        }
    }
    
    public static class AuthMiddlewareExtensions
    {
        public static IApplicationBuilder UseAuthMiddleware(this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<AuthMiddleware>();
        }
    }
}