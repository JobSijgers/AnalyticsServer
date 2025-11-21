class ConfigManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.editingChartId = null;
        this.dragDropManager = new DragDropManager(dashboard, this.saveChartOrder.bind(this));
        this.initializeModalEvents();
    }

    initializeModalEvents() {
        document.getElementById('config-modal-close').addEventListener('click', () => {
            this.hideConfigModal();
        });

        document.getElementById('config-cancel-btn').addEventListener('click', () => {
            this.hideConfigModal();
        });

        document.getElementById('chart-config-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveChartConfig();
        });

        document.getElementById('config-event-key').addEventListener('change', (e) => {
            if (e.target.value) {
                this.loadPropertiesForEvent(e.target.value);
            }
            this.updatePreview();
        });

        document.getElementById('config-property').addEventListener('change', () => {
            this.updatePreview();
        });
        document.getElementById('config-chart-type').addEventListener('change', () => {
            this.updatePreview();
        });
    }

    showConfigModal() {
        const modal = document.getElementById('config-modal');
        modal.classList.remove('hidden');
        this.loadEventKeysForConfig();

        document.getElementById('chart-config-form').reset();

        if (this.editingChartId === null) {
            // Display order is no longer set from the input field; drag-drop handles the default/update.
            // document.getElementById('config-display-order').value = this.dashboard.chartConfigs.length;
            document.getElementById('config-save-btn').textContent = 'Save Chart';
        }

        this.dashboard.chartManager.clearCanvas('preview-chart-canvas');
        document.getElementById('preview-info').textContent = 'Select an Event Key and Chart Type to see a preview.';
    }

    hideConfigModal() {
        const modal = document.getElementById('config-modal');
        modal.classList.add('hidden');
        this.editingChartId = null;
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

                    if (selectedKey) {
                        eventKeySelect.value = selectedKey;
                    }
                } else {
                    console.warn('No event keys found in response:', data);
                    toastManager.warning('No event keys available for this project');
                }
            } else {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        } catch (error) {
            console.error('Error loading event keys for config:', error);
            toastManager.error('Failed to load event keys');
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

                propertySelect.innerHTML = '<option value="">Event Count (default)</option>';

                if (data.success && data.data && data.data.propertyKeys) {
                    data.data.propertyKeys.forEach(key => {
                        const option = document.createElement('option');
                        option.value = key;
                        option.textContent = key;
                        propertySelect.appendChild(option);
                    });

                    if (selectedProperty) {
                        propertySelect.value = selectedProperty;
                    }
                }
            } else {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        } catch (error) {
            console.error('Error loading properties for event:', error);
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
            console.error('Error loading chart configs:', error);
        }
    }

    async renderConfiguredCharts() {
        const container = document.getElementById('charts-grid');
        if (!container) return;

        container.innerHTML = '';

        const sortedConfigs = [...this.dashboard.chartConfigs].sort((a, b) =>
            (a.displayOrder || 0) - (b.displayOrder || 0)
        );

        const chartRenderPromises = [];

        for (const config of sortedConfigs) {
            const chartElement = this.createChartSkeleton(container, config);
            chartRenderPromises.push(this.fetchAndRenderChart(chartElement, config));
        }

        this.dragDropManager.setupDragAndDrop(container);

        await Promise.allSettled(chartRenderPromises);
    }

    async fetchAndRenderSingleChart(configId, isNew = false) {
        const config = this.dashboard.chartConfigs.find(c => c.id === configId);
        if (!config) return;

        const container = document.getElementById('charts-grid');
        if (!container) return;

        let chartElement;

        // If updating an existing chart
        if (!isNew) {
            chartElement = document.querySelector(`.chart-widget[data-chart-id="${configId}"]`);
        }

        // If it's a new chart or the element doesn't exist (e.g., initial load)
        if (!chartElement) {
            chartElement = this.createChartSkeleton(container, config);
        } else {
            // For update, just reset the content to show the loading state
            const chartHeight = config.chartType === 'NumberCard' ? '150px' : '300px';
            chartElement.className = config.chartType === 'NumberCard' ? 'chart-widget small' : 'chart-widget';
            chartElement.innerHTML = `
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
            // Ensure the element is in the right place based on displayOrder
            const sortedConfigs = [...this.dashboard.chartConfigs].sort((a, b) =>
                (a.displayOrder || 0) - (b.displayOrder || 0)
            );
            const index = sortedConfigs.findIndex(c => c.id === configId);
            const nextConfig = sortedConfigs[index + 1];

            if (nextConfig) {
                const nextElement = document.querySelector(`.chart-widget[data-chart-id="${nextConfig.id}"]`);
                if (nextElement && nextElement !== chartElement) {
                    container.insertBefore(chartElement, nextElement);
                }
            } else {
                // It's the last element
                container.appendChild(chartElement);
            }
        }

        // Re-setup drag and drop to include the new/updated element
        this.dragDropManager.setupDragAndDrop(container);

        await this.fetchAndRenderChart(chartElement, config);
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
                // Apply 'large' class if there are more than 10 data points
                if (dataCount > 10) {
                    chartElement.classList.add('large');
                } else {
                    chartElement.classList.remove('large');
                }
            }
            // Ensure other chart types are not 'large'
            else if (config.chartType !== 'NumberCard') {
                chartElement.classList.remove('large');
            }

            if (chartData) {
                this.dashboard.chartManager.renderChart(chartId, chartData, config.chartType, config);
                if (canvas) canvas.classList.remove('hidden');
            } else {
                this.displayErrorOnCanvas(canvas, 'Data failed to load.');
            }

        } catch (error) {
            console.error(`Error loading/rendering chart ${config.id}:`, error);
            if (loadingContainer) loadingContainer.remove();
            this.displayErrorOnCanvas(canvas, 'Failed to fetch data.');
        }
    }

    createChartSkeleton(container, config) {
        const chartId = `chart-${config.id}`;
        const chartElement = document.createElement('div');

        let sizeClass = 'chart-widget';
        let chartHeight = '300px';

        if (config.chartType === 'NumberCard') {
            sizeClass = 'chart-widget small';
            chartHeight = '150px';
        }

        chartElement.className = sizeClass;
        chartElement.setAttribute('data-chart-id', config.id);


        chartElement.innerHTML = `
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
                <canvas id="${chartId}" class="hidden-canvas"></canvas>
            </div>
            <div class="chart-info">
                <small>Event: ${config.eventKey} | Type: ${config.chartType}${config.propertyToDisplay ? ` | Property: ${config.propertyToDisplay}` : ''}</small>
            </div>
        `;

        // Find the correct insertion point based on displayOrder
        const sortedConfigs = [...this.dashboard.chartConfigs].sort((a, b) =>
            (a.displayOrder || 0) - (b.displayOrder || 0)
        );

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
            if (!inserted) {
                container.appendChild(chartElement);
            }
        } else {
            container.appendChild(chartElement);
        }

        return chartElement;
    }

    displayErrorOnCanvas(canvas, message) {
        if (canvas) {
            canvas.classList.remove('hidden');
            const ctx = canvas.getContext('2d');

            // Set canvas dimensions if they are 0 (can happen if the container is hidden or just rendered)
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
                days: days
            });

            const url = `${this.dashboard.baseUrl}/dashboard/custom-chart?${queryParams}`;

            const response = await tokenManager.authenticatedFetch(url);

            if (response.ok) {
                const data = await response.json();

                if (data.success && data.data) {
                    const chartData = data.data.chartData;
                    return chartData;
                } else {
                    console.error(`API failed for ${config.displayName}:`, data.message);
                }
            } else {
                console.error(`HTTP Error ${response.status} loading data for ${config.displayName}`);
            }
        } catch (error) {
            console.error(`Network error loading chart data for ${config.displayName}:`, error);
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
                // The Display Order field is removed, so we default to the end if new, or keep existing value if updating
                displayOrder: isNewConfig ? this.dashboard.chartConfigs.length : this.dashboard.chartConfigs.find(c => c.id === configId)?.displayOrder || 0,
                isEnabled: true
            };

            const response = await tokenManager.authenticatedFetch(`${this.dashboard.baseUrl}/event-config/save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    configId = data.data.configId; // Get the new ID from the backend if it was a new config
                    formData.id = configId; // Update formData with the new ID

                    toastManager.success(`Chart configuration ${isNewConfig ? 'saved' : 'updated'}!`);
                    this.hideConfigModal();

                    // --- START EFFICIENT UPDATE ---
                    if (isNewConfig) {
                        this.dashboard.chartConfigs.push(formData); // Add new config to the list
                    } else {
                        const existingIndex = this.dashboard.chartConfigs.findIndex(c => c.id === configId);
                        if (existingIndex > -1) {
                            this.dashboard.chartConfigs[existingIndex] = formData; // Replace existing config
                        }
                    }

                    // Re-sort the configs array by displayOrder (crucial for correct insertion/update)
                    this.dashboard.chartConfigs.sort((a, b) =>
                        (a.displayOrder || 0) - (b.displayOrder || 0)
                    );

                    // Only re-render the single chart, no full page reload
                    await this.fetchAndRenderSingleChart(configId, isNewConfig);
                    // --- END EFFICIENT UPDATE ---

                    this.editingChartId = null;
                }
            } else {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        } catch (error) {
            console.error('Error saving chart config:', error);
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
            // Removed: document.getElementById('config-display-order').value = config.displayOrder;

            document.getElementById('config-save-btn').textContent = 'Update Chart';

            setTimeout(() => {
                document.getElementById('config-event-key').value = config.eventKey;

                this.loadPropertiesForEvent(config.eventKey).then(() => {
                    document.getElementById('config-property').value = config.propertyToDisplay || '';

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
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        id: configId,
                        projectId: this.dashboard.currentProject
                    })
                });

                if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                        toastManager.success('Chart deleted!');

                        // --- START EFFICIENT DELETE ---
                        // 1. Remove from the local configuration list
                        this.dashboard.chartConfigs = this.dashboard.chartConfigs.filter(c => c.id !== configId);

                        // 2. Remove the chart's element from the DOM
                        const chartElement = document.querySelector(`.chart-widget[data-chart-id="${configId}"]`);
                        if (chartElement) {
                            // Also destroy the Chart.js instance if it exists
                            this.dashboard.chartManager.clearCanvas(`chart-${configId}`);
                            chartElement.remove();
                        }

                        // 3. Update the display orders of all remaining charts
                        await this.saveChartOrder();
                        // --- END EFFICIENT DELETE ---
                    } else {
                        throw new Error(result.message);
                    }
                } else {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
            } catch (error) {
                console.error('Error deleting chart:', error);
                toastManager.error('Failed to delete chart: ' + error.message);
            }
        }
    }

    async saveChartOrder() {
        try {
            // Sort the main config array locally to ensure correct display order values
            const sortedConfigs = [...this.dashboard.chartConfigs].sort((a, b) =>
                (a.displayOrder || 0) - (b.displayOrder || 0)
            );

            // Re-assign explicit display orders 0, 1, 2, ...
            const orders = sortedConfigs.map((config, index) => ({
                id: config.id,
                displayOrder: index
            }));

            // Update local configs with explicit index-based display orders
            orders.forEach(order => {
                const config = this.dashboard.chartConfigs.find(c => c.id === order.id);
                if (config) {
                    config.displayOrder = order.displayOrder;
                }
            });


            const response = await tokenManager.authenticatedFetch(`${this.dashboard.baseUrl}/event-config/update-order`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    projectId: this.dashboard.currentProject,
                    orders: orders
                })
            });

            if (!response.ok) {
                throw new Error('Failed to save chart order');
            }
        } catch (error) {
            console.error('Error saving chart order:', error);
            toastManager.error('Failed to update chart order');
        }
    }

    async updatePreview() {
        const eventKey = document.getElementById('config-event-key').value;
        const property = document.getElementById('config-property').value;
        const chartType = document.getElementById('config-chart-type').value;
        const displayName = document.getElementById('config-display-name').value;
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
            displayName: displayName || 'Preview'
        };

        const chartData = await this.loadChartData(tempConfig);

        if (chartData) {
            this.dashboard.chartManager.renderChart(
                'preview-chart-canvas',
                chartData,
                chartType,
                tempConfig
            );
            previewInfo.textContent = `Preview for: ${eventKey} (${chartType})`;
        } else {
            previewInfo.textContent = 'Failed to load preview data or data is empty.';
        }
    }
}