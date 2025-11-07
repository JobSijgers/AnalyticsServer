// Dashboard.js (Fixed variable declaration)

// Show toast notification - Remove this old function if it exists
// function showToast(message, type = 'neutral') { ... }

// Fetch requests management - Make it a static property of the class
class FetchRequestManager {
    static fetchRequests = []; // Array to hold { name, projectId, environmentId, chartName, sqlQuery }

    static async fetchRequestsFromBackend() {
        try {
            const response = await tokenManager.authenticatedFetch('/fetch-configs');
            if (!response.ok) {
                throw new Error('Failed to fetch requests');
            }
            const data = await response.json();
            FetchRequestManager.fetchRequests = data.fetchRequests || []; // Use FetchRequestManager.fetchRequests
            this.renderList();
            toastManager.success(`Loaded ${FetchRequestManager.fetchRequests.length} requests from server`);
        } catch (error) {
            toastManager.error(`Error fetching requests: ${error.message}`);
        }
    }

    static async addRequest(formData) {
        const newRequest = {
            name: formData.get('requestName') || `Request ${FetchRequestManager.fetchRequests.length + 1}`, // Use FetchRequestManager.fetchRequests
            projectId: formData.get('projectId'),
            environmentId: formData.get('environmentId'),
            chartName: formData.get('chartName'),
            sqlQuery: formData.get('sqlQuery')
        };
        try {
            const response = await tokenManager.authenticatedFetch('/fetch-configs', {
                method: 'POST',
                body: JSON.stringify(newRequest)
            });
            if (!response.ok) {
                throw new Error('Failed to add request');
            }
            await this.fetchRequestsFromBackend(); // Refresh list from backend
            toastManager.success(`Added: ${newRequest.name}`);
            document.getElementById('fetch-form').reset();
            this.closeModal();
        } catch (error) {
            toastManager.error(`Error adding request: ${error.message}`);
        }
    }

    static async deleteRequest(index) {
        const deletedName = FetchRequestManager.fetchRequests[index].name; // Use FetchRequestManager.fetchRequests
        try {
            const response = await tokenManager.authenticatedFetch('/fetch-configs', {
                method: 'DELETE',
                body: JSON.stringify({index})
            });
            if (!response.ok) {
                throw new Error('Failed to delete request');
            }
            await this.fetchRequestsFromBackend(); // Refresh list from backend
            toastManager.warning(`Deleted: ${deletedName}`);
        } catch (error) {
            toastManager.error(`Error deleting request: ${error.message}`);
        }
    }

    static editRequest(index) {
        const request = FetchRequestManager.fetchRequests[index]; // Use FetchRequestManager.fetchRequests
        document.getElementById('projectId').value = request.projectId;
        document.getElementById('environmentId').value = request.environmentId;
        document.getElementById('chartName').value = request.chartName;
        document.getElementById('sqlQuery').value = request.sqlQuery;
        document.getElementById('requestName').value = request.name;
        this.deleteRequest(index); // Remove old, user re-adds edited via modal
        this.openModal();
        toastManager.info(`Editing mode: Update and add to save changes to ${request.name}`);
    }

    static async clearAll() {
        if (FetchRequestManager.fetchRequests.length === 0 || !confirm('Clear all requests?')) return; // Use FetchRequestManager.fetchRequests
        try {
            const response = await tokenManager.authenticatedFetch('/fetch-configs/clear', {
                method: 'DELETE'
            });
            if (!response.ok) {
                throw new Error('Failed to clear requests');
            }
            await this.fetchRequestsFromBackend(); // Refresh list from backend
            toastManager.warning('Cleared all requests');
        } catch (error) {
            toastManager.error(`Error clearing requests: ${error.message}`);
        }
    }

    static renderList() {
        const container = document.getElementById('requests-list');
        container.innerHTML = '';
        if (FetchRequestManager.fetchRequests.length === 0) { // Use FetchRequestManager.fetchRequests
            container.innerHTML = '<p class="neutral">No fetch requests yet. Add one above.</p>';
            return;
        }
        FetchRequestManager.fetchRequests.forEach((req, index) => { // Use FetchRequestManager.fetchRequests
            const div = document.createElement('div');
            div.className = 'request-card';
            div.innerHTML = `
                <div class="request-header">
                    <h4>${req.name}</h4>
                    <div class="request-actions">
                        <button onclick="FetchRequestManager.editRequest(${index})" class="secondary-btn">Edit</button>
                        <button onclick="FetchRequestManager.deleteRequest(${index})" class="danger-btn">Delete</button>
                    </div>
                </div>
                <div class="request-details">
                    <p><strong>Project ID:</strong> ${req.projectId}</p>
                    <p><strong>Environment ID:</strong> ${req.environmentId}</p>
                    <p><strong>Chart Name:</strong> ${req.chartName}</p>
                    <p><strong>SQL Query:</strong> <pre>${req.sqlQuery}</pre></p>
                </div>
            `;
            container.appendChild(div);
        });
    }

    static openModal() {
        document.getElementById('fetch-modal').style.display = 'flex';
    }

    static closeModal() {
        document.getElementById('fetch-modal').style.display = 'none';
        document.getElementById('fetch-form').reset();
    }
}

// Updated logout function
function setupLogout() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await tokenManager.logout();
                toastManager.success('Logged out successfully');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1000);
            } catch (error) {
                toastManager.error('Error during logout');
            }
        });
    }
}

// Update DOMContentLoaded
document.addEventListener('DOMContentLoaded', async () => {
    toastManager.neutral('Welcome to the Dashboard!');
    await FetchRequestManager.fetchRequestsFromBackend();

    // Setup logout button
    setupLogout();

    // Rest of your existing event listeners...
    document.getElementById('open-fetch-modal').addEventListener('click', () => FetchRequestManager.openModal());
    document.getElementById('close-fetch-modal').addEventListener('click', () => FetchRequestManager.closeModal());
    document.getElementById('fetch-modal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('fetch-modal')) {
            FetchRequestManager.closeModal();
        }
    });
    document.getElementById('fetch-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        FetchRequestManager.addRequest(formData);
    });
    document.getElementById('clear-all').addEventListener('click', () => FetchRequestManager.clearAll());
});