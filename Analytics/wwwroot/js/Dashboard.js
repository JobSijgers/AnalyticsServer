class BaseDashboard {
    constructor() {
        this.baseUrl = '/api';
        this.chartManager = new ChartManager(this);
        this.configManager = new ConfigManager(this);
        this.chartConfigs = [];
        this.currentData = null;
        this.currentProject = localStorage.getItem('khs_analytics_projectId');
    }

    checkAuthentication() {
        if (!tokenManager.hasToken()) {
            window.location.href = 'index.html';
        }
    }

    async handleLogout() {
        await tokenManager.logout();
        window.location.href = 'index.html';
    }

    showError(msg) {
        const err = document.getElementById('error-state');
        err.classList.remove('hidden');
        document.getElementById('error-message').textContent = msg;
        const content = document.getElementById(this.isGlobal ? 'global-charts-section' : 'dashboard-content');
        if (content) content.classList.add('hidden');
        document.getElementById('loading-state').classList.add('hidden');
    }

    truncateText(text, maxLength) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    async loadChartConfigurations(projectId) {
        try {
            const response = await tokenManager.authenticatedFetch(
                `${this.baseUrl}/event-config?projectId=${encodeURIComponent(projectId)}`
            );
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data && data.data.configs) {
                    this.chartConfigs = data.data.configs || [];
                } else {
                    this.chartConfigs = [];
                }

                this.configManager.renderConfiguredCharts();
                return true;
            }
        } catch (error) {
            console.error(error);
            return false;
        }
    }

    async hashPassword(password) {
        const msgBuffer = new TextEncoder().encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    }

    copyMetricLink(chartId) {
        const url = `${window.location.origin}${this.baseUrl}/public/metric?id=${chartId}`;
        navigator.clipboard.writeText(url).then(() => {
            if (typeof toastManager !== 'undefined') {
                toastManager.success('Link copied to clipboard');
            } else {
                alert('Link copied to clipboard');
            }
        }).catch(err => {
            console.error('Could not copy text: ', err);
            if (typeof toastManager !== 'undefined') {
                toastManager.error('Failed to copy link');
            }
        });
    }
}

class ProjectDashboard extends BaseDashboard {
    constructor() {
        super();
        this.isGlobal = false;
        if (!this.currentProject) {
            window.location.href = 'dashboard.html';
        }
        this.checkAuthentication();
        this.bindEvents();
        this.init();
    }

    bindEvents() {
        document.getElementById('logout-btn').addEventListener('click', () => this.handleLogout());
        document.getElementById('refresh-btn').addEventListener('click', () => this.loadDashboardData(true));
        document.getElementById('project-select').addEventListener('change', (e) => {
            this.currentProject = e.target.value;
            localStorage.setItem('khs_analytics_projectId', this.currentProject);
            this.updateProjectTitle();
            this.loadDashboardData(true);
        });
        document.getElementById('date-range').addEventListener('change', () => this.loadDashboardData(true));
        const newChartBtn = document.getElementById('new-chart-btn');
        if(newChartBtn) {
            newChartBtn.addEventListener('click', () => this.configManager.showConfigModal());
        }
        const createFirstBtn = document.getElementById('create-first-chart-btn');
        if(createFirstBtn) {
            createFirstBtn.addEventListener('click', () => this.configManager.showConfigModal());
        }
    }

    async init() {
        await this.loadProjectsList();
        this.updateProjectTitle();
        this.toggleLoading(false);
        this.loadDashboardData(false);
    }

    updateProjectTitle() {
        const titleEl = document.getElementById('project-name-display');
        if (titleEl && this.currentProject) {
            titleEl.textContent = this.cleanProjectName(this.currentProject);
        }
    }

    cleanProjectName(projectName) {
        if (!projectName) return '';
        const underscoreIndex = projectName.indexOf('_');
        return underscoreIndex !== -1 ? projectName.substring(underscoreIndex + 1) : projectName;
    }

