// Dashboard JavaScript
class AnalyticsDashboard {
    constructor() {
        this.baseUrl = 'http://localhost:5000/api';
        this.currentProject = null;
        this.currentCategory = null;
        this.currentData = null;
        this.pieChart = null;
        this.metricsData = [];
        this.filteredMetrics = [];
        this.currentPage = 1;
        this.pageSize = 10;
        this.sortField = 'timestamp';
        this.sortDirection = 'desc';
        this.searchTerm = '';

        // Check authentication first
        this.checkAuthentication();
        this.initializeDashboard();
    }

    checkAuthentication() {
        // TokenManager will automatically redirect if no valid token
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

        // Logout button
        document.getElementById('logout-btn').addEventListener('click', () => {
            this.handleLogout();
        });

        // Retry button for error state
        document.getElementById('retry-btn').addEventListener('click', () => {
            this.refreshDashboard();
        });

        // Search input
        document.getElementById('search-input').addEventListener('input', (e) => {
            this.searchTerm = e.target.value.toLowerCase();
            this.filterAndDisplayMetrics();
        });

        // Pagination
        document.getElementById('prev-page').addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.displayMetricsTable();
            }
        });

        document.getElementById('next-page').addEventListener('click', () => {
            const totalPages = Math.ceil(this.filteredMetrics.length / this.pageSize);
            if (this.currentPage < totalPages) {
                this.currentPage++;
                this.displayMetricsTable();
            }
        });

        // Export button
        document.getElementById('export-btn').addEventListener('click', () => {
            this.exportMetrics();
        });

        // Table sorting
        document.querySelectorAll('#metrics-table th[data-sort]').forEach(th => {
            th.addEventListener('click', () => {
                const field = th.getAttribute('data-sort');
                this.handleSort(field);
            });
        });
    }

    async handleLogout() {
        try {
            await tokenManager.logout();
            toastManager.success('Logged out successfully');

            // Redirect to login page after short delay
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
            this.showLoadingState();

            // Use authenticated fetch
            const response = await tokenManager.authenticatedFetch(`${this.baseUrl}/projects`);

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

            // Handle authentication errors specifically
            if (error.message === 'Authentication failed' || error.message.includes('401')) {
                this.showErrorState('Authentication failed. Please login again.');
                toastManager.error('Session expired');
            } else {
                this.showErrorState('Failed to load projects: ' + error.message);
                toastManager.error('Failed to load projects');
            }
        }
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

    async loadCategories() {
        if (!this.currentProject) return;

        try {
            const response = await tokenManager.authenticatedFetch(
                `${this.baseUrl}/categories?projectId=${encodeURIComponent(this.currentProject)}`
            );

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

            // Load summary data with authentication
            const summaryUrl = `${this.baseUrl}/dashboard/summary?projectId=${encodeURIComponent(this.currentProject)}&category=${encodeURIComponent(this.currentCategory)}`;
            const summaryResponse = await tokenManager.authenticatedFetch(summaryUrl);

            if (!summaryResponse.ok) {
                throw new Error(`HTTP error! status: ${summaryResponse.status}`);
            }

            const summaryData = await summaryResponse.json();

            if (summaryData.success) {
                this.currentData = summaryData.summary;
                this.displayMetricBreakdown();
                this.createPieChart();
            }

            // Load metrics data for table
            await this.loadMetricsData();

            this.hideLoadingState();
            this.showDashboardContent();
            toastManager.success('Dashboard data loaded successfully');

        } catch (error) {
            console.error('Error loading dashboard data:', error);

            // Handle authentication errors
            if (error.message === 'Authentication failed') {
                this.showErrorState('Authentication failed. Please refresh the page.');
            } else {
                this.showErrorState('Failed to load dashboard data: ' + error.message);
                toastManager.error('Failed to load dashboard data');
            }
        }
    }

    async loadMetricsData() {
        try {
            const queryParams = new URLSearchParams({
                projectId: this.currentProject,
                category: this.currentCategory,
                limit: '1000'
            });

            const response = await tokenManager.authenticatedFetch(
                `${this.baseUrl}/metrics/query?${queryParams}`
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                this.metricsData = data.metrics || [];
                this.filterAndDisplayMetrics();
            }
        } catch (error) {
            console.error('Error loading metrics data:', error);
            toastManager.error('Failed to load metrics data');
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

    filterAndDisplayMetrics() {
        if (this.searchTerm) {
            this.filteredMetrics = this.metricsData.filter(metric =>
                metric.metricKey.toLowerCase().includes(this.searchTerm) ||
                metric.category.toLowerCase().includes(this.searchTerm) ||
                metric.source.toLowerCase().includes(this.searchTerm)
            );
        } else {
            this.filteredMetrics = [...this.metricsData];
        }

        // Apply sorting
        this.applySorting();

        this.currentPage = 1;
        this.displayMetricsTable();
    }

    applySorting() {
        this.filteredMetrics.sort((a, b) => {
            let aValue = a[this.sortField];
            let bValue = b[this.sortField];

            // Handle nested values
            if (this.sortField === 'value' && a.value) {
                aValue = a.value.value || a.value;
                bValue = b.value.value || b.value;
            }

            // Handle date comparison
            if (this.sortField === 'timestamp') {
                aValue = new Date(aValue);
                bValue = new Date(bValue);
            }

            if (aValue < bValue) return this.sortDirection === 'asc' ? -1 : 1;
            if (aValue > bValue) return this.sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }

    displayMetricsTable() {
        const tbody = document.getElementById('metrics-table-body');
        tbody.innerHTML = '';

        if (this.filteredMetrics.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; color: #aaa;">
                        No metrics data available
                    </td>
                </tr>
            `;
            return;
        }

        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = Math.min(startIndex + this.pageSize, this.filteredMetrics.length);
        const pageData = this.filteredMetrics.slice(startIndex, endIndex);

        pageData.forEach(metric => {
            const row = document.createElement('tr');

            // Format value display
            let valueDisplay = '-';
            if (metric.value) {
                if (typeof metric.value === 'object' && metric.value.value !== undefined) {
                    valueDisplay = metric.value.value;
                } else {
                    valueDisplay = metric.value;
                }
            }

            // Format timestamp
            const timestamp = new Date(metric.timestamp).toLocaleString();

            row.innerHTML = `
                <td>${this.truncateText(metric.metricKey, 30)}</td>
                <td><span class="status neutral">${metric.category}</span></td>
                <td>${this.truncateText(metric.source, 20)}</td>
                <td>${timestamp}</td>
                <td class="metric-value">${valueDisplay}</td>
                <td>
                    <button class="table-action" onclick="dashboard.viewMetricDetails('${metric.id}')">
                        View
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });

        this.updatePagination();
    }

    updatePagination() {
        const totalPages = Math.ceil(this.filteredMetrics.length / this.pageSize);
        const pageInfo = document.getElementById('page-info');
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');

        pageInfo.textContent = `Page ${this.currentPage} of ${totalPages}`;
        prevBtn.disabled = this.currentPage === 1;
        nextBtn.disabled = this.currentPage === totalPages || totalPages === 0;
    }

    handleSort(field) {
        // Update sort headers
        document.querySelectorAll('#metrics-table th').forEach(th => {
            th.classList.remove('sorted-asc', 'sorted-desc');
        });

        const th = document.querySelector(`#metrics-table th[data-sort="${field}"]`);

        if (this.sortField === field) {
            // Toggle direction if same field
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            // New field, default to ascending
            this.sortField = field;
            this.sortDirection = 'asc';
        }

        th.classList.add(this.sortDirection === 'asc' ? 'sorted-asc' : 'sorted-desc');

        this.filterAndDisplayMetrics();
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

    async exportMetrics() {
        try {
            const response = await tokenManager.authenticatedFetch(`${this.baseUrl}/metrics/export`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                // Create and download CSV
                const csv = this.convertToCSV(data.metrics);
                this.downloadCSV(csv, `metrics-export-${new Date().toISOString().split('T')[0]}.csv`);
                toastManager.success('Metrics exported successfully');
            }
        } catch (error) {
            console.error('Error exporting metrics:', error);
            toastManager.error('Failed to export metrics');
        }
    }

    convertToCSV(metrics) {
        const headers = ['Metric Key', 'Category', 'Source', 'Value', 'Timestamp', 'Project ID'];
        const rows = metrics.map(metric => [
            metric.metricKey,
            metric.category,
            metric.source,
            metric.value?.value || metric.value,
            new Date(metric.timestamp).toISOString(),
            metric.projectId
        ]);

        return [headers, ...rows]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');
    }

    downloadCSV(csv, filename) {
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }

    viewMetricDetails(metricId) {
        // TODO: Implement metric detail view
        toastManager.info(`Viewing details for metric ${metricId}`);
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
}

// Initialize dashboard when DOM is loaded
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new AnalyticsDashboard();
});