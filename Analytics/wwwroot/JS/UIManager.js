// UI Manager - Handles all UI updates and interactions for custom charts
class UIManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
    }

    cleanProjectName(projectName) {
        if (!projectName) return '';

        const underscoreIndex = projectName.indexOf('_');
        if (underscoreIndex !== -1) {
            return projectName.substring(underscoreIndex + 1);
        }

        return projectName;
    }

    populateProjectSelect(projects) {
        const select = document.getElementById('project-select');
        select.innerHTML = '';

        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project;
            option.textContent = this.cleanProjectName(project);
            select.appendChild(option);
        });
    }

    updateDashboardState() {
        const welcomeSection = document.getElementById('welcome-section');
        const chartsSection = document.getElementById('charts-section');

        if (this.dashboard.chartConfigs.length === 0) {
            welcomeSection.classList.remove('hidden');
            chartsSection.classList.add('hidden');
        } else {
            welcomeSection.classList.add('hidden');
            chartsSection.classList.remove('hidden');
        }
    }

    // UI state management
    showLoadingState() {
        document.getElementById('loading-state').classList.remove('hidden');
        document.getElementById('error-state').classList.add('hidden');
        document.getElementById('dashboard-content').classList.add('hidden');
    }

    hideLoadingState() {
        document.getElementById('loading-state').classList.add('hidden');
    }

    showErrorState(message) {
        const errorMessage = document.getElementById('error-message');
        if (errorMessage) {
            errorMessage.textContent = message;
        }
        document.getElementById('loading-state').classList.add('hidden');
        document.getElementById('error-state').classList.remove('hidden');
        document.getElementById('dashboard-content').classList.add('hidden');
    }

    showDashboardContent() {
        document.getElementById('loading-state').classList.add('hidden');
        document.getElementById('error-state').classList.add('hidden');
        document.getElementById('dashboard-content').classList.remove('hidden');
    }
}