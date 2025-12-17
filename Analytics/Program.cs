using System.Reflection;
using KHSWeb;
using KHSWeb.Endpoints;
using KHSWeb.Middleware;
using KHSWeb.Models;
using KHSWeb.Repositories;
using KHSWeb.Security;
using KHSWeb.Services;
using KHSWeb.Workers;
using Utils;

namespace KHS;

class Program
{
    static async Task Main(string[] args)
    {
        // 1. Setup Debugging
        DebugUtils.SetPrintLevel(DebugUtils.PRINT_LEVEL.ALL);
        DebugUtils.SetPrintCollections(true);

        DebugUtils.Print("Initializing web application builder...");
        var builder = WebApplication.CreateBuilder(args);

        // 2. Register Configuration & Core Services
        builder.Services.AddCors(options =>
        {
            options.AddPolicy("AllowAll", policy =>
            {
                policy.AllowAnyOrigin()
                    .AllowAnyMethod()
                    .AllowAnyHeader();
            });
        });

        // 3. Register Repositories (Data Access Layer)
        // These replace your old manual instantiations
        builder.Services.AddSingleton<AnalyticsRepository>();
        builder.Services.AddSingleton<ChartConfigRepository>();
        builder.Services.AddSingleton<ChartCacheRepository>();
        builder.Services.AddSingleton<ProjectImageRepository>();

        // 4. Register Domain Services (Business Logic)
        builder.Services.AddSingleton<AnalyticsQueue>(); // Singleton: holds the channel state
        builder.Services.AddSingleton<ChartDataService>();
        
        // 5. Register Background Workers (Hosted Services)
        // The Host will automatically Start/Stop these.
        builder.Services.AddHostedService<AnalyticsWorker>();
        builder.Services.AddHostedService<CacheUpdateWorker>();

        // 6. Build the App
        var app = builder.Build();

        // 7. Configure Middleware Pipeline
        app.UseCors("AllowAll");
        app.UseDefaultFiles();
        app.UseStaticFiles();
        
        // Use your custom Auth Middleware
        app.UseAuthMiddleware();

        // 8. Initialize Database Indexes
        // We resolve the repository from the container to run initialization logic
        try 
        {
            var analyticsRepo = app.Services.GetRequiredService<AnalyticsRepository>();
            await analyticsRepo.EnsureIndexesAsync();
            DebugUtils.PrintSuccess("MongoDB Indexes ensured.");
        }
        catch (Exception ex)
        {
            DebugUtils.PrintError($"Warning: Could not initialize DB indexes: {ex.Message}");
        }

        // 9. Register Endpoints via Reflection
        RegisterEndpoints(app);

        // 10. Run Application
        DebugUtils.Print($"Web server starting on {Config.AppUrl}...");
        
        // Initialize Token Manager settings
        TokenManager.Initialize();

        await app.RunAsync(Config.AppUrl);
    }

    private static void RegisterEndpoints(WebApplication app)
    {
        DebugUtils.Print("Scanning for WebEndpoint implementations...");
        
        // Find all non-abstract subclasses of WebEndpoint
        var endpointTypes = Assembly.GetExecutingAssembly()
            .GetTypes()
            .Where(t => t.IsSubclassOf(typeof(WebEndpoint)) && !t.IsAbstract);

        int count = 0;
        foreach (var type in endpointTypes)
        {
            try
            {
                // ActivatorUtilities allows the Endpoints to use Constructor Injection 
                // if they need access to Services/Repositories.
                var ep = (WebEndpoint)ActivatorUtilities.CreateInstance(app.Services, type);

                DebugUtils.Print($"Registering endpoint: {ep.Method} {ep.Path} -> {ep.GetType().Name}");

                switch (ep.Method)
                {
                    case WebEndpoint.METHOD.GET:
                        app.MapGet(ep.Path, ep.Action);
                        break;
                    case WebEndpoint.METHOD.POST:
                        app.MapPost(ep.Path, ep.Action);
                        break;
                    case WebEndpoint.METHOD.DELETE:
                        app.MapDelete(ep.Path, ep.Action);
                        break;
                }

                // Register security level
                RouteSecurityRegistry.RegisterRoute(ep.Path, ep.Security);
                count++;
            }
            catch (Exception ex)
            {
                DebugUtils.PrintError($"Failed to register endpoint {type.Name}: {ex.Message}");
            }
        }

        DebugUtils.PrintSuccess($"Total endpoints registered: {count}");
    }
}