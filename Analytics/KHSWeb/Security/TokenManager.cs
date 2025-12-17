using System.Collections.Concurrent;

namespace KHSWeb.Security;

public static class TokenManager
{
    private static readonly ConcurrentDictionary<string, DateTime> _tokens = new();
    private static readonly TimeSpan _defaultTokenTimeout = TimeSpan.FromDays(7);
    private static Timer _cleanupTimer = null!;
    private static bool _initialized = false;
    private static readonly Lock _initLock = new Lock();

    static TokenManager()
    {
        Initialize();
    }

    public static void Initialize()
    {
        Initialize(_defaultTokenTimeout);
    }

    public static void Initialize(TimeSpan tokenTimeout)
    {
        if (!_initialized)
        {
            lock (_initLock)
            {
                if (!_initialized)
                {
                    TokenTimeout = tokenTimeout;
                    _cleanupTimer = new Timer(CleanupExpiredTokens!, null, 
                        TimeSpan.FromMinutes(1), TimeSpan.FromMinutes(1));
                    _initialized = true;
                }
            }
        }
    }

    public static TimeSpan TokenTimeout { get; set; } = _defaultTokenTimeout;

    public static string CreateToken()
    {
        EnsureInitialized();
        var token = Guid.NewGuid().ToString();
        var expiration = DateTime.UtcNow.Add(TokenTimeout);
        
        _tokens[token] = expiration;
        return token;
    }

    public static string CreateToken(TimeSpan customTimeout)
    {
        EnsureInitialized();
        var token = Guid.NewGuid().ToString();
        var expiration = DateTime.UtcNow.Add(customTimeout);
        
        _tokens[token] = expiration;
        return token;
    }

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
                _tokens.TryRemove(token, out _);
                return false;
            }
        }

        return false;
    }

    public static bool InvalidateToken(string token)
    {
        return _tokens.TryRemove(token, out _);
    }

    public static bool RefreshToken(string token)
    {
        return RefreshToken(token, TokenTimeout);
    }

    public static bool RefreshToken(string token, TimeSpan customTimeout)
    {
        if (IsTokenValid(token))
        {
            _tokens[token] = DateTime.UtcNow.Add(customTimeout);
            return true;
        }
        return false;
    }

    public static int ActiveTokenCount => _tokens.Count;

    public static DateTime? GetTokenExpiration(string token)
    {
        if (_tokens.TryGetValue(token, out DateTime expiration))
        {
            return expiration;
        }
        return null;
    }

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

    public static void Shutdown()
    {
        _cleanupTimer?.Dispose();
        _tokens.Clear();
        _initialized = false;
    }

    private static void EnsureInitialized()
    {
        if (!_initialized)
        {
            Initialize();
        }
    }
}