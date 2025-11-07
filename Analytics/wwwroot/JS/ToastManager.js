// ToastManager.js
class ToastManager {
    constructor() {
        this.container = null;
        this.toasts = new Set();
        this.init();
    }

    init() {
        // Create or get toast container
        this.container = document.getElementById('toast-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            document.body.appendChild(this.container);
        }

        // Add CSS if not already present
        this.addStyles();
    }

    addStyles() {
        if (document.getElementById('toast-styles')) return;

        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            #toast-container {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 4000;
                display: flex;
                flex-direction: column;
                gap: 10px;
                max-width: 400px;
            }

            .toast {
                background: rgba(26, 26, 26, 0.95);
                border: 1px solid rgb(218, 135, 39);
                color: #eee;
                padding: 0.75rem 1rem;
                border-radius: 8px;
                min-width: 200px;
                max-width: 100%;
                animation: toastSlideIn 0.3s ease-out forwards;
                font-family: 'Orbitron', 'Roboto', sans-serif;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3), 0 0 15px rgba(218, 135, 39, 0.3);
                transform: translateX(100%);
                opacity: 0;
                word-wrap: break-word;
            }

            /* Status-specific toast colors */
            .toast.success {
                border-color: #2e7d32;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3), 0 0 15px rgba(46, 125, 50, 0.3);
            }

            .toast.error {
                border-color: #c62828;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3), 0 0 15px rgba(198, 40, 40, 0.3);
            }

            .toast.warning {
                border-color: #ef6c00;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3), 0 0 15px rgba(239, 108, 0, 0.3);
            }

            .toast.neutral {
                border-color: #555;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3), 0 0 15px rgba(85, 85, 85, 0.3);
            }

            .toast.info {
                border-color: rgb(218, 135, 39);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3), 0 0 15px rgba(218, 135, 39, 0.3);
            }

            @keyframes toastSlideIn {
                0% {
                    transform: translateX(100%);
                    opacity: 0;
                }
                100% {
                    transform: translateX(0);
                    opacity: 1;
                }
            }

            @keyframes toastSlideOut {
                0% {
                    transform: translateX(0);
                    opacity: 1;
                }
                100% {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }

    show(message, type = 'neutral', duration = 5000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        this.container.appendChild(toast);
        this.toasts.add(toast);

        // Force reflow to ensure the element is rendered
        toast.offsetHeight;

        // Apply slide-in animation
        toast.style.animation = 'toastSlideIn 0.3s ease-out forwards';

        // Auto-remove after duration
        setTimeout(() => {
            this.hide(toast);
        }, duration);

        return toast;
    }

    hide(toast) {
        if (!this.toasts.has(toast)) return;

        toast.style.animation = 'toastSlideOut 0.3s ease-in forwards';

        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
            this.toasts.delete(toast);
        }, 300);
    }

    hideAll() {
        this.toasts.forEach(toast => {
            this.hide(toast);
        });
    }

    // Convenience methods for different toast types
    success(message, duration = 5000) {
        return this.show(message, 'success', duration);
    }

    error(message, duration = 5000) {
        return this.show(message, 'error', duration);
    }

    warning(message, duration = 5000) {
        return this.show(message, 'warning', duration);
    }

    info(message, duration = 5000) {
        return this.show(message, 'info', duration);
    }

    neutral(message, duration = 5000) {
        return this.show(message, 'neutral', duration);
    }
}

// Create a singleton instance
const toastManager = new ToastManager();

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = toastManager;
}