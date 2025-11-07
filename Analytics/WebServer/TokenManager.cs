using System.Collections.Concurrent;

public static class TokenManager
{
    private static readonly ConcurrentDictionary<string, DateTime> _tokens = new();
    private static readonly TimeSpan _defaultTokenTimeout = TimeSpan.FromDays(7);
    private static Timer _cleanupTimer;
    private static bool _initialized = false;
    private static readonly Lock _initLock = new Lock();

    // Static constructor to initialize the cleanup timer
    static TokenManager()
    {
        Initialize();
    }

    /// <summary>
    /// Initializes the TokenManager with default settings
    /// </summary>
    public static void Initialize()
    {
        Initialize(_defaultTokenTimeout);
    }

    /// <summary>
    /// Initializes the TokenManager with custom timeout
    /// </summary>
    /// <param name="tokenTimeout">Custom token timeout duration</param>
    public static void Initialize(TimeSpan tokenTimeout)
    {
        if (!_initialized)
        {
            lock (_initLock)
            {
                if (!_initialized)
                {
                    TokenTimeout = tokenTimeout;
                    
                    // Set up cleanup timer to run every minute
                    _cleanupTimer = new Timer(CleanupExpiredTokens, null, 
                        TimeSpan.FromMinutes(1), TimeSpan.FromMinutes(1));
                    
                    _initialized = true;
                }
            }
        }
    }

    /// <summary>
    /// Gets or sets the token timeout duration
    /// </summary>
    public static TimeSpan TokenTimeout { get; set; } = _defaultTokenTimeout;

    /// <summary>
    /// Generates a new UUID login token
    /// </summary>
    /// <returns>The generated token as a string</returns>
    public static string CreateToken()
    {
        EnsureInitialized();
        var token = Guid.NewGuid().ToString();
        var expiration = DateTime.UtcNow.Add(TokenTimeout);
        
        _tokens[token] = expiration;
        return token;
    }

    /// <summary>
    /// Generates a new UUID login token with custom timeout
    /// </summary>
    /// <param name="customTimeout">Custom timeout for this token</param>
    /// <returns>The generated token as a string</returns>
    public static string CreateToken(TimeSpan customTimeout)
    {
        EnsureInitialized();
        var token = Guid.NewGuid().ToString();
        var expiration = DateTime.UtcNow.Add(customTimeout);
        
        _tokens[token] = expiration;
        return token;
    }

    /// <summary>
    /// Checks if a token is valid (exists and not expired)
    /// </summary>
    /// <param name="token">The token to validate</param>
    /// <returns>True if the token is valid, false otherwise</returns>
    public static bool IsTokenValid(string token)
    {
        if (string.IsNullOrEmpty(token))
            return false;

        if (_tokens.TryGetValue(token, out DateTime expiration))
        {
            if (DateTime.UtcNow < expiration)
            {
                return true;
            }
            else
            {
                // Token exists but is expired, remove it
                _tokens.TryRemove(token, out _);
                return false;
            }
        }

        return false;
    }

    /// <summary>
    /// Explicitly invalidates/removes a token
    /// </summary>
    /// <param name="token">The token to invalidate</param>
    /// <returns>True if the token was found and removed, false otherwise</returns>
    public static bool InvalidateToken(string token)
    {
        return _tokens.TryRemove(token, out _);
    }

    /// <summary>
    /// Refreshes a token's expiration time using the default timeout
    /// </summary>
    /// <param name="token">The token to refresh</param>
    /// <returns>True if the token was found and refreshed, false otherwise</returns>
    public static bool RefreshToken(string token)
    {
        return RefreshToken(token, TokenTimeout);
    }

    /// <summary>
    /// Refreshes a token's expiration time with custom timeout
    /// </summary>
    /// <param name="token">The token to refresh</param>
    /// <param name="customTimeout">Custom timeout for the refresh</param>
    /// <returns>True if the token was found and refreshed, false otherwise</returns>
    public static bool RefreshToken(string token, TimeSpan customTimeout)
    {
        if (IsTokenValid(token))
        {
            _tokens[token] = DateTime.UtcNow.Add(customTimeout);
            return true;
        }
        return false;
    }

    /// <summary>
    /// Gets the number of active tokens
    /// </summary>
    public static int ActiveTokenCount => _tokens.Count;

    /// <summary>
    /// Gets the expiration time for a specific token
    /// </summary>
    /// <param name="token">The token to check</param>
    /// <returns>Expiration time if token exists, null otherwise</returns>
    public static DateTime? GetTokenExpiration(string token)
    {
        if (_tokens.TryGetValue(token, out DateTime expiration))
        {
            return expiration;
        }
        return null;
    }

    /// <summary>
    /// Cleans up expired tokens from the dictionary
    /// </summary>
    private static void CleanupExpiredTokens(object state)
    {
        var now = DateTime.UtcNow;
        var expiredTokens = new System.Collections.Generic.List<string>();

        foreach (var kvp in _tokens)
        {
            if (now >= kvp.Value)
            {
                expiredTokens.Add(kvp.Key);
            }
        }

        foreach (var token in expiredTokens)
        {
            _tokens.TryRemove(token, out _);
        }
    }

    /// <summary>
    /// Manually triggers cleanup of expired tokens
    /// </summary>
    public static void ManualCleanup()
    {
        CleanupExpiredTokens(null);
    }

    /// <summary>
    /// Clears all tokens (use with caution!)
    /// </summary>
    public static void ClearAllTokens()
    {
        _tokens.Clear();
    }

    /// <summary>
    /// Shuts down the TokenManager and cleans up resources
    /// </summary>
    public static void Shutdown()
    {
        _cleanupTimer?.Dispose();
        _tokens.Clear();
        _initialized = false;
    }

    /// <summary>
    /// Ensures the TokenManager is initialized before use
    /// </summary>
    private static void EnsureInitialized()
    {
        if (!_initialized)
        {
            Initialize();
        }
    }
}