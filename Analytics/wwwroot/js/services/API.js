/**
 * API Service
 * Centralized service for all API interactions.
 * Provides a clean interface for fetching data from the backend.
 */
KnuckleHUB.register('API', (function() {
    'use strict';

    const BASE_URL = '/api';

    /**
     * Make an authenticated GET request
     * @private
     */
    async function _get(endpoint) {
        const auth = KnuckleHUB.get('Auth');
        const response = await auth.request(`${BASE_URL}${endpoint}`);
        return response;
    }

    /**
     * Make an authenticated POST request
     * @private
     */
    async function _post(endpoint, data) {
        const auth = KnuckleHUB.get('Auth');
        const response = await auth.request(`${BASE_URL}${endpoint}`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return response;
    }

    // ==================== Projects API ====================

    /**
     * Get all projects
     * @returns {Promise<{success: boolean, projects?: string[], error?: string}>}
     */
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

    /**
     * Delete a project
     * @param {string} projectId - Project ID
     * @param {string} passwordHash - Hashed admin password
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async function deleteProject(projectId, passwordHash) {
        try {
            const response = await _post('/projects/delete', {
                ProjectId: projectId,
                PasswordHash: passwordHash
            });
            if (response.ok) {
                return { success: true };
            }
            const data = await response.json();
            return { success: false, error: data.message || 'Failed to delete project' };
        } catch (error) {
            console.error('API: deleteProject error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get project cover image
     * @param {string} projectId - Project ID
     * @returns {Promise<{success: boolean, imageUrl?: string}>}
     */
    async function getProjectImage(projectId) {
        try {
            const encodedId = encodeURIComponent(projectId);
            const auth = KnuckleHUB.get('Auth');
            const response = await auth.request(`${BASE_URL}/projects/image/${encodedId}`);
            
            if (response.status === 204) {
                return { success: true, imageUrl: null };
            }
            if (response.ok) {
                const blob = await response.blob();
                if (blob.size > 0) {
                    const objectUrl = URL.createObjectURL(blob);
                    return { success: true, imageUrl: objectUrl };
                }
            }
            return { success: true, imageUrl: null };
        } catch (error) {
            console.error('API: getProjectImage error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Upload project cover image
     * @param {string} projectId - Project ID
     * @param {File} imageFile - Image file to upload
     * @returns {Promise<{success: boolean, error?: string}>}
     */
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
            
            if (response.ok) {
                return { success: true };
            }
            return { success: false, error: 'Failed to upload image' };
        } catch (error) {
            console.error('API: uploadProjectImage error:', error);
            return { success: false, error: error.message };
        }
    }

    // ==================== Events API ====================

    /**
     * Get event keys for a project
     * @param {string} projectId - Project ID (or 'GLOBAL' for global keys)
     * @returns {Promise<{success: boolean, eventKeys?: string[], error?: string}>}
     */
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
            console.error('API: getEventKeys error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get properties for an event
     * @param {string} projectId - Project ID
     * @param {string} eventKey - Event key
     * @returns {Promise<{success: boolean, propertyKeys?: string[], error?: string}>}
     */
    async function getEventProperties(projectId, eventKey) {
        try {
            const params = new URLSearchParams({
                projectId: projectId,
                eventKey: eventKey
            });
            const response = await _get(`/events/properties?${params}`);
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data && data.data.propertyKeys) {
                    return { success: true, propertyKeys: data.data.propertyKeys };
                }
            }
            return { success: false, error: 'Failed to fetch event properties' };
        } catch (error) {
            console.error('API: getEventProperties error:', error);
            return { success: false, error: error.message };
        }
    }

    // ==================== Chart Config API ====================

    /**
     * Get chart configurations for a project
     * @param {string} projectId - Project ID
     * @returns {Promise<{success: boolean, configs?: Array, error?: string}>}
     */
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
            console.error('API: getChartConfigs error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Save a chart configuration
     * @param {Object} config - Chart configuration
     * @returns {Promise<{success: boolean, configId?: string, error?: string}>}
     */
    async function saveChartConfig(config) {
        try {
            const response = await _post('/event-config/save', config);
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    return { success: true, configId: data.data.configId };
                }
            }
            return { success: false, error: 'Failed to save chart config' };
        } catch (error) {
            console.error('API: saveChartConfig error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Delete a chart configuration
     * @param {string} configId - Configuration ID
     * @param {string} projectId - Project ID
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async function deleteChartConfig(configId, projectId) {
        try {
            const response = await _post('/event-config/delete', {
                id: configId,
                projectId: projectId
            });
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    return { success: true };
                }
            }
            return { success: false, error: 'Failed to delete chart config' };
        } catch (error) {
            console.error('API: deleteChartConfig error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Update chart order
     * @param {string} projectId - Project ID
     * @param {Array<{id: string, displayOrder: number}>} orders - New order
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async function updateChartOrder(projectId, orders) {
        try {
            const response = await _post('/event-config/update-order', {
                projectId: projectId,
                orders: orders
            });
            if (response.ok) {
                return { success: true };
            }
            return { success: false, error: 'Failed to update chart order' };
        } catch (error) {
            console.error('API: updateChartOrder error:', error);
            return { success: false, error: error.message };
        }
    }

    // ==================== Chart Data API ====================

    /**
     * Get chart data
     * @param {Object} params - Query parameters
     * @param {string} params.projectId - Project ID
     * @param {string} params.eventKey - Event key
     * @param {string} params.chartType - Chart type
     * @param {string} [params.propertyName] - Property name
     * @param {number} [params.days] - Number of days
     * @param {string} [params.filtersJson] - Filters JSON
     * @param {string} [params.configId] - Config ID
     * @param {boolean} [params.useCache] - Use cache
     * @returns {Promise<{success: boolean, chartData?: Object, error?: string}>}
     */
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
                if (response.status === 204) {
                    return { success: true, chartData: null };
                }
                const data = await response.json();
                if (data.success && data.data) {
                    return { success: true, chartData: data.data.chartData };
                }
            }
            return { success: false, error: 'Failed to fetch chart data' };
        } catch (error) {
            console.error('API: getChartData error:', error);
            return { success: false, error: error.message };
        }
    }

    // Public API
    return {
        // Projects
        getProjects,
        deleteProject,
        getProjectImage,
        uploadProjectImage,
        
        // Events
        getEventKeys,
        getEventProperties,
        
        // Chart Configs
        getChartConfigs,
        saveChartConfig,
        deleteChartConfig,
        updateChartOrder,
        
        // Chart Data
        getChartData,
        
        // Utility
        get BASE_URL() { return BASE_URL; }
    };
})());