    async loadProjectsList() {
        try {
            const response = await tokenManager.authenticatedFetch(`${this.baseUrl}/projects`);
            const data = await response.json();
            const select = document.getElementById('project-select');
            select.innerHTML = '';
            data.projects.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p;
                opt.textContent = p;
                if (p === this.currentProject) opt.selected = true;
                select.appendChild(opt);
            });
        } catch (error) {
            console.error(error);
        }
    }

    async loadDashboardData(isRefresh) {
        if (isRefresh) {
            this.toggleLoading(true);
        }
        try {
            await this.loadChartConfigurations(this.currentProject);
            this.updateDashboardState();
        } catch (error) {
            console.error(error);
            this.showError(error.message);
        } finally {
            if (isRefresh) {
                this.toggleLoading(false);
            }
        }
    }

    toggleLoading(show) {
        const loader = document.getElementById('loading-state');
        const content = document.getElementById('dashboard-content');
        if (show) {
            loader.classList.remove('hidden');
            content.classList.add('hidden');
        } else {
            loader.classList.add('hidden');
            content.classList.remove('hidden');
        }
    }

    updateDashboardState() {
        const welcome = document.getElementById('welcome-section');
        const charts = document.getElementById('charts-section');
        if (this.chartConfigs.length === 0) {
            welcome.classList.remove('hidden');
            charts.classList.add('hidden');
        } else {
            welcome.classList.add('hidden');
            charts.classList.remove('hidden');
        }
    }
}

class GlobalDashboard extends BaseDashboard {
    constructor() {
        super();
        this.isGlobal = true;
        this.projectToDelete = null;
        this.checkAuthentication();
        this.bindEvents();
        this.init();
    }

