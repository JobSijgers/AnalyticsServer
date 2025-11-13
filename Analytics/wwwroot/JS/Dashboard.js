// Dashboard JavaScript
class AnalyticsDashboard {
    constructor() {
        this.baseUrl = 'http://localhost:5000/api';
        this.currentProject = null;
        this.currentCategory = null;
        this.currentData = null;
        this.pieChart = null;

        this.initializeDashboard();
    }

    initializeDashboard() {
        this.bindEvents();
        this.loadProjects();
    }

    bindEvents() {
        // Project selection
        document.getElementById('project-select').addEventListener('change', (e) => {
            this.currentProject = e.target.value;
            this.loadCategories();
        });

        // Date range selection
        document.getElementById('date-range').addEventListener('change', (e) => {
            this.handleDateRangeChange(e.target.value);
        });

        // Refresh button
        document.getElementById('refresh-btn').addEventListener('click', () => {
            this.refreshDashboard();
        });

        // Retry button for error state
        document.getElementById('retry-btn').addEventListener('click', () => {
            this.refreshDashboard();
        });
    }

    async loadProjects() {
        try {
            this.showLoadingState();
            const response = await fetch(`${this.baseUrl}/projects`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.success && data.projects && data.projects.length > 0) {
                this.populateProjectSelect(data.projects);
                // Auto-select first project
                this.currentProject = data.projects[0];
                document.getElementById('project-select').value = this.currentProject;
                this.loadCategories();
            } else {
                throw new Error('No projects available');
            }
        } catch (error) {
            console.error('Error loading projects:', error);
            this.showErrorState('Failed to load projects: ' + error.message);
            toastManager.error('Failed to load projects');
        }
    }

