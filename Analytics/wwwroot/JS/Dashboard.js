// Dashboard.js (Updated to handle fetch request management)

// Show toast notification
function showToast(message, type = 'neutral') {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast status ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
}

// Fetch requests management
let fetchRequests = []; // Array to hold { name, projectId, environmentId, chartName, sqlQuery }

class FetchRequestManager {
    static addRequest(formData) {
        const newRequest = {
            name: formData.get('requestName') || `Request ${fetchRequests.length + 1}`,
            projectId: formData.get('projectId'),
            environmentId: formData.get('environmentId'),
            chartName: formData.get('chartName'),
            sqlQuery: formData.get('sqlQuery')
        };
        fetchRequests.push(newRequest);
        this.renderList();
        showToast(`Added: ${newRequest.name}`, 'success');
        document.getElementById('fetch-form').reset();
    }

    static deleteRequest(index) {
        const deletedName = fetchRequests[index].name;
        fetchRequests.splice(index, 1);
        this.renderList();
        showToast(`Deleted: ${deletedName}`, 'warning');
    }

    static editRequest(index) {
        const request = fetchRequests[index];
        document.getElementById('projectId').value = request.projectId;
        document.getElementById('environmentId').value = request.environmentId;
        document.getElementById('chartName').value = request.chartName;
        document.getElementById('sqlQuery').value = request.sqlQuery;
        document.getElementById('requestName').value = request.name;
        this.deleteRequest(index); // Remove old, user can re-add edited
        showToast(`Editing mode: Update and add to save changes to ${request.name}`, 'info');
    }

    static renderList() {
        const container = document.getElementById('requests-list');
        container.innerHTML = '';
        if (fetchRequests.length === 0) {
            container.innerHTML = '<p class="neutral">No fetch requests yet. Add one above.</p>';
            return;
        }
        fetchRequests.forEach((req, index) => {
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

    static saveToJson() {
        if (fetchRequests.length === 0) {
            showToast('No requests to save!', 'warning');
            return;
        }
        const dataStr = JSON.stringify({ fetchRequests }, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'fetchConfigs.json';
        a.click();
        URL.revokeObjectURL(url);
        showToast('Saved to fetchConfigs.json', 'success');
    }

    static loadFromJson(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                fetchRequests = data.fetchRequests || [];
                this.renderList();
                showToast(`Loaded ${fetchRequests.length} requests`, 'success');
            } catch (err) {
                showToast('Invalid JSON file!', 'error');
            }
        };
        reader.readAsText(file);
    }

    static clearAll() {
        if (fetchRequests.length === 0 || !confirm('Clear all requests?')) return;
        fetchRequests = [];
        this.renderList();
        showToast('Cleared all requests', 'warning');
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    showToast('Welcome to the Dashboard!');

    // Form submission
    document.getElementById('fetch-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        FetchRequestManager.addRequest(formData);
    });

    // Save button
    document.getElementById('save-json').addEventListener('click', () => FetchRequestManager.saveToJson());

    // Load button
    document.getElementById('load-json-btn').addEventListener('click', () => document.getElementById('load-json').click());
    document.getElementById('load-json').addEventListener('change', (e) => FetchRequestManager.loadFromJson(e));

    // Clear button
    document.getElementById('clear-all').addEventListener('click', () => FetchRequestManager.clearAll());

    // Initial render
    FetchRequestManager.renderList();
});