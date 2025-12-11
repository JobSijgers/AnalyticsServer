/**
 * Toast Notification Service
 * Provides a clean API for displaying toast notifications throughout the application.
 */
KnuckleHUB.register('Toast', (function() {
    'use strict';

    let _container = null;
    const _toasts = new Set();
    const _styles = `
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
            0% { transform: translateX(100%); opacity: 0; }
            100% { transform: translateX(0); opacity: 1; }
        }

        @keyframes toastSlideOut {
            0% { transform: translateX(0); opacity: 1; }
            100% { transform: translateX(100%); opacity: 0; }
        }
    `;

    function _init() {
        // Create or get toast container
        _container = document.getElementById('toast-container');
        if (!_container) {
            _container = document.createElement('div');
            _container.id = 'toast-container';
            document.body.appendChild(_container);
        }

        // Add styles if not already present
        if (!document.getElementById('toast-styles')) {
            const style = document.createElement('style');
            style.id = 'toast-styles';
            style.textContent = _styles;
            document.head.appendChild(style);
        }
    }

    /**
     * Show a toast notification
     * @param {string} message - Message to display
     * @param {string} type - Toast type ('success', 'error', 'warning', 'info', 'neutral')
     * @param {number} duration - Duration in milliseconds
     * @returns {HTMLElement} The toast element
     */
    function show(message, type = 'neutral', duration = 5000) {
        if (!_container) _init();

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        _container.appendChild(toast);
        _toasts.add(toast);

        // Force reflow to ensure the element is rendered
        toast.offsetHeight;

        // Apply slide-in animation
        toast.style.animation = 'toastSlideIn 0.3s ease-out forwards';

        // Auto-remove after duration
        setTimeout(() => hide(toast), duration);

        return toast;
    }

    /**
     * Hide a specific toast
     * @param {HTMLElement} toast - Toast element to hide
     */
    function hide(toast) {
        if (!_toasts.has(toast)) return;

        toast.style.animation = 'toastSlideOut 0.3s ease-in forwards';

        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
            _toasts.delete(toast);
        }, 300);
    }

    /**
     * Hide all toasts
     */
    function hideAll() {
        _toasts.forEach(toast => hide(toast));
    }

    // Initialize on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _init);
    } else {
        _init();
    }

    // Public API
    return {
        show,
        hide,
        hideAll,
        success: (message, duration) => show(message, 'success', duration),
        error: (message, duration) => show(message, 'error', duration),
        warning: (message, duration) => show(message, 'warning', duration),
        info: (message, duration) => show(message, 'info', duration),
        neutral: (message, duration) => show(message, 'neutral', duration)
    };
})());

// Legacy support - create global toastManager reference
window.toastManager = KnuckleHUB.get('Toast');
