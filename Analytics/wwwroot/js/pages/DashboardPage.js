/**
 * Dashboard Page Controller
 * Handles the main dashboard/projects hub page functionality.
 */
KnuckleHUB.register('DashboardPage', (function() {
    'use strict';

    let _chartConfigs = [];
    let _projectToDelete = null;
    const _elements = {};

    async function init() {
        _cacheElements();
        _bindEvents();
        _initChartConfigModal();
        _showLoading();

        try {
            await _loadProjects();
            _hideLoading();
            _showContent();
            await _loadGlobalCharts();
        } catch (error) {
            console.error('Dashboard init error:', error);
            _showError(error.message);
        }
    }

    function _cacheElements() {
        _elements.loadingState = document.getElementById('loading-state');
        _elements.projectsGrid = document.getElementById('projects-grid');
        _elements.chartsSection = document.getElementById('global-charts-section');
        _elements.chartsGrid = document.getElementById('global-charts-grid');
        _elements.errorState = document.getElementById('error-state');
        _elements.errorMessage = document.getElementById('error-message');
        _elements.logoutBtn = document.getElementById('logout-btn');
        _elements.retryBtn = document.getElementById('retry-btn');
        _elements.addChartBtn = document.getElementById('add-global-chart-btn');
        _elements.dateRange = document.getElementById('date-range');
        _elements.deleteModal = document.getElementById('delete-modal');
        _elements.deleteModalClose = document.getElementById('delete-modal-close');
        _elements.cancelDeleteBtn = document.getElementById('cancel-delete-btn');
        _elements.confirmDeleteBtn = document.getElementById('confirm-delete-btn');
        _elements.deleteProjectName = document.getElementById('delete-project-name-display');
        _elements.deleteConfirmInput = document.getElementById('delete-confirmation-input');
        _elements.deletePasswordInput = document.getElementById('delete-password-input');
    }

    function _bindEvents() {
        _elements.logoutBtn?.addEventListener('click', _handleLogout);
        _elements.retryBtn?.addEventListener('click', init);
        _elements.addChartBtn?.addEventListener('click', () => {
            const modal = KnuckleHUB.get('ChartConfigModal');
            if (modal) modal.show('GLOBAL', true);
        });
        _elements.dateRange?.addEventListener('change', _loadGlobalCharts);
        _elements.deleteModalClose?.addEventListener('click', _closeDeleteModal);
        _elements.cancelDeleteBtn?.addEventListener('click', _closeDeleteModal);
        _elements.confirmDeleteBtn?.addEventListener('click', _handleDeleteConfirm);

        const checkDeleteInputs = () => {
            if (_elements.confirmDeleteBtn && _elements.deleteConfirmInput && _elements.deletePasswordInput) {
                const nameMatch = _elements.deleteConfirmInput.value === _projectToDelete;
                const hasPass = _elements.deletePasswordInput.value.length > 0;
                _elements.confirmDeleteBtn.disabled = !(nameMatch && hasPass);
            }
        };

        _elements.deleteConfirmInput?.addEventListener('input', checkDeleteInputs);
        _elements.deletePasswordInput?.addEventListener('input', checkDeleteInputs);
    }

    function _initChartConfigModal() {
        const modal = KnuckleHUB.get('ChartConfigModal');
        if (modal) {
            modal.init({
                onSave: async (config, isNew) => {
                    if (isNew) {
                        _chartConfigs.push(config);
                    } else {
                        const index = _chartConfigs.findIndex(c => c.id === config.id);
                        if (index > -1) _chartConfigs[index] = config;
                    }
                    _chartConfigs.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
                    await _renderCharts();
                }
            });
        }
    }

    async function _handleLogout() {
        const auth = KnuckleHUB.get('Auth');
        await auth.logout();
        window.location.href = 'index.html';
    }

    async function _loadProjects() {
        const api = KnuckleHUB.get('API');
        const result = await api.getProjects();

        if (!result.success) throw new Error('Failed to fetch projects');
        if (!result.projects || result.projects.length === 0) throw new Error('No projects found');
        
        _renderProjects(result.projects);
    }

    function _renderProjects(projects) {
        if (!_elements.projectsGrid) return;
        
        const chartController = KnuckleHUB.get('ChartController');
        _elements.projectsGrid.innerHTML = '';

        projects.forEach(project => {
            const cleanName = chartController.cleanProjectName(project);
            const safeProjectId = project.replace(/'/g, "\\'");
            const card = document.createElement('div');
            card.className = 'project-card';
            const cardId = `card-${project.replace(/[^a-zA-Z0-9]/g, '')}`;
            card.id = cardId;

            card.innerHTML = `
                <div class="project-card-overlay" onclick="globalDashboard.selectProject('${safeProjectId}')">
                    <h3 class="project-title">${cleanName}</h3>
                </div>
                <button class="delete-project-btn" onclick="globalDashboard.requestDelete(event, '${safeProjectId}')" title="Delete Project">🗑️</button>
                <div class="upload-btn-container">
                    <label for="upload-${cardId}" class="upload-label-btn">Change Cover</label>
                    <input type="file" id="upload-${cardId}" accept="image/*" style="display: none;"
                           onchange="globalDashboard.handleImageUpload(event, '${safeProjectId}', '${cardId}')">
                </div>
            `;

            _elements.projectsGrid.appendChild(card);
            _loadProjectImage(project, cardId);
        });
    }

    async function _loadProjectImage(projectId, cardId) {
        const api = KnuckleHUB.get('API');
        const result = await api.getProjectImage(projectId);
        if (result.success && result.imageUrl) {
            const card = document.getElementById(cardId);
            if (card) card.style.backgroundImage = `url('${result.imageUrl}')`;
        }
    }

    async function handleImageUpload(event, projectId, cardId) {
        const toast = KnuckleHUB.get('Toast');
        const api = KnuckleHUB.get('API');
        const file = event.target.files[0];
        if (!file) return;

        const result = await api.uploadProjectImage(projectId, file);
        if (result.success) {
            if (toast) toast.success('Background updated!');
            _loadProjectImage(projectId, cardId);
        } else {
            if (toast) toast.error('Error uploading image');
        }
    }

    function selectProject(projectId) {
        localStorage.setItem('khs_analytics_projectId', projectId);
        window.location.href = 'project.html';
    }

    function requestDelete(event, projectId) {
        event.stopPropagation();
        _projectToDelete = projectId;

        if (_elements.deleteModal && _elements.deleteProjectName && _elements.deleteConfirmInput && _elements.confirmDeleteBtn) {
            _elements.deleteProjectName.textContent = projectId;
            _elements.deleteConfirmInput.value = '';
            _elements.deleteConfirmInput.placeholder = `Type "${projectId}" to confirm`;
            if (_elements.deletePasswordInput) _elements.deletePasswordInput.value = '';
            _elements.confirmDeleteBtn.disabled = true;
            _elements.deleteModal.classList.remove('hidden');
            _elements.deleteConfirmInput.focus();
        }
    }

    function _closeDeleteModal() {
        if (_elements.deleteModal) _elements.deleteModal.classList.add('hidden');
        _projectToDelete = null;
    }

    async function _handleDeleteConfirm() {
        if (!_projectToDelete) return;

        const toast = KnuckleHUB.get('Toast');
        const api = KnuckleHUB.get('API');
        const auth = KnuckleHUB.get('Auth');
        const projectId = _projectToDelete;
        const originalText = _elements.confirmDeleteBtn.textContent;

        _elements.confirmDeleteBtn.textContent = 'Processing...';
        _elements.confirmDeleteBtn.disabled = true;

        try {
            const passwordHash = await auth.hashPassword(_elements.deletePasswordInput.value);
            const result = await api.deleteProject(projectId, passwordHash);

            if (result.success) {
                if (toast) toast.success(`Project ${projectId} deleted.`);
                _closeDeleteModal();
                init();
            } else {
                if (toast) toast.error(result.error || 'Failed to delete project');
                _elements.confirmDeleteBtn.textContent = originalText;
                _elements.confirmDeleteBtn.disabled = false;
            }
        } catch (error) {
            console.error('Delete error:', error);
            if (toast) toast.error('An error occurred while deleting the project.');
            _elements.confirmDeleteBtn.textContent = originalText;
            _elements.confirmDeleteBtn.disabled = false;
        }
    }

    async function _loadGlobalCharts() {
        const api = KnuckleHUB.get('API');
        const result = await api.getChartConfigs('GLOBAL');
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
            projectId: 'GLOBAL',
            dashboardVar: 'globalDashboard',
            enableDragDrop: true,
            onOrderChange: _handleOrderChange,
            days: parseInt(_elements.dateRange?.value) || 30
        });
    }

    async function _handleOrderChange(newOrder) {
        const chartController = KnuckleHUB.get('ChartController');
        await chartController.updateOrder('GLOBAL', _chartConfigs, newOrder);
    }

    function editChart(configId) {
        const config = _chartConfigs.find(c => c.id === configId);
        if (config) {
            const modal = KnuckleHUB.get('ChartConfigModal');
            if (modal) modal.edit(config, 'GLOBAL', true);
        }
    }

    async function deleteChart(configId) {
        const chartController = KnuckleHUB.get('ChartController');
        await chartController.deleteChart(configId, 'GLOBAL', _chartConfigs);
    }

    function copyMetricLink(chartId) {
        const chartController = KnuckleHUB.get('ChartController');
        chartController.copyMetricLink(chartId);
    }

    function _showLoading() {
        _elements.loadingState?.classList.remove('hidden');
        _elements.projectsGrid?.classList.add('hidden');
        _elements.chartsSection?.classList.add('hidden');
        _elements.errorState?.classList.add('hidden');
    }

    function _hideLoading() {
        _elements.loadingState?.classList.add('hidden');
    }

    function _showContent() {
        _elements.projectsGrid?.classList.remove('hidden');
        _elements.chartsSection?.classList.remove('hidden');
    }

    function _showError(message) {
        _elements.loadingState?.classList.add('hidden');
        _elements.errorState?.classList.remove('hidden');
        if (_elements.errorMessage) _elements.errorMessage.textContent = message;
    }

    return {
        init,
        selectProject,
        requestDelete,
        handleImageUpload,
        editChart,
        deleteChart,
        copyMetricLink
    };
})());

window.globalDashboard = KnuckleHUB.get('DashboardPage');
