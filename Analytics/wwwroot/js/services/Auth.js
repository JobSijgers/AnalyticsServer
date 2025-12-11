/**
 * Authentication Service
 * Handles all authentication-related functionality including token management,
 * validation, and authenticated API requests.
 */
KnuckleHUB.register('Auth', (function() {
    'use strict';

    const TOKEN_KEY = 'auth_token';
    let _token = null;

    // Initialize token from storage
    function _init() {
        const storedToken = localStorage.getItem(TOKEN_KEY);
        if (storedToken) {
            _token = storedToken;
            console.log('Auth: Token loaded from storage');
        }
        _interceptFetch();
    }

    /**
     * Hash a password using SHA-256
     * @param {string} password - Plain text password
     * @returns {Promise<string>} Hashed password
     */
    async function hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Attempt to login with credentials
     * @param {string} username - Username
     * @param {string} password - Plain text password
     * @returns {Promise<{success: boolean, message?: string}>}
     */
    async function login(username, password) {
        try {
            const passwordHash = await hashPassword(password);
            
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password: passwordHash })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.token) {
                    setToken(data.token);
                    return { success: true };
                }
                return { success: false, message: data.message || 'Login failed' };
            }

            if (response.status === 401) {
                return { success: false, message: 'Invalid username or password' };
            }
            if (response.status === 400) {
                const errorData = await response.json();
                return { success: false, message: errorData.message || 'Invalid request' };
            }
            return { success: false, message: 'Login failed. Please try again.' };
        } catch (error) {
            console.error('Auth: Login error:', error);
            return { success: false, message: 'Network error. Please try again.' };
        }
    }

    /**
     * Validate the current token with the server
     * @returns {Promise<boolean>}
     */
    async function validateToken() {
        if (!hasToken()) return false;

        try {
            const response = await fetch('/api/auth/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: _token })
            });

            if (response.ok) {
                const data = await response.json();
                return data.valid === true;
            }
            return false;
        } catch (error) {
            console.error('Auth: Token validation failed:', error);
            return false;
        }
    }

    /**
     * Logout the user
     */
    async function logout() {
        try {
            await fetch('/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                }
            });
        } catch (error) {
            console.warn('Auth: Server logout failed:', error);
        } finally {
            clearToken();
        }
    }

    /**
     * Set the authentication token
     * @param {string} token - Authentication token
     * @returns {boolean} Success
     */
    function setToken(token) {
        if (!token || typeof token !== 'string') {
            console.error('Auth: Invalid token provided');
            return false;
        }

        try {
            _token = token;
            localStorage.setItem(TOKEN_KEY, token);
            console.log('Auth: Token saved successfully');
            return true;
        } catch (error) {
            console.error('Auth: Failed to save token:', error);
            return false;
        }
    }

    /**
     * Get the current token
     * @returns {string|null}
     */
    function getToken() {
        return _token;
    }

    /**
     * Check if a token exists
     * @returns {boolean}
     */
    function hasToken() {
        return _token !== null && _token !== '';
    }

    /**
     * Clear the token (local logout)
     */
    function clearToken() {
        _token = null;
        localStorage.removeItem(TOKEN_KEY);
        console.log('Auth: Token cleared');
    }

    /**
     * Get authentication headers for API requests
     * @returns {Object}
     */
    function getAuthHeaders() {
        return _token ? {
            'Authorization': `Bearer ${_token}`,
            'X-Auth-Token': _token
        } : {};
    }

    /**
     * Make an authenticated API request
     * @param {string} url - Request URL
     * @param {Object} options - Fetch options
     * @returns {Promise<Response>}
     */
    async function request(url, options = {}) {
        if (!hasToken()) {
            throw new Error('No authentication token available');
        }

        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
                ...getAuthHeaders()
            }
        });

        if (response.status === 401) {
            _handleTokenExpiration();
            throw new Error('Authentication failed');
        }

        return response;
    }

    /**
     * Handle token expiration
     * @private
     */
    function _handleTokenExpiration() {
        clearToken();
        
        const toast = KnuckleHUB.get('Toast');
        if (toast) {
            toast.warning('Session expired. Please login again.');
        }

        const isIndexPage = window.location.pathname.includes('index.html') ||
            window.location.pathname === '/' ||
            window.location.pathname.endsWith('/');

        if (!isIndexPage) {
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
        }
    }

    /**
     * Intercept fetch requests to add authentication headers
     * @private
     */
    function _interceptFetch() {
        const originalFetch = window.fetch;

        window.fetch = async (...args) => {
            const [resource, config = {}] = args;

            const isAuthEndpoint = typeof resource === 'string' &&
                (resource.includes('/login') || resource.includes('/auth'));

            if (!isAuthEndpoint && hasToken()) {
                const headers = {
                    ...config.headers,
                    ...getAuthHeaders()
                };

                const newConfig = { ...config, headers };
                const response = await originalFetch(resource, newConfig);

                if (response.status === 401) {
                    console.warn('Auth: Token expired or invalid');
                    _handleTokenExpiration();
                }

                return response;
            }

            return originalFetch(...args);
        };
    }

    // Initialize
    _init();

    // Public API
    return {
        login,
        logout,
        validateToken,
        hashPassword,
        setToken,
        getToken,
        hasToken,
        clearToken,
        getAuthHeaders,
        request
    };
})());

// Legacy support - create global tokenManager reference
window.tokenManager = {
    hasToken: () => KnuckleHUB.get('Auth').hasToken(),
    getToken: () => KnuckleHUB.get('Auth').getToken(),
    setToken: (token) => KnuckleHUB.get('Auth').setToken(token),
    clearToken: () => KnuckleHUB.get('Auth').clearToken(),
    logout: () => KnuckleHUB.get('Auth').logout(),
    validateTokenWithServer: () => KnuckleHUB.get('Auth').validateToken(),
    getAuthHeader: () => KnuckleHUB.get('Auth').getAuthHeaders(),
    authenticatedFetch: (url, options) => KnuckleHUB.get('Auth').request(url, options)
};
