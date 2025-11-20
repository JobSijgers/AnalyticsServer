class DragDropManager {
    constructor(dashboard, saveOrderCallback) {
        this.dashboard = dashboard;
        this.saveOrderCallback = saveOrderCallback;

        this.draggedItem = null;
        this.placeholder = null;
        this.container = null;
    }

    setupDragAndDrop(container) {
        this.container = container;
        container.classList.add('draggable-grid');

        const chartWidgets = container.querySelectorAll('.chart-widget');
        chartWidgets.forEach(widget => {
            widget.setAttribute('draggable', true);

            widget.removeEventListener('dragstart', this.handleDragStart);
            widget.removeEventListener('dragend', this.handleDragEnd);

            widget.addEventListener('dragstart', this.handleDragStart.bind(this));
            widget.addEventListener('dragend', this.handleDragEnd.bind(this));
        });

        document.removeEventListener('dragover', this.handleDragOver.bind(this));
        document.removeEventListener('drop', this.handleDrop.bind(this));

        document.addEventListener('dragover', this.handleDragOver.bind(this));
        document.addEventListener('drop', this.handleDrop.bind(this));
    }

    handleDragStart(e) {
        const widget = e.currentTarget;
        this.draggedItem = widget;
        e.dataTransfer.setData('text/plain', widget.dataset.chartId);

        this.placeholder = document.createElement('div');
        this.placeholder.className = 'chart-widget placeholder';

        if (widget.classList.contains('small')) {
            this.placeholder.classList.add('small');
        } else if (widget.classList.contains('large')) {
            this.placeholder.classList.add('large');
        }

        this.placeholder.style.height = `${widget.offsetHeight}px`;
        this.placeholder.style.width = `${widget.offsetWidth}px`;

        e.dataTransfer.setDragImage(widget, e.offsetX, e.offsetY);

        setTimeout(() => widget.classList.add('dragging'), 0);
    }

    handleDragEnd(e) {
        const widget = e.currentTarget;
        widget.classList.remove('dragging');
        if (this.placeholder) {
            this.placeholder.remove();
            this.placeholder = null;
        }
        this.draggedItem = null;
    }

    handleDragOver(e) {
        e.preventDefault();
        const container = this.container;

        if (!this.draggedItem || this.draggedItem.classList.contains('animating')) return;

        if (!container.contains(e.target) && container !== e.target) {
            return;
        }

        const afterElement = this.getDragAfterElement(container, e.clientX, e.clientY);

        if (!this.placeholder.parentNode) {
            container.insertBefore(this.placeholder, this.draggedItem);
            return;
        }

        if (afterElement == null) {
            if (container.lastElementChild !== this.placeholder) {
                container.appendChild(this.placeholder);
            }
        } else {
            if (this.placeholder.nextElementSibling !== afterElement) {
                container.insertBefore(this.placeholder, afterElement);
            }
        }
    }

    async handleDrop(e) {
        e.preventDefault();
        const container = this.container;

        if (!this.draggedItem) return;

        const draggedItem = this.draggedItem;
        const placeholder = this.placeholder;

        if (!placeholder || !placeholder.parentNode) {
            draggedItem.classList.remove('dragging');
            this.draggedItem = null;
            this.placeholder = null;
            return;
        }

        const isDropInsideContainer = container.contains(e.target) || container === e.target;

        const finalRect = placeholder.getBoundingClientRect();
        placeholder.replaceWith(draggedItem);

        await this.animateDrop(draggedItem, finalRect);

        draggedItem.classList.remove('dragging');
        this.draggedItem = null;
        this.placeholder = null;

        if (isDropInsideContainer) {
            const newOrder = Array.from(container.querySelectorAll('.chart-widget')).map((widget, index) => {
                const chartId = widget.dataset.chartId;

                return {
                    id: chartId,
                    displayOrder: index
                };
            }).filter(item => item.id);

            this.dashboard.chartConfigs.forEach(config => {
                const newConfig = newOrder.find(o => o.id === config.id);
                if (newConfig) {
                    config.displayOrder = newConfig.displayOrder;
                }
            });

            await this.saveOrderCallback();

            if (!document.getElementById('manage-modal').classList.contains('hidden')) {
                this.dashboard.configManager.renderChartsList();
            }
        }
    }

    async animateDrop(element, finalRect) {
        const currentRect = element.getBoundingClientRect();

        const dx = finalRect.left - currentRect.left;
        const dy = finalRect.top - currentRect.top;

        element.style.transition = 'none';
        element.style.transform = `translate(${dx}px, ${dy}px)`;
        element.classList.add('animating');

        element.offsetWidth;

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

    getDragAfterElement(container, x, y) {
        // Exclude the currently dragging item and the placeholder from the search
        const draggableElements = [...container.querySelectorAll('.chart-widget:not(.dragging):not(.placeholder)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            // --- NEW LOGIC: Calculate center points and check for insertion ---

            // 1. Vertical Check: Is the drag point above the vertical center of the child?
            const centerY = box.top + box.height / 2;
            const y_offset = y - centerY;

            // 2. Horizontal Check (Tie-breaker): Is the drag point to the left of the horizontal center?
            const centerX = box.left + box.width / 2;
            const x_offset = x - centerX;

            let final_offset = null;

            if (y_offset < 0) {
                // If we are above the vertical center of the child, this child is a candidate for being 'after' us.
                final_offset = y_offset;
            } else if (y_offset >= 0 && y_offset < 50) { // Slight tolerance for near-misses on Y axis
                // If we are slightly below the vertical center, but to the left of the horizontal center,
                // it means the next row's item has been hit, or we're at the end of the current row.
                // We only consider inserting *before* if we are far left.
                if (x_offset < 0) {
                    // This item should be 'after' the insertion point.
                    final_offset = y_offset + (x_offset / 2); // Introduce X-factor
                }
            }


            // Only consider an element if its offset is negative (i.e., the drag is BEFORE it)
            // AND it's the closest (greatest negative value) we've found so far.
            if (final_offset != null && final_offset < 0 && (closest.offset == null || final_offset > closest.offset)) {
                return { offset: final_offset, element: child };
            }

            return closest;
        }, { offset: null, element: null }).element;
    }
}