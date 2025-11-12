class AnalyticsDashboard {
    constructor() {
        this.currentProject = null;
        this.projects = [];
        this.currentFilters = {
            category: 'all',
            metricKey: 'all',
            dateRange: '7',
            startDate: null,
            endDate: null
        };

        this.charts = {};
        this.currentPage = 1;
        this.itemsPerPage = 10;

        this.init();
    }

    async init() {
        await this.loadProjects();
        this.setupEventListeners();
        this.setupFilters();

        // Load initial data if projects exist
        if (this.projects.length > 0) {
            await this.selectProject(this.projects[0]);
        }
    }

    async loadProjects() {
        try {
            showLoading();
            const response = await fetch('/api/projects');
            const data = await response.json();

            this.projects = data.projects || [];
            this.populateProjectSelector();

            if (this.projects.length === 0) {
                toastManager.warning('No projects found in the database');
            }
        } catch (error) {
            console.error('Error loading projects:', error);
            toastManager.error('Failed to load projects');
        } finally {
            hideLoading();
        }
    }

    populateProjectSelector() {
        const projectHeader = document.querySelector('.nav-brand');
        if (!projectHeader.querySelector('#projectSelector')) {
            const selectorHtml = `
                <div class="project-selector">
                    <label for="projectSelect">Project:</label>
                    <select id="projectSelect" class="project-select">
                        ${this.projects.map(project =>
                `<option value="${project}">${project}</option>`
            ).join('')}
                    </select>
                </div>
            `;
            projectHeader.innerHTML += selectorHtml;

            // Add project selector styles if not exists
            this.addProjectSelectorStyles();

            // Add event listener for project changes
            document.getElementById('projectSelect').addEventListener('change', (e) => {
                this.selectProject(e.target.value);
            });
        }
    }

    addProjectSelectorStyles() {
        if (!document.getElementById('project-selector-styles')) {
            const style = document.createElement('style');
            style.id = 'project-selector-styles';
            style.textContent = `
                .project-selector {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin-left: 2rem;
                }
                
                .project-selector label {
                    color: #eee;
                    font-size: 0.9rem;
                }
                
                .project-select {
                    background: #333;
                    border: 1px solid rgb(218, 135, 39);
                    color: #eee;
                    padding: 0.3rem 0.6rem;
                    border-radius: 4px;
                    font-size: 0.9rem;
                }
                
                .project-select:focus {
                    outline: none;
                    border-color: rgb(255, 165, 0);
                }
            `;
            document.head.appendChild(style);
        }
    }

    async selectProject(projectId) {
        this.currentProject = projectId;
        document.getElementById('projectSelect').value = projectId;

        await this.loadAnalytics();
        await this.loadTableData();
    }

    async loadAnalytics(filters = {}) {
        if (!this.currentProject) return;

        try {
            showLoading();

            const params = new URLSearchParams();
            if (filters.category && filters.category !== 'all') params.append('category', filters.category);
            if (filters.metricKey && filters.metricKey !== 'all') params.append('metricKey', filters.metricKey);
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);

            const response = await fetch(`/api/analytics/${this.currentProject}?${params}`);
            const data = await response.json();

            this.updateSummaryCards(data);
            this.updateCharts(data);
            this.updateFilters(data);

        } catch (error) {
            console.error('Error loading analytics:', error);
            toastManager.error('Failed to load analytics data');
        } finally {
            hideLoading();
        }
    }

    updateSummaryCards(data) {
        document.getElementById('totalMetrics').textContent = data.totalMetrics?.toLocaleString() || '0';
        document.getElementById('totalCategories').textContent = data.categories?.length || '0';
        document.getElementById('totalMetricKeys').textContent = data.metricKeys?.length || '0';
        document.getElementById('lastUpdated').textContent = data.lastUpdated ?
            new Date(data.lastUpdated).toLocaleDateString() : 'Never';
    }

    updateCharts(data) {
        this.updateCategoryChart(data.categoryDistribution);
        this.updateTimelineChart(data.timelineData);
        this.updateMetricKeysChart(data.metricKeysDistribution);
        this.updateSourceChart(data.sourceDistribution);
    }

    updateCategoryChart(categoryData) {
        const ctx = document.getElementById('categoryChart').getContext('2d');

        if (this.charts.categoryChart) {
            this.charts.categoryChart.destroy();
        }

        this.charts.categoryChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: categoryData?.map(item => item.category) || [],
                datasets: [{
                    data: categoryData?.map(item => item.count) || [],
                    backgroundColor: [
                        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
                        '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#eee'
                        }
                    }
                }
            }
        });
    }

    updateTimelineChart(timelineData) {
        const ctx = document.getElementById('timelineChart').getContext('2d');

        if (this.charts.timelineChart) {
            this.charts.timelineChart.destroy();
        }

        this.charts.timelineChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: timelineData?.map(item => item.date) || [],
                datasets: [{
                    label: 'Metrics',
                    data: timelineData?.map(item => item.count) || [],
                    borderColor: 'rgb(218, 135, 39)',
                    backgroundColor: 'rgba(218, 135, 39, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                scales: {
                    x: {
                        grid: { color: '#444' },
                        ticks: { color: '#eee' }
                    },
                    y: {
                        grid: { color: '#444' },
                        ticks: { color: '#eee' }
                    }
                },
                plugins: {
                    legend: {
                        labels: { color: '#eee' }
                    }
                }
            }
        });
    }

    updateMetricKeysChart(metricKeysData) {
        const ctx = document.getElementById('metricKeysChart').getContext('2d');

        if (this.charts.metricKeysChart) {
            this.charts.metricKeysChart.destroy();
        }

        this.charts.metricKeysChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: metricKeysData?.map(item => item.metricKey) || [],
                datasets: [{
                    label: 'Count',
                    data: metricKeysData?.map(item => item.count) || [],
                    backgroundColor: 'rgba(218, 135, 39, 0.8)',
                    borderColor: 'rgb(218, 135, 39)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    x: {
                        grid: { color: '#444' },
                        ticks: { color: '#eee' }
                    },
                    y: {
                        grid: { color: '#444' },
                        ticks: { color: '#eee' }
                    }
                },
                plugins: {
                    legend: {
                        labels: { color: '#eee' }
                    }
                }
            }
        });
    }

    updateSourceChart(sourceData) {
        const ctx = document.getElementById('sourceChart').getContext('2d');

        if (this.charts.sourceChart) {
            this.charts.sourceChart.destroy();
        }

        this.charts.sourceChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: sourceData?.map(item => item.source) || [],
                datasets: [{
                    data: sourceData?.map(item => item.count) || [],
                    backgroundColor: [
                        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
                        '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#eee'
                        }
                    }
                }
            }
        });
    }

    updateFilters(data) {
        this.updateFilterOptions('categoryFilter', data.categories || []);
        this.updateFilterOptions('metricKeyFilter', data.metricKeys || []);
    }

    updateFilterOptions(selectId, options) {
        const select = document.getElementById(selectId);
        const currentValue = select.value;

        // Keep "All" option and update others
        select.innerHTML = `<option value="all">All ${selectId.replace('Filter', '').replace(/([A-Z])/g, ' $1').trim()}</option>`;

        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option;
            optionElement.textContent = option;
            select.appendChild(optionElement);
        });

        // Restore previous selection if it still exists
        if (options.includes(currentValue)) {
            select.value = currentValue;
        }
    }

    setupEventListeners() {
        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadAnalytics(this.currentFilters);
        });

        // Filter controls
        document.getElementById('applyFilters').addEventListener('click', () => {
            this.applyFilters();
        });

        // Date range toggle
        document.getElementById('dateRange').addEventListener('change', (e) => {
            const customRange = document.getElementById('customDateRange');
            customRange.style.display = e.target.value === 'custom' ? 'flex' : 'none';
        });

        // Table pagination
        document.getElementById('prevPage').addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.loadTableData();
            }
        });

        document.getElementById('nextPage').addEventListener('click', () => {
            this.currentPage++;
            this.loadTableData();
        });

        // Search
        document.getElementById('searchTable').addEventListener('input', (e) => {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                this.currentPage = 1;
                this.loadTableData(e.target.value);
            }, 300);
        });

        // Export
        document.getElementById('exportData').addEventListener('click', () => {
            this.exportData();
        });
    }

    setupFilters() {
        // Set default date values for custom range
        const today = new Date().toISOString().split('T')[0];
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        document.getElementById('startDate').value = sevenDaysAgo;
        document.getElementById('endDate').value = today;
    }

    applyFilters() {
        const category = document.getElementById('categoryFilter').value;
        const metricKey = document.getElementById('metricKeyFilter').value;
        const dateRange = document.getElementById('dateRange').value;

        let startDate = null;
        let endDate = null;

        if (dateRange === 'custom') {
            startDate = document.getElementById('startDate').value;
            endDate = document.getElementById('endDate').value;
        } else if (dateRange !== 'all') {
            const days = parseInt(dateRange);
            startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            endDate = new Date().toISOString().split('T')[0];
        }

        this.currentFilters = {
            category,
            metricKey,
            dateRange,
            startDate,
            endDate
        };

        this.currentPage = 1;
        this.loadAnalytics(this.currentFilters);
        this.loadTableData();
    }

    async loadTableData(searchTerm = '') {
        if (!this.currentProject) return;

        try {
            showLoading();

            const params = new URLSearchParams({
                page: this.currentPage.toString(),
                limit: this.itemsPerPage.toString(),
                ...this.currentFilters
            });

            if (searchTerm) {
                params.append('search', searchTerm);
            }

            // This would need a new endpoint for paginated table data
            // For now, we'll use the existing analytics endpoint and client-side filtering
            const response = await fetch(`/api/analytics/${this.currentProject}?${params}`);
            const data = await response.json();

            this.updateTable(data.metrics || []);
            this.updatePagination(data.totalCount || 0);

        } catch (error) {
            console.error('Error loading table data:', error);
            toastManager.error('Failed to load table data');
        } finally {
            hideLoading();
        }
    }

    updateTable(metrics) {
        const tbody = document.getElementById('metricsTableBody');
        tbody.innerHTML = '';

        if (metrics.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No metrics found</td></tr>';
            return;
        }

        metrics.forEach(metric => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${this.escapeHtml(metric.metricKey)}</td>
                <td>${this.escapeHtml(metric.category)}</td>
                <td>${this.formatValue(metric.value)}</td>
                <td>${this.escapeHtml(metric.source)}</td>
                <td>${new Date(metric.timestamp).toLocaleString()}</td>
                <td>${this.escapeHtml(metric.projectId)}</td>
            `;
            tbody.appendChild(row);
        });
    }

    updatePagination(totalCount) {
        const totalPages = Math.ceil(totalCount / this.itemsPerPage);
        document.getElementById('pageInfo').textContent = `Page ${this.currentPage} of ${totalPages}`;

        document.getElementById('prevPage').disabled = this.currentPage <= 1;
        document.getElementById('nextPage').disabled = this.currentPage >= totalPages;
    }

    async exportData() {
        if (!this.currentProject) {
            toastManager.warning('Please select a project first');
            return;
        }

        try {
            showLoading();

            const params = new URLSearchParams();
            if (this.currentFilters.startDate) params.append('startDate', this.currentFilters.startDate);
            if (this.currentFilters.endDate) params.append('endDate', this.currentFilters.endDate);

            const response = await fetch(`/api/analytics/${this.currentProject}/export?${params}`);
            const data = await response.json();

            this.downloadAsCSV(data);
            toastManager.success('Data exported successfully');

        } catch (error) {
            console.error('Error exporting data:', error);
            toastManager.error('Failed to export data');
        } finally {
            hideLoading();
        }
    }

    downloadAsCSV(data) {
        const headers = ['Metric Key', 'Category', 'Value', 'Source', 'Timestamp', 'Project'];
        const csvContent = [
            headers.join(','),
            ...data.map(metric => [
                this.escapeCsv(metric.metricKey),
                this.escapeCsv(metric.category),
                this.escapeCsv(this.formatValue(metric.value)),
                this.escapeCsv(metric.source),
                this.escapeCsv(new Date(metric.timestamp).toISOString()),
                this.escapeCsv(metric.projectId)
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-${this.currentProject}-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    }

    escapeHtml(unsafe) {
        if (unsafe === null || unsafe === undefined) return '';
        return unsafe.toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    escapeCsv(str) {
        if (str === null || str === undefined) return '';
        const string = str.toString();
        if (string.includes(',') || string.includes('"') || string.includes('\n')) {
            return `"${string.replace(/"/g, '""')}"`;
        }
        return string;
    }

    formatValue(value) {
        if (!value) return 'N/A';
        if (typeof value === 'object' && value.value !== undefined) {
            return value.value;
        }
        return value.toString();
    }
}

// Utility functions
function showLoading() {
    document.getElementById('loadingOverlay').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new AnalyticsDashboard();
});