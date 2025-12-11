/**
 * KnuckleHUB Application Core
 * Central application module that manages initialization, configuration, and module registration.
 */
const KnuckleHUB = (function() {
    'use strict';

    const _modules = {};
    const _config = {
        apiBaseUrl: '/api',
        storageKeys: {
            authToken: 'auth_token',
            currentProject: 'khs_analytics_projectId'
        },
        defaults: {
            dateRange: 30,
            chartHeight: '300px',
            numberCardHeight: '150px'
        }
    };

    const _events = {};

    function register(name, module) {
        if (_modules[name]) {
            console.warn(`Module "${name}" is already registered. Overwriting.`);
        }
        _modules[name] = typeof module === 'function' ? module() : module;
        return _modules[name];
    }

    function get(name) {
        if (!_modules[name]) {
            console.error(`Module "${name}" is not registered.`);
            return null;
        }
        return _modules[name];
    }

    function config(key) {
        if (key) {
            const keys = key.split('.');
            let value = _config;
            for (const k of keys) {
                value = value?.[k];
            }
            return value;
        }
        return { ..._config };
    }

    function setConfig(key, value) {
        const keys = key.split('.');
        let obj = _config;
        for (let i = 0; i < keys.length - 1; i++) {
            if (!obj[keys[i]]) obj[keys[i]] = {};
            obj = obj[keys[i]];
        }
        obj[keys[keys.length - 1]] = value;
    }

    function on(event, callback) {
        if (!_events[event]) _events[event] = [];
        _events[event].push(callback);
    }

    function off(event, callback) {
        if (_events[event]) {
            _events[event] = _events[event].filter(cb => cb !== callback);
        }
    }

    function emit(event, data) {
        if (_events[event]) {
            _events[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event handler for "${event}":`, error);
                }
            });
        }
    }

    async function init(pageType) {
        console.log(`Initializing KnuckleHUB for page: ${pageType}`);
        
        const auth = get('Auth');
        
        switch (pageType) {
            case 'login':
                await initLoginPage();
                break;
            case 'dashboard':
                await initDashboardPage();
                break;
            case 'project':
                await initProjectPage();
                break;
            case 'embed':
                // Embed mode - don't do page redirects
                break;
            default:
                console.warn(`Unknown page type: ${pageType}`);
        }

        emit('app:initialized', { pageType });
    }

    async function initLoginPage() {
        const auth = get('Auth');
        const loginPage = get('LoginPage');
        
        if (auth && auth.hasToken()) {
            const isValid = await auth.validateToken();
            if (isValid) {
                window.location.href = 'dashboard.html';
                return;
            }
            auth.clearToken();
        }

        if (loginPage) loginPage.init();
    }

    async function initDashboardPage() {
        const auth = get('Auth');
        
        if (!auth || !auth.hasToken()) {
            window.location.href = 'index.html';
            return;
        }

        const isValid = await auth.validateToken();
        if (!isValid) {
            auth.clearToken();
            window.location.href = 'index.html';
            return;
        }

        const dashboardPage = get('DashboardPage');
        if (dashboardPage) await dashboardPage.init();
    }

    async function initProjectPage() {
        const auth = get('Auth');
        
        if (!auth || !auth.hasToken()) {
            window.location.href = 'index.html';
            return;
        }

        const isValid = await auth.validateToken();
        if (!isValid) {
            auth.clearToken();
            window.location.href = 'index.html';
            return;
        }

        const currentProject = localStorage.getItem(_config.storageKeys.currentProject);
        if (!currentProject) {
            window.location.href = 'dashboard.html';
            return;
        }

        const projectPage = get('ProjectPage');
        if (projectPage) await projectPage.init(currentProject);
    }

    return {
        register,
        get,
        config,
        setConfig,
        on,
        off,
        emit,
        init
    };
})();

window.KnuckleHUB = KnuckleHUB;
