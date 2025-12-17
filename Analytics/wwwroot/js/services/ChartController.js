/**
 * Chart Controller Service
 * Shared service for managing chart operations across different pages.
 */
KnuckleHUB.register('ChartController', (function () {
    'use strict';

    const _activeRequests = {};

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

        const sortedConfigs = [...configs].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
        const chartWidget = KnuckleHUB.get('ChartWidget');
        const promises = [];

        for (const config of sortedConfigs) {
            const element = chartWidget.createSkeleton(config, dashboardVar, readonly);
            chartWidget.insertInOrder(container, element, config, configs);
            promises.push(fetchAndRenderChart({ element, config, projectId, days, readonly }));
        }

        if (enableDragDrop && !readonly && onOrderChange) {
            const dragDrop = KnuckleHUB.get('DragDrop');
            if (dragDrop) dragDrop.setup(container, onOrderChange);
        }

        await Promise.allSettled(promises);
    }

    async function fetchAndRenderChart(options) {
        const { element, config, projectId, days = 30, readonly = false } = options;
        const api = KnuckleHUB.get('API');
        const chartRenderer = KnuckleHUB.get('ChartRenderer');
        const chartWidget = KnuckleHUB.get('ChartWidget');
        const chartId = `chart-${config.id}`;

        const requestId = Date.now();
        _activeRequests[config.id] = requestId;

        // Callback for handling chart clicks
        if (!readonly) {
            config.onDataPointClick = (data) => {
                const projectPage = KnuckleHUB.get('ProjectPage');
                if (projectPage && projectPage.handleDrillDown) {
                    projectPage.handleDrillDown({
                        ...data,
                        projectId,
                        eventKey: config.eventKey,
                        propertyName: config.propertyToDisplay,
                        filtersJson: config.filtersJson // Critical: Pass filters to Drill Down
                    });
                }
            };
        }

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

        if (_activeRequests[config.id] === requestId) {
            if (cachedResult.success && cachedResult.chartData) {
                chartWidget.hideLoading(config.id);
                if (cachedResult.widgetSize) config.widgetSize = cachedResult.widgetSize;
                chartWidget.updateSize(element, config, cachedResult.chartData);
                chartRenderer.render(chartId, cachedResult.chartData, config.chartType, config);
            }
        } else {
            return;
        }

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

        if (_activeRequests[config.id] === requestId) {
            chartWidget.hideLoading(config.id);
            if (freshResult.success && freshResult.chartData) {
                if (freshResult.widgetSize) config.widgetSize = freshResult.widgetSize;
                chartWidget.updateSize(element, config, freshResult.chartData);
                chartRenderer.render(chartId, freshResult.chartData, config.chartType, config);
            }
        }
    }

    async function updateOrder(projectId, configs, newOrder) {
        const api = KnuckleHUB.get('API');
        configs.forEach(config => {
            const orderItem = newOrder.find(o => o.id === config.id);
            if (orderItem) config.displayOrder = orderItem.displayOrder;
        });
        await api.updateChartOrder(projectId, newOrder);
    }

    async function deleteChart(configId, projectId, configs) {
        if (!confirm('Are you sure you want to delete this chart?')) return false;
        const toast = KnuckleHUB.get('Toast');
        const api = KnuckleHUB.get('API');
        const chartWidget = KnuckleHUB.get('ChartWidget');
        const result = await api.deleteChartConfig(configId, projectId);
        if (result.success) {
            if (toast) toast.success('Chart deleted!');
            const index = configs.findIndex(c => c.id === configId);
            if (index > -1) configs.splice(index, 1);
            chartWidget.remove(configId);
            const newOrder = configs.map((c, i) => ({id: c.id, displayOrder: i}));
            await api.updateChartOrder(projectId, newOrder);
            return true;
        } else {
            if (toast) toast.error('Failed to delete chart');
            return false;
        }
    }

    function copyMetricLink(chartId, baseUrl = null) {
        const toast = KnuckleHUB.get('Toast');
        const url = `${baseUrl || window.location.origin}/api/public/metric?id=${chartId}`;
        navigator.clipboard.writeText(url).then(() => {
            if (toast) toast.success('Link copied to clipboard');
        }).catch(err => {
            if (toast) toast.error('Failed to copy link');
        });
    }

    function cleanProjectName(projectName) {
        if (!projectName) return '';
        const underscoreIndex = projectName.indexOf('_');
        return underscoreIndex !== -1 ? projectName.substring(underscoreIndex + 1) : projectName;
    }

    return {
        renderCharts, fetchAndRenderChart, updateOrder, deleteChart, copyMetricLink, cleanProjectName
    };
})());