// Updated WebServer.cs - Add CORS configuration
using System.Reflection;
using Utils;

namespace KHSWeb
{
    public class WebServer
    {
        private WebApplication _app;

        public WebServer()
        {
            CreateApp();
        }

        ~WebServer()
        {
            _app?.StopAsync();
        }

        public void CreateApp()
        {
            _ = Task.Run(() =>
            {
                DebugUtils.Print("Initializing web application builder");
                var builder = WebApplication.CreateBuilder();
                
                // Add CORS services
                builder.Services.AddCors(options =>
                {
                    options.AddPolicy("AllowAll", policy =>
                    {
                        policy.AllowAnyOrigin()
                              .AllowAnyMethod()
                              .AllowAnyHeader();
                    });
                });

                var app = builder.Build();

                // Use CORS
                app.UseCors("AllowAll");

                app.UseDefaultFiles();
                app.UseStaticFiles();
                DebugUtils.Print("Static files and default files middleware enabled");

                DebugUtils.Print("Scanning for WebEndpoint implementations");
                var endpoints = Assembly.GetExecutingAssembly()
                    .GetTypes()
                    .Where(t => t.IsSubclassOf(typeof(WebEndpoint)) && !t.IsAbstract)
                    .Select(t => Activator.CreateInstance(t) as WebEndpoint);

                foreach (var ep in endpoints)
                {
                    DebugUtils.Print($"Registering endpoint: {ep.Method} {ep.Path} -> {ep.GetType().FullName}");
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
                }

                DebugUtils.Print($"Total endpoints registered: {endpoints.Count()}");

                _app = app;
                app.Run(Config.AppUrl);

                DebugUtils.Print($"Web server started and listening on {Config.AppUrl}");
            });
        }
    }
}