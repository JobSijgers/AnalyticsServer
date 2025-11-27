class ConfigManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.editingChartId = null;
        this.dragDropManager = new DragDropManager(dashboard, this.saveChartOrder.bind(this));
        this.currentEventProperties = [];
        this.initializeModalEvents();
    }

    initializeModalEvents() {
        const closeBtn = document.getElementById('config-modal-close');
        if (closeBtn) closeBtn.addEventListener('click', () => this.hideConfigModal());
        const cancelBtn = document.getElementById('config-cancel-btn');
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.hideConfigModal());
        const form = document.getElementById('chart-config-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveChartConfig();
            });
        }
        const eventKeySelect = document.getElementById('config-event-key');
        if (eventKeySelect) {
            eventKeySelect.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.loadPropertiesForEvent(e.target.value).then(() => this.updateAllFilterDropdowns());
                }
                this.updatePreview();
            });
        }
        document.getElementById('config-property')?.addEventListener('change', () => this.updatePreview());
        document.getElementById('config-chart-type')?.addEventListener('change', () => this.updatePreview());
        const addFilterBtn = document.getElementById('add-filter-btn');
        if (addFilterBtn) {
            addFilterBtn.addEventListener('click', () => {
                this.addFilterRow();
                this.updateJsonFromUI();
            });
        }
    }

    async renderConfiguredCharts() {
        const containerId = this.dashboard.isGlobal ? 'global-charts-grid' : 'charts-grid';
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';
        const configs = this.dashboard.chartConfigs || this.dashboard.globalConfigs || [];
        const sortedConfigs = [...configs].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
        const promises = [];
        for (const config of sortedConfigs) {
            const el = this.createChartSkeleton(container, config);
            promises.push(this.fetchAndRenderChart(el, config));
        }
        if (this.dragDropManager) this.dragDropManager.setupDragAndDrop(container);
        await Promise.allSettled(promises);
    }

    showConfigModal() {
        const modal = document.getElementById('config-modal');
        if (!modal) return;
        modal.classList.remove('hidden');
        const typeSelect = document.getElementById('config-chart-type');
        if (typeSelect) {
            const chartTypes = [
                { value: 'LineChart', label: 'Line Chart' },
                { value: 'BarChart', label: 'Bar Chart' },
                { value: 'StackedBarChart', label: 'Stacked Bar Chart' },
                { value: 'PieChart', label: 'Pie Chart' },
                { value: 'NumberCard', label: 'Number Card' }
            ];
            const currentSelection = typeSelect.value;
            typeSelect.innerHTML = '<option value="">Select Chart Type</option>';
            chartTypes.forEach(type => {
                const opt = document.createElement('option');
                opt.value = type.value;
                opt.textContent = type.label;
                typeSelect.appendChild(opt);
            });
            if (currentSelection) {
                typeSelect.value = currentSelection;
            }
        }
        const isGlobal = this.dashboard.isGlobal === true;
        const propertyInput = document.getElementById('config-property');
        const filterColumn = document.getElementById('filter-config-column');
        if (propertyInput && propertyInput.parentElement && propertyInput.parentElement.classList.contains('form-group')) {
            propertyInput.parentElement.style.display = 'block';
        }
        if (filterColumn) {
            filterColumn.style.display = 'flex';
        }
        const title = document.querySelector('.modal-header h3');
        if (title) title.textContent = isGlobal ? "Add Comparison Chart" : "Configure Chart";
        const targetProjectId = isGlobal ? "GLOBAL" : this.dashboard.currentProject;
        this.loadEventKeysForConfig(targetProjectId);
        const form = document.getElementById('chart-config-form');
        if(form) form.reset();
        if (document.getElementById('config-filters-json')) document.getElementById('config-filters-json').value = '';
        if (document.getElementById('filter-rows-container')) document.getElementById('filter-rows-container').innerHTML = '';
        if (this.editingChartId === null) {
            const saveBtn = document.getElementById('config-save-btn');
            if (saveBtn) saveBtn.textContent = 'Save Chart';
        }
        this.dashboard.chartManager.clearCanvas('preview-chart-canvas');
        const previewInfo = document.getElementById('preview-info');
        if (previewInfo) previewInfo.textContent = 'Select an Event Key to see preview.';
    }

    hideConfigModal() {
        const modal = document.getElementById('config-modal');
        if (modal) modal.classList.add('hidden');
        this.editingChartId = null;
        this.currentEventProperties = [];
    }

    async loadEventKeysForConfig(targetProjectId) {
        try {
            const response = await tokenManager.authenticatedFetch(
                `${this.dashboard.baseUrl}/events/keys?projectId=${encodeURIComponent(targetProjectId)}`
            );
            if (response.ok) {
                const data = await response.json();
                const eventKeySelect = document.getElementById('config-event-key');
                if (!eventKeySelect) return;
                const selectedKey = eventKeySelect.value;
                eventKeySelect.innerHTML = '<option value="">Select Event Key</option>';
                if (data.success && data.data && data.data.eventKeys) {
                    data.data.eventKeys.forEach(key => {
                        const option = document.createElement('option');
                        option.value = key;
                        option.textContent = key;
                        eventKeySelect.appendChild(option);
                    });
                    if (selectedKey) eventKeySelect.value = selectedKey;
                }
            }
        } catch (error) {
            console.error(error);
        }
    }

    async loadPropertiesForEvent(eventKey) {
        const targetProjectId = this.dashboard.isGlobal ? "GLOBAL" : this.dashboard.currentProject;
        try {
            const response = await tokenManager.authenticatedFetch(
                `${this.dashboard.baseUrl}/events/properties?projectId=${encodeURIComponent(targetProjectId)}&eventKey=${encodeURIComponent(eventKey)}`
            );
            if (response.ok) {
                const data = await response.json();
                const propertySelect = document.getElementById('config-property');
                if (!propertySelect) return;
                const selectedProperty = propertySelect.value;
                propertySelect.innerHTML = '<option value="">Event Count (default)</option>';
                this.currentEventProperties = [];
                if (data.success && data.data && data.data.propertyKeys) {
                    this.currentEventProperties = data.data.propertyKeys;
                    data.data.propertyKeys.forEach(key => {
                        const option = document.createElement('option');
                        option.value = key;
                        option.textContent = key;
                        propertySelect.appendChild(option);
                    });
                    if (selectedProperty) propertySelect.value = selectedProperty;
                }
            }
        } catch (error) {
            console.error(error);
        }
    }

    async saveChartConfig() {
        const isNewConfig = this.editingChartId === null;
        let configId = this.editingChartId;
        const isGlobal = this.dashboard.isGlobal === true;
        const configsArray = this.dashboard.chartConfigs;
        try {
            const formData = {
                id: configId,
                projectId: isGlobal ? "GLOBAL" : this.dashboard.currentProject,
                eventKey: document.getElementById('config-event-key').value,
                displayName: document.getElementById('config-display-name').value,
                chartType: document.getElementById('config-chart-type').value,
                propertyToDisplay: document.getElementById('config-property')?.value || '',
                filtersJson: document.getElementById('config-filters-json')?.value || '',
                displayOrder: isNewConfig ? (configsArray ? configsArray.length : 0) : configsArray.find(c => c.id === configId)?.displayOrder || 0,
                isEnabled: true
            };
            const response = await tokenManager.authenticatedFetch(`${this.dashboard.baseUrl}/event-config/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    configId = data.data.configId;
                    formData.id = configId;
                    toastManager.success(`Chart configuration ${isNewConfig ? 'saved' : 'updated'}!`);
                    this.hideConfigModal();
                    if (isNewConfig) {
                        this.dashboard.chartConfigs.push(formData);
                    } else {
                        const existingIndex = this.dashboard.chartConfigs.findIndex(c => c.id === configId);
                        if (existingIndex > -1) this.dashboard.chartConfigs[existingIndex] = formData;
                    }
                    this.dashboard.chartConfigs.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
                    if (isGlobal) {
                        await this.renderConfiguredCharts();
                    } else {
                        await this.fetchAndRenderSingleChart(configId, isNewConfig);
                    }
                    if (this.dashboard.uiManager && this.dashboard.uiManager.updateDashboardState) {
                        this.dashboard.uiManager.updateDashboardState();
                    }
                    this.editingChartId = null;
                }
            }
        } catch (error) {
            console.error(error);
            toastManager.error('Failed to save chart configuration');
        }
    }

    async deleteChart(configId) {
        if (confirm('Are you sure you want to delete this chart?')) {
            const isGlobal = this.dashboard.isGlobal === true;
            try {
                const response = await tokenManager.authenticatedFetch(`${this.dashboard.baseUrl}/event-config/delete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: configId, projectId: isGlobal ? "GLOBAL" : this.dashboard.currentProject })
                });
                if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                        toastManager.success('Chart deleted!');
                        this.dashboard.chartConfigs = this.dashboard.chartConfigs.filter(c => c.id !== configId);
                        const chartElement = document.querySelector(`.chart-widget[data-chart-id="${configId}"]`);
                        if (chartElement) { this.dashboard.chartManager.clearCanvas(`chart-${configId}`); chartElement.remove(); }
                        await this.saveChartOrder();
                        if (this.dashboard.uiManager && this.dashboard.uiManager.updateDashboardState) this.dashboard.uiManager.updateDashboardState();
                    }
                }
            } catch (error) { toastManager.error('Failed to delete chart'); }
        }
    }

    async saveChartOrder() {
        try {
            const sortedConfigs = [...this.dashboard.chartConfigs].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
            const orders = sortedConfigs.map((config, index) => ({ id: config.id, displayOrder: index }));
            const isGlobal = this.dashboard.isGlobal === true;
            await tokenManager.authenticatedFetch(`${this.dashboard.baseUrl}/event-config/update-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: isGlobal ? "GLOBAL" : this.dashboard.currentProject, orders: orders })
            });
        } catch (error) { console.error(error); }
    }

    async fetchAndRenderSingleChart(configId, isNew = false) {
        const config = this.dashboard.chartConfigs.find(c => c.id === configId);
        if (!config) return;
        const containerId = this.dashboard.isGlobal ? 'global-charts-grid' : 'charts-grid';
        const container = document.getElementById(containerId);
        if (!container) return;
        let chartElement;
        if (!isNew) chartElement = document.querySelector(`.chart-widget[data-chart-id="${configId}"]`);
        if (!chartElement) {
            chartElement = this.createChartSkeleton(container, config);
        } else {
            const chartHeight = config.chartType === 'NumberCard' ? '150px' : '300px';
            chartElement.className = config.chartType === 'NumberCard' ? 'chart-widget small' : 'chart-widget';
            chartElement.setAttribute('data-chart-id', config.id);
            // Ensure relative positioning for the icon
            chartElement.style.position = 'relative';
            chartElement.innerHTML = this.getSkeletonHTML(config, chartHeight);
            this.insertInOrder(container, chartElement, config);
        }
        if (this.dragDropManager) this.dragDropManager.setupDragAndDrop(container);
        await this.fetchAndRenderChart(chartElement, config);
    }

    getSkeletonHTML(config, chartHeight) {
        const dashboardVar = this.dashboard.isGlobal ? 'globalDashboard' : 'propertiesDashboard';
        const editButton = `<button class="table-action" onclick="${dashboardVar}.configManager.editChart('${config.id}')">Edit</button>`;

        let copyIcon = '';
        if (config.chartType === 'NumberCard') {
            const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
            // Barely visible (opacity 0.1) until hovered
            const btnStyle = "position: absolute; bottom: 5px; right: 5px; opacity: 0.1; transition: opacity 0.2s; background: none; border: none; color: #fff; cursor: pointer; padding: 5px; z-index: 20;";
            const onHover = "this.style.opacity='1'";
            const onLeave = "this.style.opacity='0.1'";

            copyIcon = `<button onclick="${dashboardVar}.copyMetricLink('${config.id}')" style="${btnStyle}" onmouseenter="${onHover}" onmouseleave="${onLeave}" title="Copy API Link">${svgIcon}</button>`;
        }

        return `<div class="chart-widget-header"><h4>${config.displayName || config.eventKey}</h4><div class="chart-widget-actions">${editButton}<button class="table-action delete" onclick="${dashboardVar}.configManager.deleteChart('${config.id}')">Delete</button></div></div><div class="chart-container" style="height: ${chartHeight};"><div id="loading-${config.id}" class="loading-spinner-container"><div class="loading-spinner"></div></div><canvas id="chart-${config.id}" class="hidden-canvas"></canvas></div>${copyIcon}`;
    }

    createChartSkeleton(container, config) {
        const chartElement = document.createElement('div');
        let sizeClass = 'chart-widget';
        let chartHeight = '300px';
        if (config.chartType === 'NumberCard') { sizeClass = 'chart-widget small'; chartHeight = '150px'; }
        chartElement.className = sizeClass;
        chartElement.setAttribute('data-chart-id', config.id);
        chartElement.style.position = 'relative'; // Important for absolute positioning of the icon
        chartElement.innerHTML = this.getSkeletonHTML(config, chartHeight);
        this.insertInOrder(container, chartElement, config);
        return chartElement;
    }

    insertInOrder(container, element, config) {
        let inserted = false;
        for (let i = 0; i < container.children.length; i++) {
            const childId = container.children[i].getAttribute('data-chart-id');
            const childConfig = this.dashboard.chartConfigs.find(c => c.id === childId);
            if (childConfig && (childConfig.displayOrder || 0) > (config.displayOrder || 0)) {
                container.insertBefore(element, container.children[i]);
                inserted = true;
                break;
            }
        }
        if (!inserted) container.appendChild(element);
    }

    async fetchAndRenderChart(chartElement, config) {
        const chartId = `chart-${config.id}`;
        const canvas = document.getElementById(chartId);
        let hasCachedData = false;

        const cachedData = await this.loadChartData(config, true);

        if (cachedData) {
            hasCachedData = true;
            const loadingContainer = document.getElementById(`loading-${config.id}`);
            if (loadingContainer) loadingContainer.remove();

            const dataCount = cachedData.data?.length || 0;
            if ((config.chartType === 'BarChart' || config.chartType === 'LineChart' || config.chartType === 'StackedBarChart') && dataCount > 10) {
                chartElement.classList.add('large');
            }

            this.dashboard.chartManager.renderChart(chartId, cachedData, config.chartType, config);
            if (canvas) canvas.classList.remove('hidden');
        }

        if (canvas && !hasCachedData) canvas.classList.add('hidden');

        try {
            const freshData = await this.loadChartData(config, false);

            const loadingContainer = document.getElementById(`loading-${config.id}`);
            if (loadingContainer) loadingContainer.remove();

            if (freshData) {
                const dataCount = freshData.data?.length || 0;
                if ((config.chartType === 'BarChart' || config.chartType === 'LineChart' || config.chartType === 'StackedBarChart') && dataCount > 10) {
                    chartElement.classList.add('large');
                } else if (config.chartType !== 'NumberCard') {
                    chartElement.classList.remove('large');
                }
                this.dashboard.chartManager.renderChart(chartId, freshData, config.chartType, config);
                if (canvas) canvas.classList.remove('hidden');
            }
        } catch (error) {
            const loadingContainer = document.getElementById(`loading-${config.id}`);
            if (loadingContainer) loadingContainer.remove();
            console.error(error);
        }
    }

    async loadChartData(config, useCache) {
        const isGlobal = this.dashboard.isGlobal === true;
        const days = document.getElementById('date-range')?.value || '30';
        try {
            const queryParams = new URLSearchParams({
                projectId: isGlobal ? "GLOBAL" : this.dashboard.currentProject,
                eventKey: config.eventKey,
                propertyName: config.propertyToDisplay || '',
                chartType: config.chartType,
                days: days,
                filtersJson: config.filtersJson || '',
                configId: config.id || '',
                useCache: useCache ? 'true' : 'false'
            });
            const url = `${this.dashboard.baseUrl}/dashboard/custom-chart?${queryParams}`;
            const response = await tokenManager.authenticatedFetch(url);
            if (response.ok) {
                if (response.status === 204) return null;
                const data = await response.json();
                if (data.success && data.data) return data.data.chartData;
            }
        } catch (error) { console.error(error); }
        return null;
    }

    editChart(configId) {
        const config = this.dashboard.chartConfigs.find(c => c.id === configId);
        if (config) {
            this.editingChartId = configId;
            this.showConfigModal();
            document.getElementById('config-display-name').value = config.displayName;
            document.getElementById('config-chart-type').value = config.chartType;
            if (document.getElementById('config-save-btn')) document.getElementById('config-save-btn').textContent = 'Update Chart';
            setTimeout(() => {
                const keySelect = document.getElementById('config-event-key');
                if (keySelect) keySelect.value = config.eventKey;
                this.loadPropertiesForEvent(config.eventKey).then(() => {
                    const propSelect = document.getElementById('config-property');
                    if (propSelect) propSelect.value = config.propertyToDisplay || '';
                    this.rebuildUIFromJson(config.filtersJson);
                    this.updatePreview();
                });
            }, 50);
        }
    }

    async updatePreview() {
        const eventKey = document.getElementById('config-event-key')?.value;
        const chartType = document.getElementById('config-chart-type')?.value;
        const previewInfo = document.getElementById('preview-info');
        if (!eventKey || !chartType) {
            if(previewInfo) previewInfo.textContent = 'Select settings to preview.';
            this.dashboard.chartManager.clearCanvas('preview-chart-canvas');
            return;
        }
        if(previewInfo) previewInfo.textContent = 'Loading preview...';
        this.dashboard.chartManager.clearCanvas('preview-chart-canvas');
        const isGlobal = this.dashboard.isGlobal === true;
        const tempConfig = {
            eventKey: eventKey,
            propertyToDisplay: document.getElementById('config-property')?.value || '',
            chartType: chartType,
            displayName: 'Preview',
            filtersJson: document.getElementById('config-filters-json')?.value || ''
        };
        const chartData = await this.loadChartData(tempConfig, false);
        if (chartData) {
            this.dashboard.chartManager.renderChart('preview-chart-canvas', chartData, chartType, tempConfig);
            if(previewInfo) previewInfo.textContent = `Preview: ${eventKey}`;
        } else {
            if(previewInfo) previewInfo.textContent = 'No data available for preview.';
        }
    }

    addFilterRow(data = null) {
        const container = document.getElementById('filter-rows-container');
        if(!container) return;
        const row = document.createElement('div');
        row.className = 'filter-row';
        const propSelect = document.createElement('select');
        propSelect.className = 'filter-prop';
        propSelect.innerHTML = '<option value="">Property...</option>';
        this.currentEventProperties.forEach(prop => {
            const opt = document.createElement('option');
            opt.value = prop;
            opt.textContent = prop;
            propSelect.appendChild(opt);
        });
        if (data && data.property) propSelect.value = data.property;
        const opSelect = document.createElement('select');
        opSelect.className = 'filter-op';
        ['=', '!=', '>', '<', '>=', '<='].forEach(op => {
            const opt = document.createElement('option');
            opt.value = op;
            opt.textContent = op;
            opSelect.appendChild(opt);
        });
        if (data && data.operator) opSelect.value = data.operator;
        const valInput = document.createElement('input');
        valInput.className = 'filter-val';
        valInput.type = 'text';
        valInput.placeholder = 'Value';
        if (data && data.value !== undefined) valInput.value = data.value;
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-filter-btn';
        removeBtn.innerHTML = '&times;';
        removeBtn.onclick = () => { row.remove(); this.updateJsonFromUI(); this.updatePreview(); };
        [propSelect, opSelect, valInput].forEach(el => el.addEventListener('change', () => { this.updateJsonFromUI(); this.updatePreview(); }));
        row.appendChild(propSelect);
        row.appendChild(opSelect);
        row.appendChild(valInput);
        row.appendChild(removeBtn);
        container.appendChild(row);
    }

    updateAllFilterDropdowns() {
        const dropdowns = document.querySelectorAll('.filter-prop');
        dropdowns.forEach(dd => {
            const currentVal = dd.value;
            dd.innerHTML = '<option value="">Property...</option>';
            this.currentEventProperties.forEach(prop => {
                const opt = document.createElement('option');
                opt.value = prop;
                opt.textContent = prop;
                dd.appendChild(opt);
            });
            dd.value = currentVal;
        });
    }

    updateJsonFromUI() {
        const rows = document.querySelectorAll('.filter-row');
        const filters = [];
        rows.forEach(row => {
            const prop = row.querySelector('.filter-prop').value;
            const op = row.querySelector('.filter-op').value;
            let val = row.querySelector('.filter-val').value;
            if (prop && op && val !== '') {
                if (val.toLowerCase() === 'true') val = true;
                else if (val.toLowerCase() === 'false') val = false;
                else if (!isNaN(val) && val.trim() !== '') val = Number(val);
                filters.push({ property: prop, operator: op, value: val });
            }
        });
        const json = filters.length > 0 ? JSON.stringify(filters) : '';
        const input = document.getElementById('config-filters-json');
        if(input) input.value = json;
    }

    rebuildUIFromJson(jsonString) {
        const container = document.getElementById('filter-rows-container');
        if (container) container.innerHTML = '';
        if (!jsonString) return;
        try {
            const filters = JSON.parse(jsonString);
            if (Array.isArray(filters)) filters.forEach(f => this.addFilterRow(f));
        } catch (e) {}
    }
}