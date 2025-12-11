/**
 * Chart Widget UI Component
 * Handles the creation and rendering of chart widget elements.
 */
KnuckleHUB.register('ChartWidget', (function() {
    'use strict';

    /**
     * Create a chart widget skeleton element
     * @param {Object} config - Chart configuration
     * @param {string} dashboardVar - Dashboard variable name for onclick handlers
     * @param {boolean} readonly - Whether to create in readonly mode
     * @returns {HTMLElement}
     */
    function createSkeleton(config, dashboardVar, readonly = false) {
        const chartElement = document.createElement('div');
        let sizeClass = 'chart-widget';
        let chartHeight = '300px'; // Default normal height

        // Determine size based on widgetSize and chart type
        if (config.widgetSize === 'small' || config.chartType === 'NumberCard') {
            sizeClass = 'chart-widget small';
            chartHeight = '150px';
        } else if (config.widgetSize === 'large') {
            sizeClass = 'chart-widget large';
            chartHeight = '400px';
        } else {
            // normal size
            sizeClass = 'chart-widget';
            chartHeight = '300px';
        }

        if (readonly) {
            sizeClass += ' readonly';
        }

        chartElement.className = sizeClass;
        chartElement.setAttribute('data-chart-id', config.id);
        chartElement.style.position = 'relative';
        chartElement.innerHTML = _getSkeletonHTML(config, chartHeight, dashboardVar, readonly);

        return chartElement;
    }

    /**
     * Get skeleton HTML for a chart widget
     * @param {Object} config - Chart configuration
     * @param {string} chartHeight - Height of the chart
     * @param {string} dashboardVar - Dashboard variable name for onclick handlers
     * @param {boolean} readonly - Readonly mode
     * @returns {string}
     * @private
     */
    function _getSkeletonHTML(config, chartHeight, dashboardVar, readonly = false) {
        let actionsHtml = '';
        let copyIcon = '';

        if (!readonly && dashboardVar) {
            const editButton = `<button class="table-action" onclick="${dashboardVar}.editChart('${config.id}')">Edit</button>`;
            const deleteButton = `<button class="table-action delete" onclick="${dashboardVar}.deleteChart('${config.id}')">Delete</button>`;
            actionsHtml = `<div class="chart-widget-actions">${editButton}${deleteButton}</div>`;

            if (config.chartType === 'NumberCard') {
                const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
                const btnStyle = "position: absolute; bottom: 5px; right: 5px; opacity: 0.1; transition: opacity 0.2s; background: none; border: none; color: #fff; cursor: pointer; padding: 5px; z-index: 20;";
                const onHover = "this.style.opacity='1'";
                const onLeave = "this.style.opacity='0.1'";
                copyIcon = `<button onclick="${dashboardVar}.copyMetricLink('${config.id}')" style="${btnStyle}" onmouseenter="${onHover}" onmouseleave="${onLeave}" title="Copy API Link">${svgIcon}</button>`;
            }
        }

        return `
            <div class="chart-widget-header">
                <h4>${config.displayName || config.eventKey}</h4>
                ${actionsHtml}
            </div>
            <div class="chart-container" style="height: ${chartHeight};">
                <div id="loading-${config.id}" class="loading-spinner-container">
                    <div class="loading-spinner"></div>
                </div>
                <canvas id="chart-${config.id}" class="hidden-canvas"></canvas>
            </div>
            ${copyIcon}
        `;
    }

    /**
     * Update an existing chart widget
     * @param {HTMLElement} element - Existing widget element
     * @param {Object} config - Chart configuration
     * @param {string} dashboardVar - Dashboard variable name
     * @param {boolean} readonly - Readonly mode
     */
    function update(element, config, dashboardVar, readonly = false) {
        // Determine chart height based on saved widget size
        let chartHeight = '300px'; // Default normal
        if (config.widgetSize === 'small' || config.chartType === 'NumberCard') {
            chartHeight = '150px';
        } else if (config.widgetSize === 'large') {
            chartHeight = '400px';
        }

        let className = 'chart-widget';
        if (config.widgetSize === 'small' || config.chartType === 'NumberCard') {
            className = 'chart-widget small';
        } else if (config.widgetSize === 'large') {
            className = 'chart-widget large';
        }

        if (readonly) className += ' readonly';

        element.className = className;
        element.setAttribute('data-chart-id', config.id);
        element.style.position = 'relative';
        element.innerHTML = _getSkeletonHTML(config, chartHeight, dashboardVar, readonly);
    }

    /**
     * Insert widget in display order
     * @param {HTMLElement} container - Container element
     * @param {HTMLElement} element - Widget element
     * @param {Object} config - Chart configuration
     * @param {Array} allConfigs - All chart configurations
     */
    function insertInOrder(container, element, config, allConfigs) {
        let inserted = false;

        for (let i = 0; i < container.children.length; i++) {
            const childId = container.children[i].getAttribute('data-chart-id');
            const childConfig = allConfigs.find(c => c.id === childId);

            if (childConfig && (childConfig.displayOrder || 0) > (config.displayOrder || 0)) {
                container.insertBefore(element, container.children[i]);
                inserted = true;
                break;
            }
        }

        if (!inserted) {
            container.appendChild(element);
        }
    }

    /**
     * Show loading state for a chart
     * @param {string} configId - Configuration ID
     */
    function showLoading(configId) {
        const loadingEl = document.getElementById(`loading-${configId}`);
        if (loadingEl) {
            loadingEl.style.display = 'flex';
        }

        const canvas = document.getElementById(`chart-${configId}`);
        if (canvas) {
            canvas.classList.add('hidden-canvas');
        }
    }

    /**
     * Hide loading state for a chart
     * @param {string} configId - Configuration ID
     */
    function hideLoading(configId) {
        const loadingEl = document.getElementById(`loading-${configId}`);
        if (loadingEl) {
            loadingEl.remove();
        }

        const canvas = document.getElementById(`chart-${configId}`);
        if (canvas) {
            canvas.classList.remove('hidden-canvas');
        }
    }

    /**
     * Update widget size based on saved preference
     * @param {HTMLElement} element - Widget element
     * @param {Object} config - Chart configuration
     * @param {Object} chartData - Chart data
     */
    function updateSize(element, config, chartData) {
        // Remove any existing size classes
        element.classList.remove('small', 'large');

        // Add the saved size class
        if (config.widgetSize === 'small') {
            element.classList.add('small');
        } else if (config.widgetSize === 'large') {
            element.classList.add('large');
        }
        // If normal, no additional class needed (uses default)
    }

    /**
     * Remove a chart widget
     * @param {string} configId - Configuration ID
     */
    function remove(configId) {
        const chartRenderer = KnuckleHUB.get('ChartRenderer');
        if (chartRenderer) {
            chartRenderer.clearCanvas(`chart-${configId}`);
        }

        const element = document.querySelector(`.chart-widget[data-chart-id="${configId}"]`);
        if (element) {
            element.remove();
        }
    }

    // Public API
    return {
        createSkeleton,
        update,
        insertInOrder,
        showLoading,
        hideLoading,
        updateSize,
        remove
    };
})());