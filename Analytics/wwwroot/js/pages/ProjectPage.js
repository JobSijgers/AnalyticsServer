/**
 * Project Page Controller
 * Handles the project-specific analytics page functionality.
 */
KnuckleHUB.register('ProjectPage', (function() {
    'use strict';

    let _currentProject = null;
    let _chartConfigs = [];
    const _elements = {};

    async function init(projectId) {
        _currentProject = projectId;
        _cacheElements();
        _bindEvents();
        _initChartConfigModal();
        _updateProjectTitle();

        await _loadProjectsList();
        _toggleLoading(false);
        await _loadDashboardData(false);
    }

    function _cacheElements() {
        _elements.loadingState = document.getElementById('loading-state');
        _elements.dashboardContent = document.getElementById('dashboard-content');
        _elements.errorState = document.getElementById('error-state');
        _elements.errorMessage = document.getElementById('error-message');
        _elements.welcomeSection = document.getElementById('welcome-section');
        _elements.chartsSection = document.getElementById('charts-section');
        _elements.chartsGrid = document.getElementById('charts-grid');
        _elements.projectNameDisplay = document.getElementById('project-name-display');
        _elements.projectSelect = document.getElementById('project-select');
        _elements.dateRange = document.getElementById('date-range');
        _elements.logoutBtn = document.getElementById('logout-btn');
        _elements.refreshBtn = document.getElementById('refresh-btn');
        _elements.retryBtn = document.getElementById('retry-btn');
        _elements.newChartBtn = document.getElementById('new-chart-btn');
        _elements.createFirstChartBtn = document.getElementById('create-first-chart-btn');
    }

    function _bindEvents() {
        _elements.logoutBtn?.addEventListener('click', _handleLogout);
        _elements.refreshBtn?.addEventListener('click', () => _loadDashboardData(true));
        _elements.retryBtn?.addEventListener('click', () => _loadDashboardData(true));
        
        _elements.projectSelect?.addEventListener('change', (e) => {
            _currentProject = e.target.value;
            localStorage.setItem('khs_analytics_projectId', _currentProject);
            _updateProjectTitle();
            _loadDashboardData(true);
        });

        _elements.dateRange?.addEventListener('change', () => _loadDashboardData(true));

        const showModal = () => {
            const modal = KnuckleHUB.get('ChartConfigModal');
            if (modal) modal.show(_currentProject, false);
        };
        
        _elements.newChartBtn?.addEventListener('click', showModal);
        _elements.createFirstChartBtn?.addEventListener('click', showModal);
    }

    function _initChartConfigModal() {
        const modal = KnuckleHUB.get('ChartConfigModal');
        if (modal) {
            modal.init({
                onSave: async (config, isNew) => {
                    if (isNew) {
                        config.displayOrder = _chartConfigs.length;
                        _chartConfigs.push(config);
                    } else {
                        const index = _chartConfigs.findIndex(c => c.id === config.id);
                        if (index > -1) {
                            config.displayOrder = _chartConfigs[index].displayOrder;
                            _chartConfigs[index] = config;
                        }
                    }
                    _chartConfigs.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
                    await _renderCharts();
                    _updateDashboardState();
                }
            });
        }
    }

    async function _handleLogout() {
        const auth = KnuckleHUB.get('Auth');
        await auth.logout();
        window.location.href = 'index.html';
    }

    function _updateProjectTitle() {
        const chartController = KnuckleHUB.get('ChartController');
        if (_elements.projectNameDisplay && _currentProject) {
            _elements.projectNameDisplay.textContent = chartController.cleanProjectName(_currentProject);
        }
    }

    async function _loadProjectsList() {
        const api = KnuckleHUB.get('API');
        const chartController = KnuckleHUB.get('ChartController');
        const result = await api.getProjects();

        if (result.success && _elements.projectSelect) {
            _elements.projectSelect.innerHTML = '';
            result.projects.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p;
                opt.textContent = chartController.cleanProjectName(p);
                if (p === _currentProject) opt.selected = true;
                _elements.projectSelect.appendChild(opt);
            });
        }
    }

    async function _loadDashboardData(isRefresh) {
        if (isRefresh) _toggleLoading(true);

        try {
            await _loadChartConfigurations();
            _updateDashboardState();
        } catch (error) {
            console.error('Error loading dashboard:', error);
            _showError(error.message);
        } finally {
            if (isRefresh) _toggleLoading(false);
        }
    }

    async function _loadChartConfigurations() {
        const api = KnuckleHUB.get('API');
        const result = await api.getChartConfigs(_currentProject);
        if (result.success) {
            _chartConfigs = result.configs || [];
            await _renderCharts();
        }
    }

    async function _renderCharts() {
        const chartController = KnuckleHUB.get('ChartController');
        await chartController.renderCharts({
            container: _elements.chartsGrid,
            configs: _chartConfigs,
            projectId: _currentProject,
            dashboardVar: 'propertiesDashboard',
            enableDragDrop: true,
            onOrderChange: _handleOrderChange,
            days: parseInt(_elements.dateRange?.value) || 30
        });
    }

    async function _handleOrderChange(newOrder) {
        const chartController = KnuckleHUB.get('ChartController');
        await chartController.updateOrder(_currentProject, _chartConfigs, newOrder);
    }

    function editChart(configId) {
        const config = _chartConfigs.find(c => c.id === configId);
        if (config) {
            const modal = KnuckleHUB.get('ChartConfigModal');
            if (modal) modal.edit(config, _currentProject, false);
        }
    }

    async function deleteChart(configId) {
        const chartController = KnuckleHUB.get('ChartController');
        const deleted = await chartController.deleteChart(configId, _currentProject, _chartConfigs);
        if (deleted) _updateDashboardState();
    }

    function copyMetricLink(chartId) {
        const chartController = KnuckleHUB.get('ChartController');
        chartController.copyMetricLink(chartId);
    }

    function _updateDashboardState() {
        if (_chartConfigs.length === 0) {
            _elements.welcomeSection?.classList.remove('hidden');
            _elements.chartsSection?.classList.add('hidden');
        } else {
            _elements.welcomeSection?.classList.add('hidden');
            _elements.chartsSection?.classList.remove('hidden');
        }
    }

    function _toggleLoading(show) {
        if (show) {
            _elements.loadingState?.classList.remove('hidden');
            _elements.dashboardContent?.classList.add('hidden');
        } else {
            _elements.loadingState?.classList.add('hidden');
            _elements.dashboardContent?.classList.remove('hidden');
        }
    }

    function _showError(message) {
        _elements.errorState?.classList.remove('hidden');
        if (_elements.errorMessage) _elements.errorMessage.textContent = message;
        _elements.dashboardContent?.classList.add('hidden');
        _elements.loadingState?.classList.add('hidden');
    }

    function getCurrentProject() { return _currentProject; }
    function getChartConfigs() { return _chartConfigs; }

    return {
        init,
        editChart,
        deleteChart,
        copyMetricLink,
        getCurrentProject,
        getChartConfigs
    };
})());

window.propertiesDashboard = KnuckleHUB.get('ProjectPage');
