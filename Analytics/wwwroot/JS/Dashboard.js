// Dashboard.js (Fixed variable declaration)

// Fetch requests management - Make it a static property of the class
class FetchRequestManager {
    static fetchRequests = []; // Array to hold { name, projectId, environmentId, sqlQuery }

    static initialized = false;

    static initializeEventListeners() {
        if (this.initialized) return;

        // Setup modal event listeners
        document.getElementById('open-fetch-modal').addEventListener('click', () => FetchRequestManager.openModal());
        document.getElementById('close-fetch-modal').addEventListener('click', () => FetchRequestManager.closeModal());
        document.getElementById('fetch-modal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('fetch-modal')) {
                FetchRequestManager.closeModal();
            }
        });

        // Test request button
        document.getElementById('test-request').addEventListener('click', (e) => {
            e.preventDefault();
            const formData = new FormData(document.getElementById('fetch-form'));
            FetchRequestManager.testRequest(formData);
        });

        // Form submission
        document.getElementById('fetch-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            FetchRequestManager.addRequest(formData);
        });

        this.initialized = true;
    }

    static async fetchRequestsFromBackend() {
        try {
            const response = await tokenManager.authenticatedFetch('/fetch-configs');
            if (!response.ok) {
                throw new Error('Failed to fetch requests');
            }
            const data = await response.json();
            FetchRequestManager.fetchRequests = data.fetchRequests || [];
            this.renderList();
            toastManager.success(`Loaded ${FetchRequestManager.fetchRequests.length} requests from server`);
        } catch (error) {
            toastManager.error(`Error fetching requests: ${error.message}`);
        }
    }

    static async addRequest(formData) {
        const newRequest = {
            name: formData.get('requestName') || `Request ${FetchRequestManager.fetchRequests.length + 1}`,
            projectId: formData.get('projectId'),
            environmentId: formData.get('environmentId'),
            chartName: "sql_de", // Hardcoded chart name
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

    static async testRequest(formData) {
        const testRequest = {
            projectId: formData.get('projectId'),
            environmentId: formData.get('environmentId'),
            sqlQuery: formData.get('sqlQuery')
        };

        // Validate required fields
        if (!testRequest.projectId || !testRequest.environmentId || !testRequest.sqlQuery) {
            toastManager.error('Please fill in all required fields before testing');
            return;
        }

        try {
            this.displayTestResult("Sending test request...");

            const response = await tokenManager.authenticatedFetch('/test-request', {
                method: 'POST',
                body: JSON.stringify(testRequest)
            });

            const result = await response.text();

            if (!response.ok) {
                // Try to parse error as JSON, fallback to text
                try {
                    const errorData = JSON.parse(result);
                    this.displayTestResult(`Error ${response.status}: ${JSON.stringify(errorData, null, 2)}`);
                } catch {
                    this.displayTestResult(`Error ${response.status}: ${result}`);
                }
                toastManager.error(`Test request failed: ${response.status} ${response.statusText}`);
                return;
            }

            // Try to format JSON response for better readability
            try {
                const jsonResult = JSON.parse(result);
                this.displayTestResult(JSON.stringify(jsonResult, null, 2));
                toastManager.success('Test request completed successfully');
            } catch {
                this.displayTestResult(result);
                toastManager.success('Test request completed successfully');
            }
        } catch (error) {
            this.displayTestResult(`Network error: ${error.message}`);
            toastManager.error(`Test request failed: ${error.message}`);
        }
    }

    static displayTestResult(result) {
        const consoleElement = document.getElementById('test-console');
        const placeholder = consoleElement.querySelector('.console-placeholder');

        if (placeholder) {
            placeholder.remove();
        }

        // Create or update the result display
        let resultElement = consoleElement.querySelector('.test-result');
        if (!resultElement) {
            resultElement = document.createElement('pre');
            resultElement.className = 'test-result';
            consoleElement.appendChild(resultElement);
        }

        resultElement.textContent = result;
        consoleElement.scrollTop = consoleElement.scrollHeight;
    }

    static async deleteRequest(index) {
        const deletedName = FetchRequestManager.fetchRequests[index].name;
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
        const request = FetchRequestManager.fetchRequests[index];
        document.getElementById('projectId').value = request.projectId;
        document.getElementById('environmentId').value = request.environmentId;
        document.getElementById('sqlQuery').value = request.sqlQuery;
        document.getElementById('requestName').value = request.name;
        this.deleteRequest(index); // Remove old, user re-adds edited via modal
        this.openModal();
        toastManager.info(`Editing mode: Update and add to save changes to ${request.name}`);
    }

    static renderList() {
        const container = document.getElementById('requests-list');
        container.innerHTML = '';
        if (FetchRequestManager.fetchRequests.length === 0) {
            container.innerHTML = '<p class="neutral">No fetch requests yet. Add one above.</p>';
            return;
        }
        FetchRequestManager.fetchRequests.forEach((req, index) => {
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
                    <p><strong>SQL Query:</strong> <pre>${req.sqlQuery}</pre></p>
                </div>
            `;
            container.appendChild(div);
        });
    }

    static openModal() {
        document.getElementById('fetch-modal').style.display = 'flex';
        // Clear previous test results when opening modal
        const consoleElement = document.getElementById('test-console');
        consoleElement.innerHTML = '<div class="console-placeholder">Click "Test Request" to see the raw output here...</div>';

        // Ensure form is ready for input
        setTimeout(() => {
            document.getElementById('projectId')?.focus();
        }, 100);
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

// Update DOMContentLoaded - Initialize everything properly
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Dashboard initializing...');

    // Initialize event listeners first
    FetchRequestManager.initializeEventListeners();

    // Show welcome message
    toastManager.neutral('Welcome to the Dashboard!');

    // Load existing requests
    await FetchRequestManager.fetchRequestsFromBackend();

    // Setup logout button
    setupLogout();

    console.log('Dashboard initialized successfully');
});