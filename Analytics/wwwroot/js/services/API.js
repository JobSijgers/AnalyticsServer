/**
 * API Service
 * Centralized service for all API interactions.
 */
KnuckleHUB.register('API', (function() {
    'use strict';

    const BASE_URL = '/api';

    async function _get(endpoint) {
        const auth = KnuckleHUB.get('Auth');
        const response = await auth.request(`${BASE_URL}${endpoint}`);
        return response;
    }

    async function _post(endpoint, data) {
        const auth = KnuckleHUB.get('Auth');
        const response = await auth.request(`${BASE_URL}${endpoint}`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return response;
    }

    // ==================== Projects API ====================
    async function getProjects() {
        try {
            const response = await _get('/projects');
            if (response.ok) {
                const data = await response.json();
                return { success: true, projects: data.projects || [] };
            }
            return { success: false, error: 'Failed to fetch projects' };
        } catch (error) {
            console.error('API: getProjects error:', error);
            return { success: false, error: error.message };
        }
    }

    async function deleteProject(projectId, passwordHash) {
        try {
            const response = await _post('/projects/delete', {
                ProjectId: projectId,
                PasswordHash: passwordHash
            });
            if (response.ok) return { success: true };
            const data = await response.json();
            return { success: false, error: data.message || 'Failed to delete project' };
        } catch (error) {
            console.error('API: deleteProject error:', error);
            return { success: false, error: error.message };
        }
    }

    async function getProjectImage(projectId) {
        try {
            const encodedId = encodeURIComponent(projectId);
            const auth = KnuckleHUB.get('Auth');
            const response = await auth.request(`${BASE_URL}/projects/image/${encodedId}`);

            if (response.status === 204) return { success: true, imageUrl: null };
            if (response.ok) {
                const blob = await response.blob();
                if (blob.size > 0) return { success: true, imageUrl: URL.createObjectURL(blob) };
            }
            return { success: true, imageUrl: null };
        } catch (error) {
            console.error('API: getProjectImage error:', error);
            return { success: false, error: error.message };
        }
    }

    async function uploadProjectImage(projectId, imageFile) {
        try {
            const formData = new FormData();
            formData.append('image', imageFile);
            formData.append('projectId', projectId);
            const auth = KnuckleHUB.get('Auth');
            const response = await fetch(`${BASE_URL}/projects/image/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${auth.getToken()}` },
                body: formData
            });
            if (response.ok) return { success: true };
            return { success: false, error: 'Failed to upload image' };
        } catch (error) {
            console.error('API: uploadProjectImage error:', error);
            return { success: false, error: error.message };
        }
    }

    function getExportUrl(projectId) {
        const auth = KnuckleHUB.get('Auth');
        const token = auth.getToken();
        return `${BASE_URL}/projects/export?projectId=${encodeURIComponent(projectId)}&token=${encodeURIComponent(token)}`;
    }

    async function importProjectData(projectId, file) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            const auth = KnuckleHUB.get('Auth');
            const url = `${BASE_URL}/projects/import?projectId=${encodeURIComponent(projectId)}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${auth.getToken()}` },
                body: formData
            });
            if (response.ok) {
                const data = await response.json();
                return { success: true, count: data.count };
            }
            return { success: false, error: 'Import failed' };
        } catch (error) {
            console.error('API: importProjectData error:', error);
            return { success: false, error: error.message };
        }
    }

    // ==================== Events API ====================
    async function getEventKeys(projectId) {
        try {
            const response = await _get(`/events/keys?projectId=${encodeURIComponent(projectId)}`);
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data && data.data.eventKeys) {
                    return { success: true, eventKeys: data.data.eventKeys };
                }
            }
            return { success: false, error: 'Failed to fetch event keys' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async function getEventProperties(projectId, eventKey) {
        try {
            const params = new URLSearchParams({ projectId, eventKey });
            const response = await _get(`/events/properties?${params}`);
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data && data.data.propertyKeys) {
                    return { success: true, propertyKeys: data.data.propertyKeys };
                }
            }
            return { success: false, error: 'Failed to fetch event properties' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // [NEW] Delete Event
    async function deleteEvent(id, projectId) {
        try {
            const response = await _post('/events/delete', { id, projectId });
            if (response.ok) {
                const data = await response.json();
                if (data.success) return { success: true };
            }
            return { success: false, error: 'Failed to delete event' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // [NEW] Update Event
    async function updateEvent(id, projectId, properties) {
        try {
            const response = await _post('/events/update', { id, projectId, properties });
            if (response.ok) {
                const data = await response.json();
                if (data.success) return { success: true };
            }
            return { success: false, error: 'Failed to update event' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // ==================== Chart Config API ====================
    async function getChartConfigs(projectId) {
        try {
            const response = await _get(`/event-config?projectId=${encodeURIComponent(projectId)}`);
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data && data.data.configs) {
                    return { success: true, configs: data.data.configs };
                }
                return { success: true, configs: [] };
            }
            return { success: false, error: 'Failed to fetch chart configs' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async function saveChartConfig(config) {
        try {
            const response = await _post('/event-config/save', config);
            if (response.ok) {
                const data = await response.json();
                if (data.success) return { success: true, configId: data.data.configId };
            }
            return { success: false, error: 'Failed to save chart config' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async function deleteChartConfig(configId, projectId) {
        try {
            const response = await _post('/event-config/delete', { id: configId, projectId });
            if (response.ok) {
                const data = await response.json();
                if (data.success) return { success: true };
            }
            return { success: false, error: 'Failed to delete chart config' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async function updateChartOrder(projectId, orders) {
        try {
            const response = await _post('/event-config/update-order', { projectId, orders });
            if (response.ok) return { success: true };
            return { success: false, error: 'Failed to update chart order' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // ==================== Chart Data API ====================
    async function getChartData(params) {
        try {
            const queryParams = new URLSearchParams({
                projectId: params.projectId,
                eventKey: params.eventKey,
                chartType: params.chartType,
                propertyName: params.propertyName || '',
                days: params.days || 30,
                filtersJson: params.filtersJson || '',
                configId: params.configId || '',
                useCache: params.useCache ? 'true' : 'false'
            });

            const response = await _get(`/dashboard/custom-chart?${queryParams}`);
            if (response.ok) {
                if (response.status === 204) return { success: true, chartData: null };
                const data = await response.json();
                if (data.success && data.data) {
                    return { success: true, chartData: data.data.chartData, widgetSize: data.data.widgetSize };
                }
            }
            return { success: false, error: 'Failed to fetch chart data' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async function getDrillDownData(params) {
        try {
            const queryParams = new URLSearchParams();
            queryParams.append('projectId', params.projectId);

            if (params.eventKey) queryParams.append('eventKey', params.eventKey);
            if (params.propertyName) queryParams.append('propertyName', params.propertyName);
            if (params.chartType) queryParams.append('chartType', params.chartType);
            if (params.label) queryParams.append('label', params.label);
            if (params.datasetLabel) queryParams.append('datasetLabel', params.datasetLabel);
            if (params.filtersJson) queryParams.append('filtersJson', params.filtersJson);

            const response = await _get(`/dashboard/drill-down?${queryParams}`);
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    return { success: true, events: data.data };
                }
            }
            return { success: false, error: 'Failed to fetch drill down data' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    return {
        getProjects, deleteProject, getProjectImage, uploadProjectImage,
        getExportUrl, importProjectData,
        getEventKeys, getEventProperties,
        getChartConfigs, saveChartConfig, deleteChartConfig, updateChartOrder,
        getChartData, getDrillDownData, deleteEvent, updateEvent,
        get BASE_URL() { return BASE_URL; }
    };
})());