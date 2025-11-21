class PropertiesDashboard {
    constructor() {
        this.baseUrl = 'http://localhost:5000/api';
        this.currentProject = null;
        this.chartConfigs = [];

        this.uiManager = new UIManager(this);
        this.chartManager = new ChartManager(this);
        this.configManager = new ConfigManager(this);

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
        document.getElementById('project-select').addEventListener('change', (e) => {
            this.currentProject = e.target.value;
            this.saveCurrentProject(this.currentProject);
            this.loadChartConfigurations();
        });

        document.getElementById('date-range').addEventListener('change', (e) => {
            this.refreshDashboard();
        });

        document.getElementById('refresh-btn').addEventListener('click', () => {
            this.refreshDashboard();
        });

        document.getElementById('logout-btn').addEventListener('click', () => {
            this.handleLogout();
        });

        document.getElementById('new-chart-btn').addEventListener('click', () => {
            this.configManager.showConfigModal();
        });

        document.getElementById('create-first-chart-btn').addEventListener('click', () => {
            this.configManager.showConfigModal();
        });

        document.getElementById('retry-btn').addEventListener('click', () => {
            this.refreshDashboard();
        });
    }

    saveCurrentProject(projectId) {
        if (projectId) {
            localStorage.setItem('khs_analytics_projectId', projectId);
            console.log(`Saved current project ID: ${projectId}`);
        } else {
            localStorage.removeItem('khs_analytics_projectId');
        }
    }

    getSavedProject() {
        return localStorage.getItem('khs_analytics_projectId');
    }

    async handleLogout() {
        try {
            await tokenManager.logout();
            toastManager.success('Logged out successfully');
            this.saveCurrentProject(null);

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

                const savedProject = this.getSavedProject();

                let projectToSelect = data.projects[0];

                if (savedProject && data.projects.includes(savedProject)) {
                    projectToSelect = savedProject;
                    console.log(`Restoring saved project: ${projectToSelect}`);
                } else {
                    this.saveCurrentProject(projectToSelect);
                }

                this.currentProject = projectToSelect;
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

    async loadChartConfigurations() {
        if (!this.currentProject) return;

        try {
            this.uiManager.showLoadingState();

            const response = await tokenManager.authenticatedFetch(
                `${this.baseUrl}/event-config?projectId=${encodeURIComponent(this.currentProject)}`
            );

            if (response.ok) {
                const data = await response.json();
                console.log('Chart configs API response:', data);

                if (data.success && data.data) {
                    this.chartConfigs = data.data.configs || [];
                    this.configManager.renderConfiguredCharts();
                } else {
                    throw new Error(data.message || 'Failed to load chart configurations');
                }
            } else {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            this.uiManager.hideLoadingState();
            this.uiManager.updateDashboardState();
            this.uiManager.showDashboardContent();

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

    formatNumber(num) {
        return num.toString();
    }

    truncateText(text, maxLength) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }
}

let propertiesDashboard;
document.addEventListener('DOMContentLoaded', () => {
    propertiesDashboard = new PropertiesDashboard();
});