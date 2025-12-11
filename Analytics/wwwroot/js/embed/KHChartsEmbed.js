/**
 * KnuckleHUB Charts Embed
 * 
 * Standalone script for embedding KnuckleHUB charts on external websites.
 * This script handles authentication, loading dependencies, and rendering charts.
 * 
 * Usage:
 * 
 * 1. Include this script on your page:
 *    <script src="https://analytics.knucklehead-studios.com/js/embed/KHChartsEmbed.js"></script>
 * 
 * 2. Initialize and render charts:
 *    KHChartsEmbed.init({
 *        baseUrl: 'https://analytics.knucklehead-studios.com',
 *        username: 'YourUsername',
 *        passwordHash: 'your_sha256_hashed_password',
 *        container: '#my-charts-container',  // CSS selector or element
 *        projectId: 'your_project_id',       // Or 'GLOBAL' for global charts
 *        days: 30,                           // Optional: date range
 *        onReady: function() { },            // Optional: callback when ready
 *        onError: function(error) { }        // Optional: error callback
 *    });
 */

(function(window) {
    'use strict';

    const VERSION = '1.0.0';
    
    // State
    let _config = null;
    let _authToken = null;
    let _chartConfigs = [];
    let _initialized = false;
    let _dependenciesLoaded = false;

    // Required CSS
    const REQUIRED_CSS = '/css/charts.css';
    
    // Required scripts in order
    const REQUIRED_SCRIPTS = [
        '/js/core/App.js',
        '/js/services/Toast.js',
        '/js/services/Auth.js',
        '/js/services/API.js',
        '/js/services/ChartRenderer.js',
        '/js/services/ChartController.js',
        '/js/ui/ChartWidget.js'
    ];

    /**
     * Load a CSS file
     * @param {string} url - CSS URL
     * @returns {Promise}
     */
    function _loadCSS(url) {
        return new Promise((resolve, reject) => {
            // Check if already loaded
            const existing = document.querySelector(`link[href="${url}"]`);
            if (existing) {
                resolve();
                return;
            }

            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = url;
            link.onload = resolve;
            link.onerror = () => reject(new Error(`Failed to load CSS: ${url}`));
            document.head.appendChild(link);
        });
    }

    /**
     * Load a JavaScript file
     * @param {string} url - Script URL
     * @returns {Promise}
     */
    function _loadScript(url) {
        return new Promise((resolve, reject) => {
            // Check if already loaded
            const existing = document.querySelector(`script[src="${url}"]`);
            if (existing) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = url;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
            document.body.appendChild(script);
        });
    }

    /**
     * Load Chart.js if not already present
     * @returns {Promise}
     */
    function _loadChartJS() {
        return new Promise((resolve, reject) => {
            if (window.Chart) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
            script.onload = resolve;
            script.onerror = () => reject(new Error('Failed to load Chart.js'));
            document.head.appendChild(script);
        });
    }

    /**
     * Load all required dependencies
     * @returns {Promise}
     */
    async function _loadDependencies() {
        if (_dependenciesLoaded) return;

        const baseUrl = _config.baseUrl;

        // Load Chart.js first
        await _loadChartJS();

        // Load CSS
        await _loadCSS(`${baseUrl}${REQUIRED_CSS}`);

        // Load scripts in order
        for (const script of REQUIRED_SCRIPTS) {
            await _loadScript(`${baseUrl}${script}`);
        }

        _dependenciesLoaded = true;
    }

    /**
     * Authenticate with the server
     * @returns {Promise<boolean>}
     */
    async function _authenticate() {
        try {
            const response = await fetch(`${_config.baseUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: _config.username,
                    password: _config.passwordHash
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.token) {
                    _authToken = data.token;
                    
                    // Set token in KnuckleHUB Auth module
                    if (window.KnuckleHUB) {
                        const auth = KnuckleHUB.get('Auth');
                        if (auth) auth.setToken(_authToken);
                    }
                    
                    return true;
                }
            }
            return false;
        } catch (error) {
            console.error('KHChartsEmbed: Authentication error:', error);
            return false;
        }
    }

    /**
     * Fetch chart configurations
     * @returns {Promise<Array>}
     */
    async function _fetchChartConfigs() {
        try {
            const response = await fetch(
                `${_config.baseUrl}/api/event-config?projectId=${encodeURIComponent(_config.projectId)}`,
                {
                    headers: {
                        'Authorization': `Bearer ${_authToken}`,
                        'X-Auth-Token': _authToken
                    }
                }
            );

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data && data.data.configs) {
                    return data.data.configs;
                }
            }
            return [];
        } catch (error) {
            console.error('KHChartsEmbed: Error fetching configs:', error);
            return [];
        }
    }

    /**
     * Create the chart container structure
     * @param {HTMLElement} container - Target container
     */
    function _setupContainer(container) {
        container.classList.add('kh-embed-container');
        container.innerHTML = `
            <div class="kh-embed-loading">
                <div class="loading-spinner"></div>
                <p>Loading charts...</p>
            </div>
        `;
    }

    /**
     * Show error in container
     * @param {HTMLElement} container - Target container
     * @param {string} message - Error message
     */
    function _showError(container, message) {
        container.innerHTML = `
            <div class="kh-embed-error">
                <p>Error: ${message}</p>
            </div>
        `;
    }

    /**
     * Render charts in the container
     * @param {HTMLElement} container - Target container
     */
    async function _renderCharts(container) {
        // Create charts grid
        container.innerHTML = '<div class="charts-grid"></div>';
        const chartsGrid = container.querySelector('.charts-grid');

        // Configure API base URL
        if (window.KnuckleHUB) {
            KnuckleHUB.setConfig('apiBaseUrl', `${_config.baseUrl}/api`);
        }

        // Use ChartController to render charts (read-only mode)
        const chartController = KnuckleHUB.get('ChartController');
        
        if (chartController) {
            await chartController.renderCharts({
                container: chartsGrid,
                configs: _chartConfigs,
                projectId: _config.projectId,
                dashboardVar: null,  // No dashboard variable needed
                enableDragDrop: false,  // Disable drag and drop
                onOrderChange: null,
                days: _config.days || 30,
                readonly: true  // Read-only mode
            });
        }
    }

    /**
     * Initialize the embed
     * @param {Object} options - Configuration options
     */
    async function init(options) {
        // Validate required options
        if (!options.baseUrl) {
            throw new Error('KHChartsEmbed: baseUrl is required');
        }
        if (!options.username || !options.passwordHash) {
            throw new Error('KHChartsEmbed: username and passwordHash are required');
        }
        if (!options.container) {
            throw new Error('KHChartsEmbed: container is required');
        }
        if (!options.projectId) {
            throw new Error('KHChartsEmbed: projectId is required');
        }

        // Store config
        _config = {
            baseUrl: options.baseUrl.replace(/\/$/, ''),  // Remove trailing slash
            username: options.username,
            passwordHash: options.passwordHash,
            projectId: options.projectId,
            days: options.days || 30,
            onReady: options.onReady || function() {},
            onError: options.onError || function(e) { console.error(e); }
        };

        // Get container element
        const container = typeof options.container === 'string'
            ? document.querySelector(options.container)
            : options.container;

        if (!container) {
            const error = new Error('KHChartsEmbed: Container element not found');
            _config.onError(error);
            throw error;
        }

        // Setup container with loading state
        _setupContainer(container);

        try {
            // Load dependencies
            await _loadDependencies();

            // Initialize KnuckleHUB for embed mode (no redirects)
            if (window.KnuckleHUB) {
                await KnuckleHUB.init('embed');
            }

            // Authenticate
            const authenticated = await _authenticate();
            if (!authenticated) {
                throw new Error('Authentication failed');
            }

            // Fetch chart configurations
            _chartConfigs = await _fetchChartConfigs();

            if (_chartConfigs.length === 0) {
                container.innerHTML = `
                    <div class="kh-embed-error" style="color: var(--kh-text-muted); background: transparent;">
                        <p>No charts configured for this project.</p>
                    </div>
                `;
                _config.onReady();
                return;
            }

            // Render charts
            await _renderCharts(container);

            _initialized = true;
            _config.onReady();

        } catch (error) {
            console.error('KHChartsEmbed: Initialization error:', error);
            _showError(container, error.message);
            _config.onError(error);
        }
    }

    /**
     * Refresh the charts
     * @returns {Promise}
     */
    async function refresh() {
        if (!_initialized || !_config) {
            throw new Error('KHChartsEmbed: Not initialized');
        }

        const container = typeof _config.container === 'string'
            ? document.querySelector(_config.container)
            : _config.container;

        if (!container) return;

        // Re-fetch and render
        _chartConfigs = await _fetchChartConfigs();
        await _renderCharts(container);
    }

    /**
     * Get current chart configurations
     * @returns {Array}
     */
    function getConfigs() {
        return [..._chartConfigs];
    }

    /**
     * Check if initialized
     * @returns {boolean}
     */
    function isInitialized() {
        return _initialized;
    }

    /**
     * Get version
     * @returns {string}
     */
    function getVersion() {
        return VERSION;
    }

    // Public API
    window.KHChartsEmbed = {
        init,
        refresh,
        getConfigs,
        isInitialized,
        getVersion
    };

})(window);
