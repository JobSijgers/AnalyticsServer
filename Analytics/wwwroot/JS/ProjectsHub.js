class ProjectsHub {
    constructor() {
        this.baseUrl = 'http://localhost:5000/api';
        this.checkAuthentication();
        this.bindEvents();
        this.loadProjects();
    }

    checkAuthentication() {
        if (!tokenManager.hasToken()) {
            window.location.href = 'index.html';
        }
    }

    bindEvents() {
        document.getElementById('logout-btn').addEventListener('click', () => this.handleLogout());
        document.getElementById('retry-btn').addEventListener('click', () => this.loadProjects());
    }

    async handleLogout() {
        try {
            await tokenManager.logout();
            window.location.href = 'index.html';
        } catch (error) {
            console.error('Logout failed', error);
            toastManager.error('Logout failed. Please try again.');
        }
    }

    async loadProjects() {
        const loadingState = document.getElementById('loading-state');
        const projectsGrid = document.getElementById('projects-grid');
        const errorState = document.getElementById('error-state');

        loadingState.classList.remove('hidden');
        projectsGrid.classList.add('hidden');
        errorState.classList.add('hidden');

        try {
            const response = await tokenManager.authenticatedFetch(`${this.baseUrl}/projects`);

            if (!response.ok) {
                throw new Error('Failed to fetch projects');
            }

            const data = await response.json();

            if (data.success && data.projects) {
                this.renderProjects(data.projects);
                loadingState.classList.add('hidden');
                projectsGrid.classList.remove('hidden');
            } else {
                throw new Error('No projects found');
            }

        } catch (error) {
            console.error(error);
            loadingState.classList.add('hidden');
            errorState.classList.remove('hidden');
            document.getElementById('error-message').textContent = error.message;
            toastManager.error("Unable to load projects.");
        }
    }

    renderProjects(projects) {
        const grid = document.getElementById('projects-grid');
        grid.innerHTML = '';

        projects.forEach(project => {
            const cleanName = this.cleanProjectName(project);

            // Escape single quotes for inline HTML attributes
            // "Cook'd Up" becomes "Cook\'d Up" so it doesn't break the JS string
            const safeProjectId = project.replace(/'/g, "\\'");

            const card = document.createElement('div');
            card.className = 'project-card';

            const cardId = `card-${project.replace(/[^a-zA-Z0-9]/g, '')}`;
            card.id = cardId;

            card.innerHTML = `
                <div class="project-card-overlay" onclick="projectsHub.selectProject('${safeProjectId}')">
                    <h3 class="project-title">${cleanName}</h3>
                </div>
                
                <div class="upload-btn-container">
                    <label for="upload-${cardId}" class="upload-label-btn">
                        Change Cover
                    </label>
                    <input type="file" id="upload-${cardId}" 
                           accept="image/*" 
                           style="display: none;"
                           onchange="projectsHub.handleImageUpload(event, '${safeProjectId}', '${cardId}')">
                </div>
            `;

            grid.appendChild(card);

            // Load uses the raw ID, not the escaped one
            this.loadProjectImage(project, cardId);
        });
    }

    async loadProjectImage(projectId, cardId) {
        const card = document.getElementById(cardId);
        if (!card) return;

        try {
            const encodedId = encodeURIComponent(projectId);
            const response = await tokenManager.authenticatedFetch(`${this.baseUrl}/projects/image/${encodedId}`);

            if (response.status === 204) {
                return;
            }

            if (response.ok) {
                const blob = await response.blob();
                if (blob.size > 0) {
                    const objectUrl = URL.createObjectURL(blob);
                    card.style.backgroundImage = `url('${objectUrl}')`;
                }
            }
        } catch (error) {
            // Silent fail preferred for missing images
        }
    }

    async handleImageUpload(event, projectId, cardElementId) {
        const originalFile = event.target.files[0];

        if (!originalFile) return;

        if (!originalFile.type.startsWith('image/')) {
            toastManager.error("Invalid file type. Please upload an image.");
            event.target.value = '';
            return;
        }

        const MAX_MB = 4;
        if (originalFile.size > MAX_MB * 1024 * 1024) {
            toastManager.error(`File too large. Maximum size is ${MAX_MB}MB.`);
            event.target.value = '';
            return;
        }

        toastManager.info("Processing image...", 2000);

        try {
            const compressedFile = await this.compressImage(originalFile, 4096);

            const formData = new FormData();
            formData.append('image', compressedFile);
            formData.append('projectId', projectId);

            const response = await fetch(`${this.baseUrl}/projects/image/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${tokenManager.getToken()}`
                },
                body: formData
            });

            if (response.ok) {
                toastManager.success("Background updated successfully!");
                this.loadProjectImage(projectId, cardElementId);
            } else {
                let errorMessage = "Failed to upload image.";
                try {
                    const data = await response.json();
                    if (data.message) errorMessage = data.message;
                } catch (e) {}
                toastManager.error(errorMessage);
            }
        } catch (error) {
            console.error("Upload error:", error);
            toastManager.error("Network error. Please try again later.");
        } finally {
            event.target.value = '';
        }
    }

    async compressImage(file, maxSizeKB) {
        if (file.size <= maxSizeKB * 1024) {
            return file;
        }

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);

            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;

                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    const MAX_WIDTH = 1920;
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    let quality = 0.9;

                    const tryCompress = () => {
                        canvas.toBlob((blob) => {
                            if (!blob) {
                                reject(new Error("Canvas compression error"));
                                return;
                            }

                            if (blob.size <= maxSizeKB * 1024 || quality <= 0.1) {
                                const newFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
                                    type: "image/jpeg",
                                    lastModified: Date.now(),
                                });
                                resolve(newFile);
                            } else {
                                quality -= 0.1;
                                tryCompress();
                            }
                        }, 'image/jpeg', quality);
                    };

                    tryCompress();
                };

                img.onerror = (err) => reject(err);
            };

            reader.onerror = (err) => reject(err);
        });
    }

    cleanProjectName(projectName) {
        if (!projectName) return '';
        const underscoreIndex = projectName.indexOf('_');
        if (underscoreIndex !== -1) {
            return projectName.substring(underscoreIndex + 1);
        }
        return projectName;
    }

    selectProject(projectId) {
        localStorage.setItem('khs_analytics_projectId', projectId);
        window.location.href = 'project.html';
    }
}

let projectsHub;
document.addEventListener('DOMContentLoaded', () => {
    projectsHub = new ProjectsHub();
    window.projectsHub = projectsHub;
});