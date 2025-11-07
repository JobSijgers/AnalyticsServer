// TokenManager.js
class TokenManager {
    constructor() {
        this.tokenKey = 'auth_token';
        this.token = null;
        this.initializeToken();

        // Check token validity on page load
        this.checkTokenOnLoad();

        // Intercept fetch requests to add token automatically
        this.interceptFetch();
    }

    // Initialize token from storage
    initializeToken() {
        const storedToken = localStorage.getItem(this.tokenKey);
        if (storedToken) {
            this.token = storedToken;
            console.log('Token loaded from storage');
        }
    }

    // Check token validity when page loads
    async checkTokenOnLoad() {
        // Check if we're on the index/login page
        const isIndexPage = window.location.pathname.includes('index.html') ||
            window.location.pathname === '/' ||
            window.location.pathname.endsWith('/') ||
            document.title === 'Login'; // Additional check

        try {
            // If we have a token, validate it
            if (this.hasToken()) {
                const isValid = await this.validateTokenWithServer();

                if (isValid) {
                    // Token is valid - redirect to dashboard if on index page
                    if (isIndexPage) {
                        console.log('Valid token found, redirecting to dashboard');
                        this.redirectToDashboard();
                    } else {
                        console.log('Valid token, access granted to protected page');
                    }
                } else {
                    // Token is invalid - clear it and stay on current page
                    console.log('Token invalid, clearing token');
                    this.clearToken();

                    // If on a protected page (not index), redirect to index
                    if (!isIndexPage) {
                        this.redirectToIndex();
                    }
                }
            } else {
                // No token - if on protected page, redirect to index
                if (!isIndexPage) {
                    console.log('No token found, redirecting to index');
                    this.redirectToIndex();
                }
            }
        } catch (error) {
            console.error('Token validation failed:', error);
            // On error, clear token and redirect appropriately
            this.clearToken();
            if (!isIndexPage) {
                this.redirectToIndex();
            }
        }
    }

    // Validate token with server endpoint
    async validateTokenWithServer() {
        if (!this.hasToken()) {
            return false;
        }

        try {
            const response = await fetch('/auth', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token: this.token })
            });

            if (response.ok) {
                const data = await response.json();
                return data.message === 'Token valid';
            }

            return false;
        } catch (error) {
            console.error('Token validation request failed:', error);
            return false;
        }
    }

    // Redirect to index.html
    redirectToIndex() {
        // Only redirect if not already on index page
        const isIndexPage = window.location.pathname.includes('index.html') ||
            window.location.pathname === '/' ||
            window.location.pathname.endsWith('/');

        if (!isIndexPage) {
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 500);
        }
    }

    // Redirect to dashboard
    redirectToDashboard() {
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 500);
    }

    // Save token to both memory and localStorage
    setToken(token) {
        if (!token || typeof token !== 'string') {
            console.error('Invalid token provided');
            return false;
        }

        try {
            this.token = token;
            localStorage.setItem(this.tokenKey, token);
            console.log('Token saved successfully');
            return true;
        } catch (error) {
            console.error('Failed to save token:', error);
            return false;
        }
    }

    // Get the current token
    getToken() {
        return this.token;
    }

    // Check if token exists
    hasToken() {
        return this.token !== null && this.token !== '';
    }

    // Remove token (logout)
    clearToken() {
        this.token = null;
        localStorage.removeItem(this.tokenKey);
        console.log('Token cleared');
    }

    // Validate token format (basic validation)
    isValidTokenFormat() {
        if (!this.token) return false;

        // Basic UUID format validation
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuidRegex.test(this.token);
    }

    // Get authentication headers for manual requests
    getAuthHeader() {
        return this.token ? {
            'Authorization': `Bearer ${this.token}`,
            'X-Auth-Token': this.token
        } : {};
    }

    // Automatically intercept all fetch requests to add token
    interceptFetch() {
        const originalFetch = window.fetch;

        window.fetch = async (...args) => {
            // Add token to all requests (except login and auth endpoints)
            const [resource, config = {}] = args;

            const isAuthEndpoint = typeof resource === 'string' &&
                (resource.includes('/login') || resource.includes('/auth'));

            if (!isAuthEndpoint && this.hasToken()) {
                const headers = {
                    ...config.headers,
                    ...this.getAuthHeader()
                };

                const newConfig = {
                    ...config,
                    headers
                };

                // Make the request
                const response = await originalFetch(resource, newConfig);

                // Check for token expiration
                if (response.status === 401) {
                    console.warn('Token expired or invalid');
                    this.handleTokenExpiration();
                }

                return response;
            }

            return originalFetch(...args);
        };
    }

    handleTokenExpiration() {
        this.clearToken();
        if (typeof toastManager !== 'undefined') {
            toastManager.warning('Session expired. Please login again.');
        }

        // Redirect to index if not on index page
        const isIndexPage = window.location.pathname.includes('index.html') ||
            window.location.pathname === '/' ||
            window.location.pathname.endsWith('/');

        if (!isIndexPage) {
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
        }
    }

    // Helper method for making authenticated API calls
    async authenticatedFetch(url, options = {}) {
        if (!this.hasToken()) {
            throw new Error('No authentication token available');
        }

        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
                ...this.getAuthHeader()
            }
        });

        if (response.status === 401) {
            this.handleTokenExpiration();
            throw new Error('Authentication failed');
        }

        return response;
    }

    // Add to TokenManager.js class
    async logout() {
        try {
            // Optional: Notify server to invalidate token
            await fetch('/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAuthHeader()
                }
            });
        } catch (error) {
            console.warn('Server logout failed, but local token cleared:', error);
        } finally {
            // Always clear local token
            this.clearToken();
        }
    }
}

// Create a singleton instance
const tokenManager = new TokenManager();

// Add CSS for toast animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = tokenManager;
}


