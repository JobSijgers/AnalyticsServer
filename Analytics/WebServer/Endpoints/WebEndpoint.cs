using System;

namespace KHSWeb.Endpoints;

public enum EndpointSecurity
{
    Public,
    Unity,
    AdminOnly
}

public abstract class WebEndpoint
{
    public enum METHOD
    {
        GET,
        POST,
        DELETE
    }

    public abstract string Path { get; }
    public abstract METHOD Method { get; }
    public abstract Delegate Action { get; }

    public virtual EndpointSecurity Security => EndpointSecurity.AdminOnly;
}