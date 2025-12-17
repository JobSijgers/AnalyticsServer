/**
 * Project Page Controller
 */
KnuckleHUB.register('ProjectPage', (function() {
    'use strict';

    let _currentProject = null;
    let _chartConfigs = [];
    let _editingEventId = null;
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

        // Drill down elements
        _elements.drillDownModal = document.getElementById('drill-down-modal');
        _elements.drillDownTitle = document.getElementById('drill-down-title');
        _elements.drillDownTable = document.getElementById('drill-down-table');
        _elements.drillDownTbody = document.getElementById('drill-down-tbody');
        _elements.drillDownLoading = document.getElementById('drill-down-loading');
        _elements.recentEventsBtn = document.getElementById('recent-events-btn');

        // Edit Event Modal
        _elements.editEventModal = document.getElementById('edit-event-modal');
        _elements.editPropsContainer = document.getElementById('edit-props-container');
        _elements.addPropBtn = document.getElementById('add-prop-btn');
        _elements.saveEventBtn = document.getElementById('save-event-btn');
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
        _elements.recentEventsBtn?.addEventListener('click', _showRecentEvents);

        // Edit Modal Bindings
        _elements.addPropBtn?.addEventListener('click', () => _addEditPropertyRow());
        _elements.saveEventBtn?.addEventListener('click', _saveEventChanges);
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

    function toggleSortMenu(event, chartId) {
        event.stopPropagation();
        const menu = document.getElementById(`sort-menu-${chartId}`);
        if (!menu) return;
        document.querySelectorAll('.sort-menu-dropdown').forEach(el => {
            if (el.id !== `sort-menu-${chartId}`) el.classList.add('hidden');
        });
        if (menu.classList.contains('hidden')) {
            menu.classList.remove('hidden');
            const closeHandler = () => {
                menu.classList.add('hidden');
                document.removeEventListener('click', closeHandler);
            };
            setTimeout(() => document.addEventListener('click', closeHandler), 0);
        } else {
            menu.classList.add('hidden');
        }
    }

    async function applySort(chartId, sortType) {
        const config = _chartConfigs.find(c => c.id === chartId);
        if (!config) return;
        config.sortOrder = sortType;
        const api = KnuckleHUB.get('API');
        try { await api.saveChartConfig(config); } catch (e) { }
        await _renderCharts();
    }

    // --- Drill Down / Recent Events ---

    function _showRecentEvents() {
        handleDrillDown({
            projectId: _currentProject,
            eventKey: '',
            isRecentView: true
        });
    }

    async function handleDrillDown(data) {
        if (!_elements.drillDownModal) return;

        _elements.drillDownModal.classList.remove('hidden');
        if (_elements.drillDownTitle) {
            const icon = `<span style="color: var(--kh-primary); margin-right: 8px;">${data.isRecentView ? '📋' : '🔍'}</span>`;
            if (data.isRecentView) {
                _elements.drillDownTitle.innerHTML = `${icon} Recent Events (All)`;
            } else {
                let title = `${data.eventKey} Details`;
                if (data.label) title += ` - ${data.label}`;
                if (data.datasetLabel && data.datasetLabel !== 'Count' && data.datasetLabel !== 'Event Count') {
                    title += ` (${data.datasetLabel})`;
                }
                _elements.drillDownTitle.innerHTML = icon + title;
            }
        }

        if (_elements.drillDownLoading) _elements.drillDownLoading.style.display = 'flex';
        if (_elements.drillDownTable) _elements.drillDownTable.classList.add('hidden');
        if (_elements.drillDownTbody) _elements.drillDownTbody.innerHTML = '';

        const api = KnuckleHUB.get('API');
        const result = await api.getDrillDownData(data);

        if (_elements.drillDownLoading) _elements.drillDownLoading.style.display = 'none';

        if (result.success && result.events && result.events.length > 0) {
            if (_elements.drillDownTable) _elements.drillDownTable.classList.remove('hidden');
            _renderDrillDownRows(result.events);
        } else {
            if (_elements.drillDownTbody) {
                _elements.drillDownTbody.innerHTML = '<tr class="empty-message-row"><td colspan="4">No events found.</td></tr>';
                if (_elements.drillDownTable) _elements.drillDownTable.classList.remove('hidden');
            }
        }
    }

    function _renderDrillDownRows(events) {
        if (!_elements.drillDownTbody) return;

        const fragment = document.createDocumentFragment();
        events.forEach(ev => {
            const tr = document.createElement('tr');
            const id = ev.id || ev.Id;
            const timestamp = ev.timestamp || ev.Timestamp;
            const key = ev.key || ev.Key;
            const properties = ev.properties || ev.Properties;

            tr.id = `row-${id}`;

            // 1. Time
            const tdTime = document.createElement('td');
            tdTime.textContent = timestamp ? new Date(timestamp).toLocaleString() : "-";
            tr.appendChild(tdTime);

            // 2. Key
            const tdKey = document.createElement('td');
            tdKey.textContent = key || "-";
            tr.appendChild(tdKey);

            // 3. Properties
            const tdProps = document.createElement('td');
            tdProps.id = `props-${id}`;
            tdProps.className = 'json-cell';
            _renderPropertiesCell(tdProps, properties);
            tr.appendChild(tdProps);

            // 4. Actions (Icons)
            const tdActions = document.createElement('td');
            tdActions.style.textAlign = 'center';
            tdActions.style.whiteSpace = 'nowrap';

            // Edit Icon
            const editBtn = document.createElement('button');
            editBtn.className = 'action-icon-btn edit';
            editBtn.title = 'Edit Event';
            editBtn.innerHTML = '✏️'; // You could replace with SVG <svg...>...</svg>
            editBtn.onclick = () => _openEditEventModal(id, properties);

            // Delete Icon
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'action-icon-btn delete';
            deleteBtn.title = 'Delete Event';
            deleteBtn.innerHTML = '🗑️'; // You could replace with SVG <svg...>...</svg>
            deleteBtn.onclick = () => _deleteSingleEvent(id);

            tdActions.appendChild(editBtn);
            tdActions.appendChild(deleteBtn);
            tr.appendChild(tdActions);

            fragment.appendChild(tr);
        });
        _elements.drillDownTbody.appendChild(fragment);
    }

    function _renderPropertiesCell(element, properties) {
        if (!properties) { element.textContent = '-'; return; }
        try {
            element.textContent = JSON.stringify(properties, null, 2).replace(/[{}"]/g, '').trim();
        } catch {
            element.textContent = String(properties);
        }
    }

    // --- Edit Event Modal Logic ---

    function _openEditEventModal(id, properties) {
        _editingEventId = id;
        _elements.editPropsContainer.innerHTML = '';
        _elements.editEventModal.classList.remove('hidden');

        if (properties) {
            Object.entries(properties).forEach(([key, value]) => {
                _addEditPropertyRow(key, value);
            });
        }
        // Always ensure at least one row if empty, or just leave it blank to allow adding
    }

    function _addEditPropertyRow(key = '', value = '') {
        const container = _elements.editPropsContainer;
        const row = document.createElement('div');
        row.className = 'prop-edit-row';

        // Key Input
        const keyInput = document.createElement('input');
        keyInput.className = 'prop-edit-input prop-key';
        keyInput.placeholder = 'Property Name';
        keyInput.value = key;

        // Value Input
        const valInput = document.createElement('input');
        valInput.className = 'prop-edit-input prop-val';
        valInput.placeholder = 'Value';
        valInput.value = value;

        // Type Select
        const typeSelect = document.createElement('select');
        typeSelect.className = 'prop-edit-type';
        const typeOpString = new Option('String', 'string');
        const typeOpNum = new Option('Number', 'number');
        const typeOpBool = new Option('Boolean', 'boolean');
        typeSelect.add(typeOpString);
        typeSelect.add(typeOpNum);
        typeSelect.add(typeOpBool);

        // Auto-detect type
        if (typeof value === 'number') typeSelect.value = 'number';
        else if (typeof value === 'boolean') typeSelect.value = 'boolean';
        else typeSelect.value = 'string';

        // Delete Row Button
        const delBtn = document.createElement('button');
        delBtn.className = 'prop-delete-btn';
        delBtn.title = 'Remove Property';
        delBtn.innerHTML = '&times;';
        delBtn.onclick = () => row.remove();

        row.appendChild(keyInput);
        row.appendChild(valInput);
        row.appendChild(typeSelect);
        row.appendChild(delBtn);

        container.appendChild(row);
    }

    async function _saveEventChanges() {
        if (!_editingEventId) return;

        const rows = document.querySelectorAll('.prop-edit-row');
        const newProperties = {};

        rows.forEach(row => {
            const key = row.querySelector('.prop-key').value.trim();
            let val = row.querySelector('.prop-val').value;
            const type = row.querySelector('.prop-edit-type').value;

            if (!key) return; // Skip empty keys

            // Type Conversion
            if (type === 'number') {
                val = Number(val);
                if (isNaN(val)) val = 0;
            } else if (type === 'boolean') {
                val = (val === 'true' || val === true);
            }

            newProperties[key] = val;
        });

        const api = KnuckleHUB.get('API');
        const toast = KnuckleHUB.get('Toast');

        _elements.saveEventBtn.textContent = 'Saving...';
        _elements.saveEventBtn.disabled = true;

        const result = await api.updateEvent(_editingEventId, _currentProject, newProperties);

        if (result.success) {
            if (toast) toast.success('Event updated successfully');
            _elements.editEventModal.classList.add('hidden');

            // Refresh row data
            const propsCell = document.getElementById(`props-${_editingEventId}`);
            if (propsCell) {
                _renderPropertiesCell(propsCell, newProperties);
                const row = document.getElementById(`row-${_editingEventId}`);
                const editBtn = row.querySelector('.action-icon-btn.edit');
                if (editBtn) editBtn.onclick = () => _openEditEventModal(_editingEventId, newProperties);
            }
        } else {
            if (toast) toast.error(result.message || 'Failed to update event');
        }

        _elements.saveEventBtn.textContent = 'Save Changes';
        _elements.saveEventBtn.disabled = false;
    }

    async function _deleteSingleEvent(id) {
        if (!confirm('Are you sure you want to permanently delete this event?')) return;
        const api = KnuckleHUB.get('API');
        const toast = KnuckleHUB.get('Toast');
        const result = await api.deleteEvent(id, _currentProject);
        if (result.success) {
            if (toast) toast.success("Event deleted.");
            const row = document.getElementById(`row-${id}`);
            if (row) row.remove();
        } else {
            if (toast) toast.error("Failed to delete event.");
        }
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

    return {
        init, editChart, deleteChart, copyMetricLink,
        toggleSortMenu, applySort, handleDrillDown
    };
})());

window.propertiesDashboard = KnuckleHUB.get('ProjectPage');