    populateProjectSelect(projects) {
        const select = document.getElementById('project-select');
        select.innerHTML = '';

        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project; // Store original name as value
            option.textContent = this.cleanProjectName(project); // Display cleaned name
            select.appendChild(option);
        });
    }

    async loadCategories() {
        if (!this.currentProject) return;

        try {
            const response = await fetch(`${this.baseUrl}/categories?projectId=${encodeURIComponent(this.currentProject)}`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.success && data.categories && data.categories.length > 0) {
                this.populateCategoryChips(data.categories);
                // Auto-select first category
                this.currentCategory = data.categories[0];
                this.updateCategorySelection();
                this.loadDashboardData();
            } else {
                throw new Error('No categories available for this project');
            }
        } catch (error) {
            console.error('Error loading categories:', error);
            toastManager.error('Failed to load categories');
        }
    }

    populateCategoryChips(categories) {
        const container = document.getElementById('category-chips');
        container.innerHTML = '';

        categories.forEach(category => {
            const chip = document.createElement('div');
            chip.className = 'category-chip';
            chip.textContent = category;
            chip.dataset.category = category;
            chip.addEventListener('click', () => {
                this.currentCategory = category;
                this.updateCategorySelection();
                this.loadDashboardData();
            });
            container.appendChild(chip);
        });
    }

    updateCategorySelection() {
        document.querySelectorAll('.category-chip').forEach(chip => {
            if (chip.dataset.category === this.currentCategory) {
                chip.classList.add('active');
            } else {
                chip.classList.remove('active');
            }
        });
    }

    async loadDashboardData() {
        if (!this.currentProject || !this.currentCategory) return;

        try {
            this.showLoadingState();

            // Load summary data
            const summaryUrl = `${this.baseUrl}/dashboard/summary?projectId=${encodeURIComponent(this.currentProject)}&category=${encodeURIComponent(this.currentCategory)}`;
            const summaryResponse = await fetch(summaryUrl);

            if (!summaryResponse.ok) {
                throw new Error(`HTTP error! status: ${summaryResponse.status}`);
            }

            const summaryData = await summaryResponse.json();

            if (summaryData.success) {
                this.currentData = summaryData.summary;
                this.displayMetricBreakdown();
                this.createPieChart();
            }

            this.hideLoadingState();
            this.showDashboardContent();
            toastManager.success('Dashboard data loaded successfully');

        } catch (error) {
            console.error('Error loading dashboard data:', error);
            this.showErrorState('Failed to load dashboard data: ' + error.message);
            toastManager.error('Failed to load dashboard data');
        }
    }

    displayMetricBreakdown() {
        const container = document.getElementById('metric-breakdown');
        container.innerHTML = '';

        if (!this.currentData.topMetrics || this.currentData.topMetrics.length === 0) {
            container.innerHTML = '<div class="breakdown-item">No metric data available</div>';
            return;
        }

        const total = this.currentData.topMetrics.reduce((sum, metric) => sum + metric.count, 0);

        this.currentData.topMetrics.forEach(metric => {
            const percentage = total > 0 ? (metric.count / total) * 100 : 0;

            const item = document.createElement('div');
            item.className = 'breakdown-item';
            item.innerHTML = `
                <div class="breakdown-metric">
                    <span class="breakdown-name">${this.truncateText(metric.metricKey, 20)}</span>
                    <span class="breakdown-count">${this.formatNumber(metric.count)}</span>
                    <div class="breakdown-bar">
                        <div class="breakdown-fill" style="width: ${percentage}%"></div>
                    </div>
                    <span class="breakdown-percentage">${percentage.toFixed(1)}%</span>
                </div>
            `;
            container.appendChild(item);
        });
    }

    createPieChart() {
        const canvas = document.getElementById('metrics-pie-chart');
        const ctx = canvas.getContext('2d');

        // Set canvas size to fit container
        const container = canvas.parentElement;
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;

        // Destroy existing chart if it exists
        if (this.pieChart) {
            this.pieChart.destroy();
        }

        if (!this.currentData.topMetrics || this.currentData.topMetrics.length === 0) {
            // Display message when no data
            ctx.font = '16px Arial';
            ctx.fillStyle = '#aaa';
            ctx.textAlign = 'center';
            ctx.fillText('No data available', canvas.width / 2, canvas.height / 2);
            return;
        }

        const labels = this.currentData.topMetrics.map(metric => this.truncateText(metric.metricKey, 15));
        const data = this.currentData.topMetrics.map(metric => metric.count);
        const total = data.reduce((sum, value) => sum + value, 0);

        // Generate distinct colors for the pie chart
        const colors = this.generateChartColors(data.length);

        this.pieChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    borderColor: '#2a2a2a',
                    borderWidth: 2,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        top: 10,
                        bottom: 10,
                        left: 10,
                        right: 10
                    }
                },
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#eee',
                            font: {
                                family: "'Roboto', sans-serif",
                                size: 12
                            },
                            padding: 15,
                            boxWidth: 12
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        },
                        backgroundColor: 'rgba(42, 42, 42, 0.95)',
                        titleColor: '#eee',
                        bodyColor: '#eee',
                        borderColor: 'rgb(218, 135, 39)',
                        borderWidth: 1
                    }
                }
            }
        });
    }

    generateChartColors(count) {
        const baseColors = [
            'rgb(218, 135, 39)',    // Primary orange
            'rgb(76, 175, 80)',     // Green
            'rgb(33, 150, 243)',    // Blue
            'rgb(156, 39, 176)',    // Purple
            'rgb(255, 152, 0)',     // Amber
            'rgb(244, 67, 54)',     // Red
            'rgb(0, 188, 212)',     // Cyan
            'rgb(103, 58, 183)',    // Deep purple
            'rgb(255, 87, 34)',     // Deep orange
            'rgb(205, 220, 57)'     // Lime
        ];

        // If we need more colors than available, generate variations
        if (count <= baseColors.length) {
            return baseColors.slice(0, count);
        }

        // Generate additional colors by adjusting hue
        const colors = [...baseColors];
        for (let i = baseColors.length; i < count; i++) {
            const hue = (i * 137.5) % 360; // Golden angle approximation
            colors.push(`hsl(${hue}, 70%, 50%)`);
        }
        return colors;
    }

    handleDateRangeChange(range) {
        if (range === 'custom') {
            toastManager.info('Custom date range selection coming soon');
        } else {
            this.refreshDashboard();
        }
    }

    refreshDashboard() {
        if (this.currentProject && this.currentCategory) {
            this.loadDashboardData();
        } else if (this.currentProject) {
            this.loadCategories();
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
        document.getElementById('error-message').textContent = message;
        document.getElementById('loading-state').classList.add('hidden');
        document.getElementById('error-state').classList.remove('hidden');
        document.getElementById('dashboard-content').classList.add('hidden');
    }

    showDashboardContent() {
        document.getElementById('loading-state').classList.add('hidden');
        document.getElementById('error-state').classList.add('hidden');
        document.getElementById('dashboard-content').classList.remove('hidden');
    }

    cleanProjectName(projectName) {
        if (!projectName) return '';

        const underscoreIndex = projectName.indexOf('_');
        if (underscoreIndex !== -1) {
            return projectName.substring(underscoreIndex + 1);
        }

        return projectName;
    }
}

// Initialize dashboard when DOM is loaded
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new AnalyticsDashboard();
});