    bindEvents() {
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }
        const retryBtn = document.getElementById('retry-btn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => this.init());
        }
        const addBtn = document.getElementById('add-global-chart-btn');
        if(addBtn) {
            addBtn.addEventListener('click', () => this.configManager.showConfigModal());
        }
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadGlobalConfigs());
        }
        const projectSelect = document.getElementById('project-select');
        if (projectSelect) {
            projectSelect.addEventListener('change', (e) => {
                this.currentProject = e.target.value;
                localStorage.setItem('khs_analytics_projectId', this.currentProject);
                this.loadGlobalConfigs();
            });
        }
        const dateRange = document.getElementById('date-range');
        if (dateRange) {
            dateRange.addEventListener('change', () => this.loadGlobalConfigs());
        }

        const deleteModalClose = document.getElementById('delete-modal-close');
        if (deleteModalClose) deleteModalClose.addEventListener('click', () => this.closeDeleteModal());

        const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
        if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', () => this.closeDeleteModal());

        const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
        if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', () => this.handleDeleteConfirm());

        const deleteInput = document.getElementById('delete-confirmation-input');
        const passInput = document.getElementById('delete-password-input');

        const checkInputs = () => {
            const btn = document.getElementById('confirm-delete-btn');
            const nameMatch = deleteInput.value === this.projectToDelete;
            const hasPass = passInput.value.length > 0;
            if (btn) btn.disabled = !(nameMatch && hasPass);
        };

        if (deleteInput) deleteInput.addEventListener('input', checkInputs);
        if (passInput) passInput.addEventListener('input', checkInputs);
    }

    async init() {
        const loadingState = document.getElementById('loading-state');
        const projectsGrid = document.getElementById('projects-grid');
        const chartsSection = document.getElementById('global-charts-section');
        const errorState = document.getElementById('error-state');
        loadingState.classList.remove('hidden');
        projectsGrid.classList.add('hidden');
        chartsSection.classList.add('hidden');
        errorState.classList.add('hidden');
        try {
            await this.loadProjects();
            loadingState.classList.add('hidden');
            projectsGrid.classList.remove('hidden');
            chartsSection.classList.remove('hidden');
            this.loadGlobalConfigs();
        } catch (error) {
            console.error(error);
            loadingState.classList.add('hidden');
            errorState.classList.remove('hidden');
            document.getElementById('error-message').textContent = error.message;
        }
    }

    async loadGlobalConfigs() {
        try {
            await this.loadChartConfigurations("GLOBAL");
        } catch (error) {
            console.error("Failed to load global configs", error);
        }
    }

    async loadProjects() {
        const response = await tokenManager.authenticatedFetch(`${this.baseUrl}/projects`);
        if (!response.ok) throw new Error('Failed to fetch projects');
        const data = await response.json();
        if (data.success && data.projects) {
            this.renderProjects(data.projects);
        } else {
            throw new Error('No projects found');
        }
    }

    renderProjects(projects) {
        const grid = document.getElementById('projects-grid');
        grid.innerHTML = '';
        projects.forEach(project => {
            const cleanName = this.cleanProjectName(project);
            const safeProjectId = project.replace(/'/g, "\\'");
            const card = document.createElement('div');
            card.className = 'project-card';
            const cardId = `card-${project.replace(/[^a-zA-Z0-9]/g, '')}`;
            card.id = cardId;
            card.innerHTML = `
                <div class="project-card-overlay" onclick="globalDashboard.selectProject('${safeProjectId}')">
                    <h3 class="project-title">${cleanName}</h3>
                </div>
                <button class="delete-project-btn" onclick="globalDashboard.requestDelete(event, '${safeProjectId}')" title="Delete Project">
                    🗑️
                </button>
                <div class="upload-btn-container">
                    <label for="upload-${cardId}" class="upload-label-btn">Change Cover</label>
                    <input type="file" id="upload-${cardId}" accept="image/*" style="display: none;"
                           onchange="globalDashboard.handleImageUpload(event, '${safeProjectId}', '${cardId}')">
                </div>
            `;
            grid.appendChild(card);
            this.loadProjectImage(project, cardId);
        });
    }

    requestDelete(event, projectId) {
        event.stopPropagation();
        this.projectToDelete = projectId;

        const modal = document.getElementById('delete-modal');
        const nameDisplay = document.getElementById('delete-project-name-display');
        const input = document.getElementById('delete-confirmation-input');
        const passInput = document.getElementById('delete-password-input');
        const btn = document.getElementById('confirm-delete-btn');

        if (modal && nameDisplay && input && btn) {
            nameDisplay.textContent = projectId;
            input.value = '';
            input.placeholder = `Type "${projectId}" to confirm`;
            passInput.value = '';
            btn.disabled = true;
            modal.classList.remove('hidden');
            input.focus();
        }
    }

    closeDeleteModal() {
        const modal = document.getElementById('delete-modal');
        if (modal) modal.classList.add('hidden');
        this.projectToDelete = null;
    }

    async handleDeleteConfirm() {
        if (!this.projectToDelete) return;

        const projectId = this.projectToDelete;
        const passInput = document.getElementById('delete-password-input');
        const btn = document.getElementById('confirm-delete-btn');
        const originalText = btn.textContent;

        btn.textContent = "Processing...";
        btn.disabled = true;

        try {
            const passwordHash = await this.hashPassword(passInput.value);

            const response = await tokenManager.authenticatedFetch(`${this.baseUrl}/projects/delete`, {
                method: 'POST',
                body: JSON.stringify({
                    ProjectId: projectId,
                    PasswordHash: passwordHash
                })
            });

            if (response.ok) {
                toastManager.success(`Project ${projectId} deleted.`);
                this.closeDeleteModal();
                this.init();
            } else {
                const data = await response.json();
                toastManager.error(data.message || "Failed to delete project");
                btn.textContent = originalText;
                btn.disabled = false;
            }
        } catch (error) {
            console.error(error);
            toastManager.error("An error occurred while deleting the project.");
            btn.textContent = originalText;
            btn.disabled = false;
        }
    }

    async loadProjectImage(projectId, cardId) {
        const card = document.getElementById(cardId);
        if (!card) return;
        try {
            const encodedId = encodeURIComponent(projectId);
            const response = await tokenManager.authenticatedFetch(`${this.baseUrl}/projects/image/${encodedId}`);
            if (response.status === 204) return;
            if (response.ok) {
                const blob = await response.blob();
                if (blob.size > 0) {
                    const objectUrl = URL.createObjectURL(blob);
                    card.style.backgroundImage = `url('${objectUrl}')`;
                }
            }
        } catch (error) {}
    }

    async handleImageUpload(event, projectId, cardElementId) {
        const originalFile = event.target.files[0];
        if (!originalFile) return;
        try {
            const formData = new FormData();
            formData.append('image', originalFile);
            formData.append('projectId', projectId);
            const response = await fetch(`${this.baseUrl}/projects/image/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${tokenManager.getToken()}` },
                body: formData
            });
            if (response.ok) {
                toastManager.success("Background updated!");
                this.loadProjectImage(projectId, cardElementId);
            }
        } catch (e) { toastManager.error("Error"); }
    }

    cleanProjectName(projectName) {
        if (!projectName) return '';
        const underscoreIndex = projectName.indexOf('_');
        return underscoreIndex !== -1 ? projectName.substring(underscoreIndex + 1) : projectName;
    }

    selectProject(projectId) {
        localStorage.setItem('khs_analytics_projectId', projectId);
        window.location.href = 'project.html';
    }
}

let propertiesDashboard;
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('project-select')) {
        propertiesDashboard = new ProjectDashboard();
        window.propertiesDashboard = propertiesDashboard;
        propertiesDashboard.uiManager = {
            updateDashboardState: () => propertiesDashboard.updateDashboardState()
        };
    }
});

let globalDashboard;
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('projects-grid') && !document.getElementById('project-select')) {
        globalDashboard = new GlobalDashboard();
        window.globalDashboard = globalDashboard;
        globalDashboard.uiManager = {
            updateDashboardState: () => {}
        };
    }
});