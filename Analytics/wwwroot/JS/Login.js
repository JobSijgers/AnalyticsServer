// Login JavaScript
class LoginManager {
    constructor() {
        this.loginForm = document.getElementById('login-form');
        this.usernameInput = document.getElementById('username');
        this.passwordInput = document.getElementById('password');
        this.loginBtn = document.getElementById('login-btn');
        this.btnText = this.loginBtn.querySelector('.btn-text');

        this.initializeEventListeners();
        this.checkExistingToken();
    }

    initializeEventListeners() {
        this.loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });
    }

    checkExistingToken() {
        // If user already has a valid token, redirect to dashboard
        if (tokenManager.hasToken()) {
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);
        }
    }

    // Hash password using SHA-256
    async hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async handleLogin() {
        const username = this.usernameInput.value.trim();
        const password = this.passwordInput.value;

        if (!username || !password) {
            toastManager.error('Please enter both username and password');
            return;
        }

        this.setLoadingState(true);

        try {
            const passwordHash = await this.hashPassword(password);

            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: username,
                    password: passwordHash
                })
            });

            console.log('Login response status:', response.status);

            if (response.ok) {
                const data = await response.json();
                console.log('Login response data:', data);

                if (data.success && data.token) {
                    // Save token and redirect
                    tokenManager.setToken(data.token);
                    toastManager.success('Login successful!');

                    setTimeout(() => {
                        window.location.href = 'dashboard.html';
                    }, 1000);
                } else {
                    toastManager.error(data.message || 'Login failed');
                }
            } else {
                // Handle non-OK responses
                if (response.status === 401) {
                    toastManager.error('Invalid username or password');
                } else if (response.status === 400) {
                    const errorData = await response.json();
                    toastManager.error(errorData.message || 'Invalid request');
                } else {
                    toastManager.error('Login failed. Please try again.');
                }
            }
        } catch (error) {
            console.error('Login error:', error);
            toastManager.error('Network error. Please try again.');
        } finally {
            this.setLoadingState(false);
        }
    }

    setLoadingState(loading) {
        if (loading) {
            this.loginBtn.disabled = true;
            this.btnText.textContent = 'Signing In...';
        } else {
            this.loginBtn.disabled = false;
            this.btnText.textContent = 'Sign In';
        }
    }
}

// Initialize login manager when DOM is loaded
let loginManager;
document.addEventListener('DOMContentLoaded', () => {
    loginManager = new LoginManager();
});