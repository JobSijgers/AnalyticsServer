/**
 * Chart Widget UI Component
 * Handles the creation and rendering of chart widget elements.
 */
KnuckleHUB.register('ChartWidget', (function() {
    'use strict';

    function createSkeleton(config, dashboardVar, readonly = false) {
        const chartElement = document.createElement('div');
        let sizeClass = 'chart-widget';
        let chartHeight = '300px';

        if (config.widgetSize === 'small' || config.chartType === 'NumberCard' || config.chartType === 'AverageNumberCard') {
            sizeClass = 'chart-widget small';
            chartHeight = '150px';
        } else if (config.widgetSize === 'large') {
            sizeClass = 'chart-widget large';
            chartHeight = '400px';
        }

        if (readonly) sizeClass += ' readonly';

        chartElement.className = sizeClass;
        chartElement.setAttribute('data-chart-id', config.id);
        chartElement.style.position = 'relative';
        chartElement.innerHTML = _getSkeletonHTML(config, chartHeight, dashboardVar, readonly);

        return chartElement;
    }

    function _getSkeletonHTML(config, chartHeight, dashboardVar, readonly = false) {
        let actionsHtml = '';
        let copyIcon = '';

        if (!readonly && dashboardVar) {
            // --- Sort Button Logic (Bar Charts Only) ---
            let sortButtonHtml = '';
            if (config.chartType === 'BarChart') {
                const sortMenuId = `sort-menu-${config.id}`;
                let sortLabel = 'Sort ▾';
                if (config.sortOrder === 'highest') sortLabel = 'High ⬇';
                if (config.sortOrder === 'alpha') sortLabel = 'A-Z ⬇';

                sortButtonHtml = `
                    <div style="position: relative; display: inline-block; margin-right: 4px;">
                        <button class="table-action" onclick="${dashboardVar}.toggleSortMenu(event, '${config.id}')" title="Sort Order">
                            ${sortLabel}
                        </button>
                        <div id="${sortMenuId}" class="sort-menu-dropdown hidden" style="position: absolute; top: 100%; right: 0; background: #2a2a2a; border: 1px solid #444; border-radius: 4px; z-index: 100; min-width: 140px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); overflow: hidden;">
                            <div onclick="${dashboardVar}.applySort('${config.id}', 'highest')" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #333; font-size: 13px; color: #eee; text-align: left;" onmouseover="this.style.backgroundColor='#3a3a3a'" onmouseout="this.style.backgroundColor='transparent'">
                                📊 Highest First
                            </div>
                            <div onclick="${dashboardVar}.applySort('${config.id}', 'alpha')" style="padding: 8px 12px; cursor: pointer; font-size: 13px; color: #eee; text-align: left;" onmouseover="this.style.backgroundColor='#3a3a3a'" onmouseout="this.style.backgroundColor='transparent'">
                                🔤 Alphabetical
                            </div>
                        </div>
                    </div>
                `;
            }

            const editButton = `<button class="table-action" onclick="${dashboardVar}.editChart('${config.id}')">Edit</button>`;
            const deleteButton = `<button class="table-action delete" onclick="${dashboardVar}.deleteChart('${config.id}')">Delete</button>`;

            actionsHtml = `<div class="chart-widget-actions" style="display: flex; align-items: center;">${sortButtonHtml}${editButton}${deleteButton}</div>`;

            if (config.chartType === 'NumberCard' || config.chartType === 'AverageNumberCard') {
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

    function update(element, config, dashboardVar, readonly = false) {
        const temp = createSkeleton(config, dashboardVar, readonly);
        element.innerHTML = temp.innerHTML;
        element.className = temp.className;
        element.setAttribute('data-chart-id', config.id);
    }

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
        if (!inserted) container.appendChild(element);
    }

    function showLoading(configId) {
        const loadingEl = document.getElementById(`loading-${configId}`);
        if (loadingEl) loadingEl.style.display = 'flex';
        const canvas = document.getElementById(`chart-${configId}`);
        if (canvas) canvas.classList.add('hidden-canvas');
    }

    function hideLoading(configId) {
        const loadingEl = document.getElementById(`loading-${configId}`);
        if (loadingEl) loadingEl.remove();
        const canvas = document.getElementById(`chart-${configId}`);
        if (canvas) canvas.classList.remove('hidden-canvas');
    }

    function updateSize(element, config, chartData) {
        element.classList.remove('small', 'large');
        if (config.widgetSize === 'small') element.classList.add('small');
        else if (config.widgetSize === 'large') element.classList.add('large');
    }

    function remove(configId) {
        const chartRenderer = KnuckleHUB.get('ChartRenderer');
        if (chartRenderer) chartRenderer.clearCanvas(`chart-${configId}`);
        const element = document.querySelector(`.chart-widget[data-chart-id="${configId}"]`);
        if (element) element.remove();
    }

    return { createSkeleton, update, insertInOrder, showLoading, hideLoading, updateSize, remove };
})());