// Login JavaScript
class LoginManager {
    constructor() {
        this.loginForm = document.getElementById('login-form');
        this.usernameInput = document.getElementById('username');
        this.passwordInput = document.getElementById('password');
        this.loginBtn = document.getElementById('login-btn');
        this.errorMessage = document.getElementById('login-error');
        this.btnText = this.loginBtn.querySelector('.btn-text');
        this.btnSpinner = this.loginBtn.querySelector('.btn-spinner');

        this.initializeEventListeners();
        this.checkExistingToken();
    }

    initializeEventListeners() {
        this.loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Clear error when user starts typing
        [this.usernameInput, this.passwordInput].forEach(input => {
            input.addEventListener('input', () => {
                this.hideError();
            });
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

    async handleLogin() {
        const username = this.usernameInput.value.trim();
        const password = this.passwordInput.value;

        if (!username || !password) {
            this.showError('Please enter both username and password');
            return;
        }

        this.setLoadingState(true);

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password })
            });

            if (response.ok) {
                const data = await response.json();

                if (data.success && data.token) {
                    // Save token and redirect
                    tokenManager.setToken(data.token);
                    toastManager.success('Login successful!');

                    setTimeout(() => {
                        window.location.href = 'dashboard.html';
                    }, 1000);
                } else {
                    this.showError(data.message || 'Login failed');
                }
            } else {
                const errorData = await response.json();
                this.showError(errorData.message || 'Invalid credentials');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showError('Network error. Please try again.');
        } finally {
            this.setLoadingState(false);
        }
    }

    setLoadingState(loading) {
        if (loading) {
            this.loginBtn.disabled = true;
            this.btnText.textContent = 'Signing In...';
            this.btnSpinner.classList.remove('hidden');
        } else {
            this.loginBtn.disabled = false;
            this.btnText.textContent = 'Sign In';
            this.btnSpinner.classList.add('hidden');
        }
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.classList.remove('hidden');

        // Auto-hide error after 5 seconds
        setTimeout(() => {
            this.hideError();
        }, 5000);
    }

    hideError() {
        this.errorMessage.classList.add('hidden');
    }
}

// Initialize login manager when DOM is loaded
let loginManager;
document.addEventListener('DOMContentLoaded', () => {
    loginManager = new LoginManager();
});