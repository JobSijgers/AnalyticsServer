// Properties Dashboard Main Class - Custom Charts Focus
class PropertiesDashboard {
    constructor() {
        this.baseUrl = 'http://localhost:5000/api';
        this.currentProject = null;
        this.chartConfigs = [];

        // Initialize managers
        this.uiManager = new UIManager(this);
        this.chartManager = new ChartManager(this);
        this.configManager = new ConfigManager(this);

        // Check authentication first
        this.checkAuthentication();
        this.initializeDashboard();
    }

    checkAuthentication() {
        if (!tokenManager.hasToken()) {
            console.log('No authentication token, waiting for redirect...');
            return;
        }
    }

    initializeDashboard() {
        this.bindEvents();
        this.loadProjects();
    }

    bindEvents() {
        // Project selection
        document.getElementById('project-select').addEventListener('change', (e) => {
            this.currentProject = e.target.value;
            this.loadChartConfigurations();
        });

        // Date range selection
        document.getElementById('date-range').addEventListener('change', (e) => {
            this.refreshDashboard();
        });

        // Refresh button
        document.getElementById('refresh-btn').addEventListener('click', () => {
            this.refreshDashboard();
        });

        // Logout button
        document.getElementById('logout-btn').addEventListener('click', () => {
            this.handleLogout();
        });

        document.getElementById('new-chart-btn').addEventListener('click', () => {
            this.configManager.showConfigModal();
        });

        document.getElementById('create-first-chart-btn').addEventListener('click', () => {
            this.configManager.showConfigModal();
        });

        // Manage charts button
        document.getElementById('manage-charts-btn').addEventListener('click', () => {
            this.configManager.showManageModal();
        });

        // Retry button for error state
        document.getElementById('retry-btn').addEventListener('click', () => {
            this.refreshDashboard();
        });
    }

    async handleLogout() {
        try {
            await tokenManager.logout();
            toastManager.success('Logged out successfully');

            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);

        } catch (error) {
            console.error('Logout error:', error);
            toastManager.error('Logout failed');
        }
    }

    async loadProjects() {
        try {
            this.uiManager.showLoadingState();

            const response = await tokenManager.authenticatedFetch(`${this.baseUrl}/projects`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.success && data.projects && data.projects.length > 0) {
                this.uiManager.populateProjectSelect(data.projects);
                // Auto-select first project
                this.currentProject = data.projects[0];
                document.getElementById('project-select').value = this.currentProject;
                this.loadChartConfigurations();
            } else {
                throw new Error('No projects available');
            }
        } catch (error) {
            console.error('Error loading projects:', error);
            this.uiManager.showErrorState('Failed to load projects: ' + error.message);
            toastManager.error('Failed to load projects');
        }
    }

    // PropertiesDashboard.js - Fix chart config loading
    async loadChartConfigurations() {
        if (!this.currentProject) return;

        try {
            this.uiManager.showLoadingState();

            const response = await tokenManager.authenticatedFetch(
                `${this.baseUrl}/event-config?projectId=${encodeURIComponent(this.currentProject)}`
            );

            if (response.ok) {
                const data = await response.json();
                console.log('Chart configs API response:', data); // Debug log

                // FIX: Handle new response format { success: boolean, data: { configs: [] } }
                if (data.success && data.data) {
                    this.chartConfigs = data.data.configs || [];
                    await this.configManager.renderConfiguredCharts();
                } else {
                    throw new Error(data.message || 'Failed to load chart configurations');
                }
            } else {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            this.uiManager.hideLoadingState();
            this.uiManager.updateDashboardState();

        } catch (error) {
            console.error('Error loading chart configs:', error);
            this.uiManager.showErrorState('Failed to load charts: ' + error.message);
            toastManager.error('Failed to load charts');
        }
    }

    refreshDashboard() {
        if (this.currentProject) {
            this.loadChartConfigurations();
        } else {
            this.loadProjects();
        }
    }

    // Utility methods
    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    truncateText(text, maxLength) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }
}

// Initialize dashboard when DOM is loaded
let propertiesDashboard;
document.addEventListener('DOMContentLoaded', () => {
    propertiesDashboard = new PropertiesDashboard();
});