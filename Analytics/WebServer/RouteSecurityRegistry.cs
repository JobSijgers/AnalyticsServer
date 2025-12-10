using System;
using System.Collections.Generic;
using KHSWeb.Endpoints;

namespace KHSWeb;

public static class RouteSecurityRegistry
{
    private static readonly Dictionary<string, EndpointSecurity> _routeSecurity = new(StringComparer.OrdinalIgnoreCase);

    public static void RegisterRoute(string path, EndpointSecurity security)
    {
        _routeSecurity[path] = security;
    }

    public static EndpointSecurity? GetSecurityLevel(string path)
    {
        if (_routeSecurity.TryGetValue(path, out var security))
        {
            return security;
        }

        return null;
    }
}