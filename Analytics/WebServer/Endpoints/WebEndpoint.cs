namespace KHSWeb
{
    /// <summary>
    /// Base class for web API endpoints.
    /// </summary>
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
    }
}