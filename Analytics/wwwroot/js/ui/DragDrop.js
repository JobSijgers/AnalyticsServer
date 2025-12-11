/**
 * Drag and Drop UI Service
 * Handles drag and drop functionality for reordering chart widgets.
 */
KnuckleHUB.register('DragDrop', (function() {
    'use strict';

    let _draggedItem = null;
    let _placeholder = null;
    let _container = null;
    let _onOrderChanged = null;

    /**
     * Initialize drag and drop on a container
     * @param {HTMLElement} container - Container element with chart widgets
     * @param {Function} onOrderChanged - Callback when order changes
     */
    function setup(container, onOrderChanged) {
        _container = container;
        _onOrderChanged = onOrderChanged;
        
        container.classList.add('draggable-grid');

        const chartWidgets = container.querySelectorAll('.chart-widget');
        chartWidgets.forEach(widget => {
            widget.setAttribute('draggable', true);
            
            // Remove existing listeners
            widget.removeEventListener('dragstart', _handleDragStart);
            widget.removeEventListener('dragend', _handleDragEnd);
            
            // Add new listeners
            widget.addEventListener('dragstart', _handleDragStart);
            widget.addEventListener('dragend', _handleDragEnd);
        });

        // Remove existing document listeners
        document.removeEventListener('dragover', _handleDragOver);
        document.removeEventListener('drop', _handleDrop);
        
        // Add new document listeners
        document.addEventListener('dragover', _handleDragOver);
        document.addEventListener('drop', _handleDrop);
    }

    /**
     * Handle drag start
     * @private
     */
    function _handleDragStart(e) {
        const widget = e.currentTarget;
        _draggedItem = widget;
        e.dataTransfer.setData('text/plain', widget.dataset.chartId);

        // Create placeholder
        _placeholder = document.createElement('div');
        _placeholder.className = 'chart-widget placeholder';

        if (widget.classList.contains('small')) {
            _placeholder.classList.add('small');
        } else if (widget.classList.contains('large')) {
            _placeholder.classList.add('large');
        }

        _placeholder.style.height = `${widget.offsetHeight}px`;
        _placeholder.style.width = `${widget.offsetWidth}px`;

        e.dataTransfer.setDragImage(widget, e.offsetX, e.offsetY);
        setTimeout(() => widget.classList.add('dragging'), 0);
    }

    /**
     * Handle drag end
     * @private
     */
    function _handleDragEnd(e) {
        const widget = e.currentTarget;
        widget.classList.remove('dragging');
        
        if (_placeholder) {
            _placeholder.remove();
            _placeholder = null;
        }
        _draggedItem = null;
    }

    /**
     * Handle drag over
     * @private
     */
    function _handleDragOver(e) {
        e.preventDefault();
        
        if (!_draggedItem || _draggedItem.classList.contains('animating')) return;
        if (!_container) return;
        if (!_container.contains(e.target) && _container !== e.target) return;

        const afterElement = _getDragAfterElement(_container, e.clientX, e.clientY);

        if (!_placeholder.parentNode) {
            _container.insertBefore(_placeholder, _draggedItem);
            return;
        }

        if (afterElement == null) {
            if (_container.lastElementChild !== _placeholder) {
                _container.appendChild(_placeholder);
            }
        } else {
            if (_placeholder.nextElementSibling !== afterElement) {
                _container.insertBefore(_placeholder, afterElement);
            }
        }
    }

    /**
     * Handle drop
     * @private
     */
    async function _handleDrop(e) {
        e.preventDefault();
        
        if (!_draggedItem || !_container) return;

        const draggedItem = _draggedItem;
        const placeholder = _placeholder;

        if (!placeholder || !placeholder.parentNode) {
            draggedItem.classList.remove('dragging');
            _draggedItem = null;
            _placeholder = null;
            return;
        }

        const isDropInsideContainer = _container.contains(e.target) || _container === e.target;
        const finalRect = placeholder.getBoundingClientRect();
        
        placeholder.replaceWith(draggedItem);
        await _animateDrop(draggedItem, finalRect);

        draggedItem.classList.remove('dragging');
        _draggedItem = null;
        _placeholder = null;

        if (isDropInsideContainer && _onOrderChanged) {
            const newOrder = Array.from(_container.querySelectorAll('.chart-widget'))
                .map((widget, index) => ({
                    id: widget.dataset.chartId,
                    displayOrder: index
                }))
                .filter(item => item.id);

            _onOrderChanged(newOrder);
        }
    }

    /**
     * Animate drop transition
     * @private
     */
    async function _animateDrop(element, finalRect) {
        const currentRect = element.getBoundingClientRect();

        const dx = finalRect.left - currentRect.left;
        const dy = finalRect.top - currentRect.top;

        element.style.transition = 'none';
        element.style.transform = `translate(${dx}px, ${dy}px)`;
        element.classList.add('animating');

        element.offsetWidth; // Force reflow

        return new Promise(resolve => {
            element.style.transition = 'transform 0.2s ease-out';
            element.style.transform = 'translate(0, 0)';

            const handleTransitionEnd = () => {
                element.style.transition = '';
                element.style.transform = '';
                element.classList.remove('animating');
                element.removeEventListener('transitionend', handleTransitionEnd);
                resolve();
            };

            element.addEventListener('transitionend', handleTransitionEnd);
        });
    }

    /**
     * Get element to insert after based on cursor position
     * @private
     */
    function _getDragAfterElement(container, x, y) {
        const draggableElements = [...container.querySelectorAll('.chart-widget:not(.dragging):not(.placeholder)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            
            const centerY = box.top + box.height / 2;
            const y_offset = y - centerY;
            
            const centerX = box.left + box.width / 2;
            const x_offset = x - centerX;

            let final_offset = null;

            if (y_offset < 0) {
                final_offset = y_offset;
            } else if (y_offset >= 0 && y_offset < 50) {
                if (x_offset < 0) {
                    final_offset = y_offset + (x_offset / 2);
                }
            }

            if (final_offset != null && final_offset < 0 && 
                (closest.offset == null || final_offset > closest.offset)) {
                return { offset: final_offset, element: child };
            }

            return closest;
        }, { offset: null, element: null }).element;
    }

    /**
     * Cleanup drag and drop
     */
    function cleanup() {
        if (_container) {
            const chartWidgets = _container.querySelectorAll('.chart-widget');
            chartWidgets.forEach(widget => {
                widget.removeEventListener('dragstart', _handleDragStart);
                widget.removeEventListener('dragend', _handleDragEnd);
            });
        }

        document.removeEventListener('dragover', _handleDragOver);
        document.removeEventListener('drop', _handleDrop);

        _draggedItem = null;
        _placeholder = null;
        _container = null;
        _onOrderChanged = null;
    }

    // Public API
    return {
        setup,
        cleanup
    };
})());
