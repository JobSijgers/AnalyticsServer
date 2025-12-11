/**
 * Chart Controller Service
 * Shared service for managing chart operations across different pages.
 * Eliminates duplicate code between DashboardPage and ProjectPage.
 */
KnuckleHUB.register('ChartController', (function() {
    'use strict';

    /**
     * Render all charts for a project
     * @param {Object} options - Render options
     * @param {HTMLElement} options.container - Container element for charts
     * @param {Array} options.configs - Chart configurations
     * @param {string} options.projectId - Project ID
     * @param {string} options.dashboardVar - Dashboard variable name for onclick
     * @param {boolean} options.enableDragDrop - Enable drag and drop
     * @param {Function} options.onOrderChange - Callback for order changes
     * @param {number} options.days - Date range in days
     * @param {boolean} options.readonly - Read-only mode (no actions/drag)
     * @returns {Promise<void>}
     */
    async function renderCharts(options) {
        const {
            container,
            configs,
            projectId,
            dashboardVar = null,
            enableDragDrop = true,
            onOrderChange = null,
            days = 30,
            readonly = false
        } = options;

        if (!container) return;

        container.innerHTML = '';

        const sortedConfigs = [...configs].sort((a, b) => 
            (a.displayOrder || 0) - (b.displayOrder || 0)
        );

        const chartWidget = KnuckleHUB.get('ChartWidget');
        const promises = [];

        for (const config of sortedConfigs) {
            const element = chartWidget.createSkeleton(config, dashboardVar, readonly);
            chartWidget.insertInOrder(container, element, config, configs);
            promises.push(fetchAndRenderChart({
                element,
                config,
                projectId,
                days,
                readonly
            }));
        }

        // Setup drag and drop if enabled and not readonly
        if (enableDragDrop && !readonly && onOrderChange) {
            const dragDrop = KnuckleHUB.get('DragDrop');
            if (dragDrop) {
                dragDrop.setup(container, onOrderChange);
            }
        }

        await Promise.allSettled(promises);
    }

    /**
     * Fetch and render a single chart
     * @param {Object} options - Fetch options
     * @param {HTMLElement} options.element - Chart widget element
     * @param {Object} options.config - Chart configuration
     * @param {string} options.projectId - Project ID
     * @param {number} options.days - Date range in days
     * @param {boolean} options.readonly - Read-only mode
     * @returns {Promise<void>}
     */
    async function fetchAndRenderChart(options) {
        const {
            element,
            config,
            projectId,
            days = 30,
            readonly = false
        } = options;

        const api = KnuckleHUB.get('API');
        const chartRenderer = KnuckleHUB.get('ChartRenderer');
        const chartWidget = KnuckleHUB.get('ChartWidget');
        const chartId = `chart-${config.id}`;

        // Try cached data first
        const cachedResult = await api.getChartData({
            projectId: projectId,
            eventKey: config.eventKey,
            propertyName: config.propertyToDisplay || '',
            chartType: config.chartType,
            days: days,
            filtersJson: config.filtersJson || '',
            configId: config.id,
            useCache: true
        });

        if (cachedResult.success && cachedResult.chartData) {
            chartWidget.hideLoading(config.id);
            if (!readonly) {
                chartWidget.updateSize(element, config, cachedResult.chartData);
            }
            chartRenderer.render(chartId, cachedResult.chartData, config.chartType, config);
        }

        // Fetch fresh data
        const freshResult = await api.getChartData({
            projectId: projectId,
            eventKey: config.eventKey,
            propertyName: config.propertyToDisplay || '',
            chartType: config.chartType,
            days: days,
            filtersJson: config.filtersJson || '',
            configId: config.id,
            useCache: false
        });

        chartWidget.hideLoading(config.id);

        if (freshResult.success && freshResult.chartData) {
            if (!readonly) {
                chartWidget.updateSize(element, config, freshResult.chartData);
            }
            chartRenderer.render(chartId, freshResult.chartData, config.chartType, config);
        }
    }

    /**
     * Update chart order on the server
     * @param {string} projectId - Project ID
     * @param {Array} configs - Current configurations
     * @param {Array} newOrder - New order array
     * @returns {Promise<void>}
     */
    async function updateOrder(projectId, configs, newOrder) {
        const api = KnuckleHUB.get('API');

        // Update local configs
        configs.forEach(config => {
            const orderItem = newOrder.find(o => o.id === config.id);
            if (orderItem) {
                config.displayOrder = orderItem.displayOrder;
            }
        });

        // Save to server
        await api.updateChartOrder(projectId, newOrder);
    }

    /**
     * Delete a chart
     * @param {string} configId - Configuration ID
     * @param {string} projectId - Project ID
     * @param {Array} configs - Configurations array (will be modified)
     * @returns {Promise<boolean>} Success status
     */
    async function deleteChart(configId, projectId, configs) {
        if (!confirm('Are you sure you want to delete this chart?')) {
            return false;
        }

        const toast = KnuckleHUB.get('Toast');
        const api = KnuckleHUB.get('API');
        const chartWidget = KnuckleHUB.get('ChartWidget');

        const result = await api.deleteChartConfig(configId, projectId);

        if (result.success) {
            if (toast) toast.success('Chart deleted!');
            
            // Remove from configs array
            const index = configs.findIndex(c => c.id === configId);
            if (index > -1) configs.splice(index, 1);
            
            chartWidget.remove(configId);

            // Update order
            const newOrder = configs.map((c, i) => ({ id: c.id, displayOrder: i }));
            await api.updateChartOrder(projectId, newOrder);

            return true;
        } else {
            if (toast) toast.error('Failed to delete chart');
            return false;
        }
    }

    /**
     * Copy metric link to clipboard
     * @param {string} chartId - Chart ID
     * @param {string} baseUrl - Base URL (optional, defaults to current origin)
     */
    function copyMetricLink(chartId, baseUrl = null) {
        const toast = KnuckleHUB.get('Toast');
        const url = `${baseUrl || window.location.origin}/api/public/metric?id=${chartId}`;

        navigator.clipboard.writeText(url).then(() => {
            if (toast) toast.success('Link copied to clipboard');
        }).catch(err => {
            console.error('Could not copy text:', err);
            if (toast) toast.error('Failed to copy link');
        });
    }

    /**
     * Clean project name (remove prefix before underscore)
     * @param {string} projectName - Project name
     * @returns {string}
     */
    function cleanProjectName(projectName) {
        if (!projectName) return '';
        const underscoreIndex = projectName.indexOf('_');
        return underscoreIndex !== -1 ? projectName.substring(underscoreIndex + 1) : projectName;
    }

    // Public API
    return {
        renderCharts,
        fetchAndRenderChart,
        updateOrder,
        deleteChart,
        copyMetricLink,
        cleanProjectName
    };
})());
