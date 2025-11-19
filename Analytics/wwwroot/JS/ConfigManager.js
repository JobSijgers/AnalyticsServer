// Configuration Manager - Handles chart configuration
class ConfigManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
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
        document.getElementById('config-display-order').value = this.dashboard.chartConfigs.length;
    }

    hideConfigModal() {
        const modal = document.getElementById('config-modal');
        modal.classList.add('hidden');
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
                eventKeySelect.innerHTML = '<option value="">Select Event Key</option>';

                // FIX: Properly handle the API response structure
                if (data.success && data.data && data.data.eventKeys) {
                    data.data.eventKeys.forEach(key => {
                        const option = document.createElement('option');
                        option.value = key;
                        option.textContent = key;
                        eventKeySelect.appendChild(option);
                    });
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
                propertySelect.innerHTML = '<option value="">Event Count (default)</option>';

                // FIX: Properly handle the API response structure
                if (data.success && data.data && data.data.propertyKeys) {
                    data.data.propertyKeys.forEach(key => {
                        const option = document.createElement('option');
                        option.value = key;
                        option.textContent = key;
                        propertySelect.appendChild(option);
                    });
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

        for (const config of sortedConfigs) {
            const chartData = await this.loadChartData(config);
            this.createChartElement(container, config, chartData);
        }

        this.dashboard.uiManager.updateDashboardState();
        this.dashboard.uiManager.showDashboardContent();
    }

    async loadChartData(config) {
        try {
            const queryParams = new URLSearchParams({
                projectId: this.dashboard.currentProject,
                eventKey: config.eventKey,
                propertyName: config.propertyToDisplay || '',
                chartType: config.chartType,
                days: '30'
            });

            const response = await tokenManager.authenticatedFetch(
                `${this.dashboard.baseUrl}/dashboard/custom-chart?${queryParams}`
            );

            if (response.ok) {
                const data = await response.json();
                return data.chartData;
            }
        } catch (error) {
            console.error('Error loading chart data:', error);
        }
        return null;
    }

    createChartElement(container, config, chartData) {
        const chartElement = document.createElement('div');
        chartElement.className = 'chart-widget';
        chartElement.innerHTML = `
            <div class="chart-widget-header">
                <h4>${config.displayName || config.eventKey}</h4>
                <div class="chart-widget-actions">
                    <button class="table-action" onclick="propertiesDashboard.configManager.editChart('${config.id}')">Edit</button>
                    <button class="table-action delete" onclick="propertiesDashboard.configManager.deleteChart('${config.id}')">Delete</button>
                </div>
            </div>
            <div class="chart-container" style="height: 300px;">
                <canvas id="chart-${config.id}"></canvas>
            </div>
            <div class="chart-info">
                <small>Event: ${config.eventKey} | Type: ${config.chartType}${config.propertyToDisplay ? ` | Property: ${config.propertyToDisplay}` : ''}</small>
            </div>
        `;

        container.appendChild(chartElement);

        // Render the actual chart
        if (chartData) {
            this.dashboard.chartManager.renderChart(`chart-${config.id}`, chartData, config.chartType);
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
                    toastManager.success('Chart configuration saved!');
                    this.hideConfigModal();
                    this.dashboard.loadChartConfigurations();
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
            document.getElementById('config-event-key').value = config.eventKey;
            document.getElementById('config-display-name').value = config.displayName;
            document.getElementById('config-chart-type').value = config.chartType;
            document.getElementById('config-property').value = config.propertyToDisplay || '';
            document.getElementById('config-display-order').value = config.displayOrder;

            this.showConfigModal();
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
        const config = this.dashboard.chartConfigs.find(c => c.id === configId);
        if (!config) return;

        const currentIndex = this.dashboard.chartConfigs.findIndex(c => c.id === configId);
        let newIndex;

        if (direction === 'up' && currentIndex > 0) {
            newIndex = currentIndex - 1;
        } else if (direction === 'down' && currentIndex < this.dashboard.chartConfigs.length - 1) {
            newIndex = currentIndex + 1;
        } else {
            return;
        }

        // Swap display orders
        const tempOrder = config.displayOrder;
        config.displayOrder = this.dashboard.chartConfigs[newIndex].displayOrder;
        this.dashboard.chartConfigs[newIndex].displayOrder = tempOrder;

        // Save updated orders
        await this.saveChartOrder();
        this.renderChartsList();
        this.dashboard.loadChartConfigurations();
    }

    async saveChartOrder() {
        try {
            const orders = this.dashboard.chartConfigs.map(config => ({
                id: config.id,
                displayOrder: config.displayOrder
            }));

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
}