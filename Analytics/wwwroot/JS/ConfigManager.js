// Configuration Manager - Handles chart configuration
class ConfigManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.editingChartId = null;
        // 🎯 NEW: Initialize DragDropManager
        this.dragDropManager = new DragDropManager(dashboard, this.saveChartOrder.bind(this));
        this.initializeModalEvents();
    }

    initializeModalEvents() {
        // Config modal events
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

        // Event key change handler
        document.getElementById('config-event-key').addEventListener('change', (e) => {
            if (e.target.value) {
                this.loadPropertiesForEvent(e.target.value);
            }
            this.updatePreview(); // <-- Trigger preview update
        });

        // Property and Chart Type change handlers for instant preview
        document.getElementById('config-property').addEventListener('change', () => {
            this.updatePreview(); // <-- Trigger preview update
        });
        document.getElementById('config-chart-type').addEventListener('change', () => {
            this.updatePreview(); // <-- Trigger preview update
        });

        // Manage modal events
        document.getElementById('manage-modal-close').addEventListener('click', () => {
            this.hideManageModal();
        });
    }

    showConfigModal() {
        const modal = document.getElementById('config-modal');
        modal.classList.remove('hidden');
        this.loadEventKeysForConfig();

        // Reset form
        document.getElementById('chart-config-form').reset();

        // Ensure display order is set for a new chart
        if (this.editingChartId === null) {
            document.getElementById('config-display-order').value = this.dashboard.chartConfigs.length;
            document.getElementById('config-save-btn').textContent = 'Save Chart'; // Default to Save
        }

        // Clear preview when modal opens
        this.dashboard.chartManager.clearCanvas('preview-chart-canvas');
        document.getElementById('preview-info').textContent = 'Select an Event Key and Chart Type to see a preview.';
    }

    hideConfigModal() {
        const modal = document.getElementById('config-modal');
        modal.classList.add('hidden');
        this.editingChartId = null; // Clear editing state when closing
    }

    showManageModal() {
        const modal = document.getElementById('manage-modal');
        modal.classList.remove('hidden');
        this.renderChartsList();
    }

    hideManageModal() {
        const modal = document.getElementById('manage-modal');
        modal.classList.add('hidden');
    }

    async loadEventKeysForConfig() {
        try {
            const response = await tokenManager.authenticatedFetch(
                `${this.dashboard.baseUrl}/events/keys?projectId=${encodeURIComponent(this.dashboard.currentProject)}`
            );

            if (response.ok) {
                const data = await response.json();
                const eventKeySelect = document.getElementById('config-event-key');
                const selectedKey = eventKeySelect.value; // Store currently selected value

                eventKeySelect.innerHTML = '<option value="">Select Event Key</option>';

                // FIX: Properly handle the API response structure
                if (data.success && data.data && data.data.eventKeys) {
                    data.data.eventKeys.forEach(key => {
                        const option = document.createElement('option');
                        option.value = key;
                        option.textContent = key;
                        eventKeySelect.appendChild(option);
                    });

                    // Re-select the previously selected key if it exists
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
                const selectedProperty = propertySelect.value; // Store currently selected property

                propertySelect.innerHTML = '<option value="">Event Count (default)</option>';

                // FIX: Properly handle the API response structure
                if (data.success && data.data && data.data.propertyKeys) {
                    data.data.propertyKeys.forEach(key => {
                        const option = document.createElement('option');
                        option.value = key;
                        option.textContent = key;
                        propertySelect.appendChild(option);
                    });

                    // Re-select the previously selected property if it exists
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
        const section = document.getElementById('charts-section');

        if (!container || !section) return;

        container.innerHTML = '';

        // Sort charts by display order
        const sortedConfigs = [...this.dashboard.chartConfigs].sort((a, b) =>
            (a.displayOrder || 0) - (b.displayOrder || 0)
        );

        // Fetch and render charts sequentially for stability
        for (const config of sortedConfigs) {
            const chartData = await this.loadChartData(config);
            this.createChartElement(container, config, chartData);
        }

        // 🎯 NEW: Use DragDropManager to set up D&D
        this.dragDropManager.setupDragAndDrop(container);

        this.dashboard.uiManager.updateDashboardState();
        this.dashboard.uiManager.showDashboardContent();
    }

    async loadChartData(config) {
        const days = document.getElementById('date-range')?.value || '30'; // Get dynamic days

        try {
            const queryParams = new URLSearchParams({
                projectId: this.dashboard.currentProject,
                eventKey: config.eventKey,
                propertyName: config.propertyToDisplay || '',
                chartType: config.chartType,
                days: days // Use dynamic days
            });

            const url = `${this.dashboard.baseUrl}/dashboard/custom-chart?${queryParams}`;

            const response = await tokenManager.authenticatedFetch(url);

            if (response.ok) {
                const data = await response.json();

                // FIX: Correctly access the nested data path using camelCase: data.data.chartData
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

    createChartElement(container, config, chartData) {
        const chartId = `chart-${config.id}`;
        const chartElement = document.createElement('div');

        let sizeClass = 'chart-widget'; // Default size
        let chartHeight = '300px';

        if (config.chartType === 'NumberCard') {
            sizeClass = 'chart-widget small';
            chartHeight = '150px';
        } else if (config.chartType === 'BarChart') {
            const dataCount = chartData?.data?.length || 0;
            // NEW LOGIC: Make the Bar Chart "large" if it has more than 10 entries
            if (dataCount > 10) {
                sizeClass = 'chart-widget large';
                chartHeight = '400px'; // Overridden by CSS if necessary
            }
        }

        // Apply classes for better styling/sizing
        chartElement.className = sizeClass;
        // 🎯 IMPORTANT: Add a data attribute to easily retrieve the ID during D&D
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
                <canvas id="${chartId}"></canvas>
            </div>
            <div class="chart-info">
                <small>Event: ${config.eventKey} | Type: ${config.chartType}${config.propertyToDisplay ? ` | Property: ${config.propertyToDisplay}` : ''}</small>
            </div>
        `;

        container.appendChild(chartElement);

        // Render the actual chart
        if (chartData) {
            // FIX: Pass the entire config object as the 4th argument
            this.dashboard.chartManager.renderChart(chartId, chartData, config.chartType, config);
        } else {
            // Display a message on the canvas if data failed to load
            const canvas = document.getElementById(chartId);
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx.font = '16px Arial';
                ctx.fillStyle = '#f44336';
                ctx.textAlign = 'center';
                // Note: The ChartManager will overwrite this if it fails the meaningful data check.
                ctx.fillText('Data failed to load.', canvas.width / 2, canvas.height / 2);
            }
        }
    }

    renderChartsList() {
        const container = document.getElementById('charts-list');
        if (!container) return;

        container.innerHTML = '';

        if (this.dashboard.chartConfigs.length === 0) {
            container.innerHTML = '<div class="no-charts-message">No charts configured yet.</div>';
            return;
        }

        const sortedConfigs = [...this.dashboard.chartConfigs].sort((a, b) =>
            (a.displayOrder || 0) - (b.displayOrder || 0)
        );

        sortedConfigs.forEach((config, index) => {
            const listItem = document.createElement('div');
            listItem.className = 'chart-list-item';
            listItem.innerHTML = `
                <div class="chart-list-info">
                    <div class="chart-list-name">${config.displayName || config.eventKey}</div>
                    <div class="chart-list-details">
                        Event: ${config.eventKey} | Type: ${config.chartType}${config.propertyToDisplay ? ` | Property: ${config.propertyToDisplay}` : ''}
                    </div>
                </div>
                <div class="chart-list-actions">
                    <button class="table-action" onclick="propertiesDashboard.configManager.editChart('${config.id}')">Edit</button>
                    <button class="table-action" onclick="propertiesDashboard.configManager.moveChart('${config.id}', 'up')" ${index === 0 ? 'disabled' : ''}>↑</button>
                    <button class="table-action" onclick="propertiesDashboard.configManager.moveChart('${config.id}', 'down')" ${index === sortedConfigs.length - 1 ? 'disabled' : ''}>↓</button>
                    <button class="table-action delete" onclick="propertiesDashboard.configManager.deleteChart('${config.id}')">Delete</button>
                </div>
            `;
            container.appendChild(listItem);
        });
    }

    async saveChartConfig() {
        try {
            const formData = {
                id: this.editingChartId, // NEW: Include the ID for update operation (null if creating)
                projectId: this.dashboard.currentProject,
                eventKey: document.getElementById('config-event-key').value,
                displayName: document.getElementById('config-display-name').value,
                chartType: document.getElementById('config-chart-type').value,
                propertyToDisplay: document.getElementById('config-property').value,
                displayOrder: parseInt(document.getElementById('config-display-order').value) || 0,
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
                    toastManager.success(`Chart configuration ${this.editingChartId ? 'updated' : 'saved'}!`);
                    this.hideConfigModal();
                    this.dashboard.loadChartConfigurations();
                    this.editingChartId = null; // IMPORTANT: Clear state after successful save/update
                }
            }
        } catch (error) {
            console.error('Error saving chart config:', error);
            toastManager.error('Failed to save chart configuration');
        }
    }

    editChart(configId) {
        const config = this.dashboard.chartConfigs.find(c => c.id === configId);
        if (config) {
            this.editingChartId = configId; // NEW: Set the ID for update tracking

            // 1. Show modal (this loads event keys and resets the form briefly)
            this.showConfigModal();

            // 2. Pre-populate basic fields
            document.getElementById('config-display-name').value = config.displayName;
            document.getElementById('config-chart-type').value = config.chartType;
            document.getElementById('config-display-order').value = config.displayOrder;

            // 3. Update button text
            document.getElementById('config-save-btn').textContent = 'Update Chart';

            // 4. Handle asynchronous population of Event Key and Properties
            // Use a slight delay or a more robust promise chain to ensure options are loaded.
            setTimeout(() => {
                // Pre-populate Event Key
                document.getElementById('config-event-key').value = config.eventKey;

                // Load properties for the selected event key
                this.loadPropertiesForEvent(config.eventKey).then(() => {
                    // Pre-populate Property To Analyze after properties are loaded
                    document.getElementById('config-property').value = config.propertyToDisplay || '';

                    // Update preview with old data
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
                        this.dashboard.loadChartConfigurations();
                        this.hideManageModal();
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

    async moveChart(configId, direction) {
        // Find the widget element to flash a visual cue
        const chartElement = document.querySelector(`.chart-widget[data-chart-id="${configId}"]`);
        if (chartElement) {
            chartElement.classList.add('flash-move');
            setTimeout(() => chartElement.classList.remove('flash-move'), 500);
        }

        const config = this.dashboard.chartConfigs.find(c => c.id === configId);
        if (!config) return;

        // Sort a temporary copy of configs to find the current and new index
        const sortedConfigs = [...this.dashboard.chartConfigs].sort((a, b) =>
            (a.displayOrder || 0) - (b.displayOrder || 0)
        );
        const currentIndex = sortedConfigs.findIndex(c => c.id === configId);
        let newIndex;

        if (direction === 'up' && currentIndex > 0) {
            newIndex = currentIndex - 1;
        } else if (direction === 'down' && currentIndex < sortedConfigs.length - 1) {
            newIndex = currentIndex + 1;
        } else {
            return;
        }

        // Swap display orders
        const tempOrder = config.displayOrder;
        config.displayOrder = sortedConfigs[newIndex].displayOrder;
        sortedConfigs[newIndex].displayOrder = tempOrder;

        // Apply the new order to the main array before saving
        this.dashboard.chartConfigs = sortedConfigs;

        // Save updated orders
        await this.saveChartOrder();
        this.renderChartsList();
    }

    async saveChartOrder() {
        try {
            // Sort the local configs to ensure sequential order before mapping
            const sortedConfigs = [...this.dashboard.chartConfigs].sort((a, b) =>
                (a.displayOrder || 0) - (b.displayOrder || 0)
            );

            // Re-assign DisplayOrder sequentially (0, 1, 2, ...) based on the current sorted position
            const orders = sortedConfigs.map((config, index) => ({
                id: config.id,
                displayOrder: index // Use the new index as the DisplayOrder
            }));

            // CRITICAL: Update the local array with the sequential orders
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

    // 🎯 REMOVED: setupDragAndDrop and getDragAfterElement are now in DragDropManager.js

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
            displayName: displayName || 'Preview' // Use displayName from form
        };

        // Reuse the existing data loading function
        const chartData = await this.loadChartData(tempConfig);

        if (chartData) {
            // FIX: Pass the entire tempConfig object as the 4th argument
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