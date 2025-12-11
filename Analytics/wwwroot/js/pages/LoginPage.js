/**
 * Login Page Controller
 * Handles the login page functionality.
 */
KnuckleHUB.register('LoginPage', (function() {
    'use strict';

    let _loginForm = null;
    let _usernameInput = null;
    let _passwordInput = null;
    let _loginBtn = null;
    let _btnText = null;

    /**
     * Initialize the login page
     */
    function init() {
        _cacheElements();
        _bindEvents();
    }

    /**
     * Cache DOM elements
     * @private
     */
    function _cacheElements() {
        _loginForm = document.getElementById('login-form');
        _usernameInput = document.getElementById('username');
        _passwordInput = document.getElementById('password');
        _loginBtn = document.getElementById('login-btn');
        _btnText = _loginBtn?.querySelector('.btn-text');
    }

    /**
     * Bind event listeners
     * @private
     */
    function _bindEvents() {
        if (_loginForm) {
            _loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                _handleLogin();
            });
        }
    }

    /**
     * Handle login form submission
     * @private
     */
    async function _handleLogin() {
        const toast = KnuckleHUB.get('Toast');
        const auth = KnuckleHUB.get('Auth');

        const username = _usernameInput?.value.trim();
        const password = _passwordInput?.value;

        if (!username || !password) {
            if (toast) toast.error('Please enter both username and password');
            return;
        }

        _setLoadingState(true);

        const result = await auth.login(username, password);

        if (result.success) {
            if (toast) toast.success('Login successful!');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);
        } else {
            if (toast) toast.error(result.message);
            _setLoadingState(false);
        }
    }

    /**
     * Set loading state on the login button
     * @param {boolean} loading - Whether to show loading state
     * @private
     */
    function _setLoadingState(loading) {
        if (_loginBtn) {
            _loginBtn.disabled = loading;
        }
        if (_btnText) {
            _btnText.textContent = loading ? 'Signing In...' : 'Sign In';
        }
    }

    // Public API
    return {
        init
    };
})());
