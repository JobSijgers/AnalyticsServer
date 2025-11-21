class ConfigManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.editingChartId = null;
        this.dragDropManager = new DragDropManager(dashboard, this.saveChartOrder.bind(this));

        // Store available properties for the current event to populate dropdowns
        this.currentEventProperties = [];

        this.initializeModalEvents();
    }

    initializeModalEvents() {
        document.getElementById('config-modal-close').addEventListener('click', () => this.hideConfigModal());
        document.getElementById('config-cancel-btn').addEventListener('click', () => this.hideConfigModal());

        document.getElementById('chart-config-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveChartConfig();
        });

        // Event Key Change: Load properties for main dropdown AND filter dropdowns
        document.getElementById('config-event-key').addEventListener('change', (e) => {
            if (e.target.value) {
                this.loadPropertiesForEvent(e.target.value).then(() => {
                    // Update all existing filter rows with new properties
                    this.updateAllFilterDropdowns();
                });
            }
            this.updatePreview();
        });

        document.getElementById('config-property').addEventListener('change', () => this.updatePreview());
        document.getElementById('config-chart-type').addEventListener('change', () => this.updatePreview());

        // Add Filter Button
        document.getElementById('add-filter-btn').addEventListener('click', () => {
            this.addFilterRow(); // Add empty row
            this.updateJsonFromUI(); // Update hidden JSON
        });
    }

    // --- Filter UI Logic ---

    addFilterRow(data = null) {
        const container = document.getElementById('filter-rows-container');
        const row = document.createElement('div');
        row.className = 'filter-row';

        // 1. Property Select
        const propSelect = document.createElement('select');
        propSelect.className = 'filter-prop';
        propSelect.innerHTML = '<option value="">Property...</option>';

        // Populate with cached properties
        this.currentEventProperties.forEach(prop => {
            const opt = document.createElement('option');
            opt.value = prop;
            opt.textContent = prop;
            propSelect.appendChild(opt);
        });

        if (data && data.property) propSelect.value = data.property;

        // 2. Operator Select
        const opSelect = document.createElement('select');
        opSelect.className = 'filter-op';
        const ops = ['=', '!=', '>', '<', '>=', '<='];
        ops.forEach(op => {
            const opt = document.createElement('option');
            opt.value = op;
            opt.textContent = op;
            opSelect.appendChild(opt);
        });
        if (data && data.operator) opSelect.value = data.operator;

        // 3. Value Input
        const valInput = document.createElement('input');
        valInput.className = 'filter-val';
        valInput.type = 'text';
        valInput.placeholder = 'Value';
        // Handle boolean/number values correctly for display
        if (data && data.value !== undefined) valInput.value = data.value;

        // 4. Remove Button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-filter-btn';
        removeBtn.innerHTML = '&times;';
        removeBtn.onclick = () => {
            row.remove();
            this.updateJsonFromUI();
            this.updatePreview();
        };

        // Listeners to update JSON on change
        [propSelect, opSelect, valInput].forEach(el => {
            el.addEventListener('change', () => {
                this.updateJsonFromUI();
                this.updatePreview();
            });
        });

        row.appendChild(propSelect);
        row.appendChild(opSelect);
        row.appendChild(valInput);
        row.appendChild(removeBtn);

        container.appendChild(row);
    }

    updateAllFilterDropdowns() {
        // When event changes, update all existing filter rows to have the new property options
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
            dd.value = currentVal; // Try to keep value if it exists in new list
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
                // Auto-detect types
                if (val.toLowerCase() === 'true') val = true;
                else if (val.toLowerCase() === 'false') val = false;
                else if (!isNaN(val) && val.trim() !== '') val = Number(val);

                filters.push({ property: prop, operator: op, value: val });
            }
        });

        const jsonString = filters.length > 0 ? JSON.stringify(filters) : '';
        document.getElementById('config-filters-json').value = jsonString;
        return jsonString;
    }

    rebuildUIFromJson(jsonString) {
        const container = document.getElementById('filter-rows-container');
        container.innerHTML = ''; // Clear existing

        if (!jsonString) return;

        try {
            const filters = JSON.parse(jsonString);
            if (Array.isArray(filters)) {
                filters.forEach(f => this.addFilterRow(f));
            }
        } catch (e) {
            console.error("Invalid JSON in config", e);
        }
    }

    // --- Existing Methods ---

    showConfigModal() {
        const modal = document.getElementById('config-modal');
        modal.classList.remove('hidden');
        this.loadEventKeysForConfig();

        // Reset form
        document.getElementById('chart-config-form').reset();
        document.getElementById('config-filters-json').value = '';
        document.getElementById('filter-rows-container').innerHTML = ''; // Clear GUI rows

        if (this.editingChartId === null) {
            document.getElementById('config-save-btn').textContent = 'Save Chart';
        }

        this.dashboard.chartManager.clearCanvas('preview-chart-canvas');
        document.getElementById('preview-info').textContent = 'Select an Event Key and Chart Type to see a preview.';
    }

    hideConfigModal() {
        document.getElementById('config-modal').classList.add('hidden');
        this.editingChartId = null;
        this.currentEventProperties = [];
    }

    async loadEventKeysForConfig() {
        try {
            const response = await tokenManager.authenticatedFetch(
                `${this.dashboard.baseUrl}/events/keys?projectId=${encodeURIComponent(this.dashboard.currentProject)}`
            );
            if (response.ok) {
                const data = await response.json();
                const eventKeySelect = document.getElementById('config-event-key');
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
        try {
            const response = await tokenManager.authenticatedFetch(
                `${this.dashboard.baseUrl}/events/properties?projectId=${encodeURIComponent(this.dashboard.currentProject)}&eventKey=${encodeURIComponent(eventKey)}`
            );

            if (response.ok) {
                const data = await response.json();
                const propertySelect = document.getElementById('config-property');
                const selectedProperty = propertySelect.value;

                // Reset Main Property Select
                propertySelect.innerHTML = '<option value="">Event Count (default)</option>';

                // Reset Internal Cache
                this.currentEventProperties = [];

                if (data.success && data.data && data.data.propertyKeys) {
                    this.currentEventProperties = data.data.propertyKeys; // Cache for filters

                    data.data.propertyKeys.forEach(key => {
                        // Add to main select
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

    async loadChartConfigurations() {
        try {
            const response = await tokenManager.authenticatedFetch(
                `${this.dashboard.baseUrl}/event-config?projectId=${encodeURIComponent(this.dashboard.currentProject)}`
            );
            if (response.ok) {
                const data = await response.json();
                this.dashboard.chartConfigs = data.configs || [];
                this.renderConfiguredCharts();
            }
        } catch (error) {
            console.error(error);
        }
    }

    async renderConfiguredCharts() {
        const container = document.getElementById('charts-grid');
        if (!container) return;
        container.innerHTML = '';
        const sortedConfigs = [...this.dashboard.chartConfigs].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
        const promises = [];
        for (const config of sortedConfigs) {
            const el = this.createChartSkeleton(container, config);
            promises.push(this.fetchAndRenderChart(el, config));
        }
        this.dragDropManager.setupDragAndDrop(container);
        await Promise.allSettled(promises);
    }

    async fetchAndRenderSingleChart(configId, isNew = false) {
        const config = this.dashboard.chartConfigs.find(c => c.id === configId);
        if (!config) return;
        const container = document.getElementById('charts-grid');
        let chartElement;
        if (!isNew) chartElement = document.querySelector(`.chart-widget[data-chart-id="${configId}"]`);
        if (!chartElement) {
            chartElement = this.createChartSkeleton(container, config);
        } else {
            const chartHeight = config.chartType === 'NumberCard' ? '150px' : '300px';
            chartElement.className = config.chartType === 'NumberCard' ? 'chart-widget small' : 'chart-widget';
            chartElement.innerHTML = this.getSkeletonHTML(config, chartHeight);

            const sortedConfigs = [...this.dashboard.chartConfigs].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
            const index = sortedConfigs.findIndex(c => c.id === configId);
            const nextConfig = sortedConfigs[index + 1];
            if (nextConfig) {
                const nextElement = document.querySelector(`.chart-widget[data-chart-id="${nextConfig.id}"]`);
                if (nextElement && nextElement !== chartElement) container.insertBefore(chartElement, nextElement);
            } else {
                container.appendChild(chartElement);
            }
        }
        this.dragDropManager.setupDragAndDrop(container);
        await this.fetchAndRenderChart(chartElement, config);
    }

    getSkeletonHTML(config, chartHeight) {
        return `
            <div class="chart-widget-header">
                <h4>${config.displayName || config.eventKey}</h4>
                <div class="chart-widget-actions">
                    <button class="table-action" onclick="propertiesDashboard.configManager.editChart('${config.id}')">Edit</button>
                    <button class="table-action delete" onclick="propertiesDashboard.configManager.deleteChart('${config.id}')">Delete</button>
                </div>
            </div>
            <div class="chart-container" style="height: ${chartHeight};">
                <div id="loading-${config.id}" class="loading-spinner-container">
                    <div class="loading-spinner"></div>
                    <p>Loading data...</p>
                </div>
                <canvas id="chart-${config.id}" class="hidden-canvas"></canvas>
            </div>
            <div class="chart-info">
                <small>Event: ${config.eventKey} | Type: ${config.chartType}${config.propertyToDisplay ? ` | Property: ${config.propertyToDisplay}` : ''}</small>
            </div>
        `;
    }

    createChartSkeleton(container, config) {
        const chartElement = document.createElement('div');
        let sizeClass = 'chart-widget';
        let chartHeight = '300px';
        if (config.chartType === 'NumberCard') {
            sizeClass = 'chart-widget small';
            chartHeight = '150px';
        }
        chartElement.className = sizeClass;
        chartElement.setAttribute('data-chart-id', config.id);
        chartElement.innerHTML = this.getSkeletonHTML(config, chartHeight);

        const sortedConfigs = [...this.dashboard.chartConfigs].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
        const configIndex = sortedConfigs.findIndex(c => c.id === config.id);
        if (configIndex >= 0) {
            let inserted = false;
            for (let i = 0; i < container.children.length; i++) {
                const childId = container.children[i].getAttribute('data-chart-id');
                const childConfig = this.dashboard.chartConfigs.find(c => c.id === childId);
                if (childConfig && (childConfig.displayOrder || 0) > (config.displayOrder || 0)) {
                    container.insertBefore(chartElement, container.children[i]);
                    inserted = true;
                    break;
                }
            }
            if (!inserted) container.appendChild(chartElement);
        } else {
            container.appendChild(chartElement);
        }
        return chartElement;
    }

    async fetchAndRenderChart(chartElement, config) {
        const chartId = `chart-${config.id}`;
        const loadingContainer = document.getElementById(`loading-${config.id}`);
        const canvas = document.getElementById(chartId);
        if (canvas) canvas.classList.add('hidden');

        try {
            const chartData = await this.loadChartData(config);
            if (loadingContainer) loadingContainer.remove();
            const dataCount = chartData?.data?.length || 0;

            if (config.chartType === 'BarChart' || config.chartType === 'LineChart') {
                if (dataCount > 10) chartElement.classList.add('large');
                else chartElement.classList.remove('large');
            } else if (config.chartType !== 'NumberCard') {
                chartElement.classList.remove('large');
            }

            if (chartData) {
                this.dashboard.chartManager.renderChart(chartId, chartData, config.chartType, config);
                if (canvas) canvas.classList.remove('hidden');
            } else {
                this.displayErrorOnCanvas(canvas, 'Data failed to load.');
            }
        } catch (error) {
            console.error(error);
            if (loadingContainer) loadingContainer.remove();
            this.displayErrorOnCanvas(canvas, 'Failed to fetch data.');
        }
    }

    displayErrorOnCanvas(canvas, message) {
        if (canvas) {
            canvas.classList.remove('hidden');
            const ctx = canvas.getContext('2d');
            const width = canvas.width > 0 ? canvas.width : 300;
            const height = canvas.height > 0 ? canvas.height : 300;
            if (canvas.width === 0) canvas.width = width;
            if (canvas.height === 0) canvas.height = height;
            ctx.clearRect(0, 0, width, height);
            ctx.font = '16px Arial';
            ctx.fillStyle = '#f44336';
            ctx.textAlign = 'center';
            ctx.fillText(message, width / 2, height / 2);
        }
    }

    async loadChartData(config) {
        const days = document.getElementById('date-range')?.value || '30';
        try {
            const queryParams = new URLSearchParams({
                projectId: this.dashboard.currentProject,
                eventKey: config.eventKey,
                propertyName: config.propertyToDisplay || '',
                chartType: config.chartType,
                days: days,
                filtersJson: config.filtersJson || ''
            });
            const url = `${this.dashboard.baseUrl}/dashboard/custom-chart?${queryParams}`;
            const response = await tokenManager.authenticatedFetch(url);
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data) return data.data.chartData;
            }
        } catch (error) {
            console.error(error);
        }
        return null;
    }

    async saveChartConfig() {
        const isNewConfig = this.editingChartId === null;
        let configId = this.editingChartId;

        try {
            const formData = {
                id: configId,
                projectId: this.dashboard.currentProject,
                eventKey: document.getElementById('config-event-key').value,
                displayName: document.getElementById('config-display-name').value,
                chartType: document.getElementById('config-chart-type').value,
                propertyToDisplay: document.getElementById('config-property').value,
                filtersJson: document.getElementById('config-filters-json').value,
                displayOrder: isNewConfig ? this.dashboard.chartConfigs.length : this.dashboard.chartConfigs.find(c => c.id === configId)?.displayOrder || 0,
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
                    await this.fetchAndRenderSingleChart(configId, isNewConfig);

                    // --- FIX: UPDATE UI STATE (Switch from Welcome to Grid if this was the first chart) ---
                    if (this.dashboard.uiManager && typeof this.dashboard.uiManager.updateDashboardState === 'function') {
                        this.dashboard.uiManager.updateDashboardState();
                    }

                    this.editingChartId = null;
                }
            } else {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        } catch (error) {
            console.error(error);
            toastManager.error('Failed to save chart configuration');
        }
    }

    editChart(configId) {
        const config = this.dashboard.chartConfigs.find(c => c.id === configId);
        if (config) {
            this.editingChartId = configId;
            this.showConfigModal();

            document.getElementById('config-display-name').value = config.displayName;
            document.getElementById('config-chart-type').value = config.chartType;
            document.getElementById('config-filters-json').value = config.filtersJson || '';
            document.getElementById('config-save-btn').textContent = 'Update Chart';

            setTimeout(() => {
                document.getElementById('config-event-key').value = config.eventKey;
                this.loadPropertiesForEvent(config.eventKey).then(() => {
                    document.getElementById('config-property').value = config.propertyToDisplay || '';
                    this.rebuildUIFromJson(config.filtersJson);
                    this.updatePreview();
                });
            }, 50);
        }
    }

    async deleteChart(configId) {
        if (confirm('Are you sure you want to delete this chart?')) {
            try {
                const response = await tokenManager.authenticatedFetch(`${this.dashboard.baseUrl}/event-config/delete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: configId, projectId: this.dashboard.currentProject })
                });
                if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                        toastManager.success('Chart deleted!');
                        this.dashboard.chartConfigs = this.dashboard.chartConfigs.filter(c => c.id !== configId);
                        const chartElement = document.querySelector(`.chart-widget[data-chart-id="${configId}"]`);
                        if (chartElement) {
                            this.dashboard.chartManager.clearCanvas(`chart-${configId}`);
                            chartElement.remove();
                        }
                        await this.saveChartOrder();

                        // --- FIX: UPDATE UI STATE (Switch to Welcome if no charts left) ---
                        if (this.dashboard.uiManager && typeof this.dashboard.uiManager.updateDashboardState === 'function') {
                            this.dashboard.uiManager.updateDashboardState();
                        }
                    } else {
                        throw new Error(result.message);
                    }
                } else {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
            } catch (error) {
                console.error(error);
                toastManager.error('Failed to delete chart: ' + error.message);
            }
        }
    }

    async saveChartOrder() {
        try {
            const sortedConfigs = [...this.dashboard.chartConfigs].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
            const orders = sortedConfigs.map((config, index) => ({ id: config.id, displayOrder: index }));
            orders.forEach(order => {
                const config = this.dashboard.chartConfigs.find(c => c.id === order.id);
                if (config) config.displayOrder = order.displayOrder;
            });
            const response = await tokenManager.authenticatedFetch(`${this.dashboard.baseUrl}/event-config/update-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: this.dashboard.currentProject, orders: orders })
            });
            if (!response.ok) throw new Error('Failed to save chart order');
        } catch (error) {
            console.error(error);
            toastManager.error('Failed to update chart order');
        }
    }

    async updatePreview() {
        const eventKey = document.getElementById('config-event-key').value;
        const property = document.getElementById('config-property').value;
        const chartType = document.getElementById('config-chart-type').value;
        const displayName = document.getElementById('config-display-name').value;
        const filtersJson = document.getElementById('config-filters-json').value;
        const previewInfo = document.getElementById('preview-info');

        if (!eventKey || !chartType) {
            previewInfo.textContent = 'Select an Event Key and Chart Type to see a preview.';
            this.dashboard.chartManager.clearCanvas('preview-chart-canvas');
            return;
        }

        previewInfo.textContent = 'Loading preview data...';
        this.dashboard.chartManager.clearCanvas('preview-chart-canvas');

        const tempConfig = {
            eventKey: eventKey,
            propertyToDisplay: property,
            chartType: chartType,
            displayName: displayName || 'Preview',
            filtersJson: filtersJson
        };

        const chartData = await this.loadChartData(tempConfig);

        if (chartData) {
            this.dashboard.chartManager.renderChart('preview-chart-canvas', chartData, chartType, tempConfig);
            previewInfo.textContent = `Preview for: ${eventKey} (${chartType})`;
        } else {
            previewInfo.textContent = 'Failed to load preview data or data is empty.';
        }
    }
}