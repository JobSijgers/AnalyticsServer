using System.Reflection;
using Utils;

namespace KHSWeb
{
    /// <summary>
    /// Manages the web server lifecycle and endpoint registration.
    /// </summary>
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
                var app = builder.Build();

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