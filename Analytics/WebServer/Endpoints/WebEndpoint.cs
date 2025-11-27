using System;

namespace KHSWeb
{
    public enum EndpointSecurity
    {
        Public,     // Open to everyone (Login, Metric, etc.)
        Unity,      // Requires Config.UnityClientToken (Batch)
        AdminOnly   // Requires TokenManager validation (Dashboard, Configs)
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
}