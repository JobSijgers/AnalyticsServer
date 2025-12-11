/**
 * Chart Configuration Modal
 * Handles the chart configuration modal UI and logic.
 */
KnuckleHUB.register('ChartConfigModal', (function() {
    'use strict';

    let _editingChartId = null;
    let _currentEventProperties = [];
    let _currentProjectId = null;
    let _isGlobal = false;
    let _onSave = null;
    let _previewDebounceTimer = null;

    // DOM element references
    const _elements = {};

    /**
     * Initialize the modal
     * @param {Object} options - Configuration options
     * @param {Function} options.onSave - Callback when chart is saved
     */
    function init(options = {}) {
        _onSave = options.onSave;
        _cacheElements();
        _bindEvents();
    }

    /**
     * Cache DOM element references
     * @private
     */
    function _cacheElements() {
        _elements.modal = document.getElementById('config-modal');
        _elements.closeBtn = document.getElementById('config-modal-close');
        _elements.cancelBtn = document.getElementById('config-cancel-btn');
        _elements.form = document.getElementById('chart-config-form');
        _elements.saveBtn = document.getElementById('config-save-btn');
        _elements.eventKeySelect = document.getElementById('config-event-key');
        _elements.propertySelect = document.getElementById('config-property');
        _elements.chartTypeSelect = document.getElementById('config-chart-type');
        _elements.widgetSizeSelect = document.getElementById('config-widget-size');
        _elements.displayNameInput = document.getElementById('config-display-name');
        _elements.filtersJsonInput = document.getElementById('config-filters-json');
        _elements.filterRowsContainer = document.getElementById('filter-rows-container');
        _elements.addFilterBtn = document.getElementById('add-filter-btn');
        _elements.previewInfo = document.getElementById('preview-info');
        _elements.filterColumn = document.getElementById('filter-config-column');
    }

    /**
     * Bind event listeners
     * @private
     */
    function _bindEvents() {
        if (_elements.closeBtn) {
            _elements.closeBtn.addEventListener('click', hide);
        }

        if (_elements.cancelBtn) {
            _elements.cancelBtn.addEventListener('click', hide);
        }

        if (_elements.form) {
            _elements.form.addEventListener('submit', (e) => {
                e.preventDefault();
                _saveConfig();
            });
        }

        if (_elements.eventKeySelect) {
            _elements.eventKeySelect.addEventListener('change', (e) => {
                if (e.target.value) {
                    _loadPropertiesForEvent(e.target.value).then(() => _updateAllFilterDropdowns());
                }
                _debouncedUpdatePreview();
            });
        }

        if (_elements.propertySelect) {
            _elements.propertySelect.addEventListener('change', _debouncedUpdatePreview);
        }

        if (_elements.chartTypeSelect) {
            _elements.chartTypeSelect.addEventListener('change', (e) => {
                // Auto-set widget size to small for NumberCard
                if (e.target.value === 'NumberCard' && !_editingChartId) {
                    if (_elements.widgetSizeSelect) {
                        _elements.widgetSizeSelect.value = 'small';
                    }
                }
                _debouncedUpdatePreview();
            });
        }

        if (_elements.widgetSizeSelect) {
            _elements.widgetSizeSelect.addEventListener('change', _debouncedUpdatePreview);
        }

        if (_elements.addFilterBtn) {
            _elements.addFilterBtn.addEventListener('click', () => {
                _addFilterRow();
                _updateJsonFromUI();
            });
        }
    }

    /**
     * Show the modal for creating a new chart
     * @param {string} projectId - Project ID
     * @param {boolean} isGlobal - Whether this is for global charts
     */
    function show(projectId, isGlobal = false) {
        _currentProjectId = projectId;
        _isGlobal = isGlobal;
        _editingChartId = null;

        if (!_elements.modal) return;

        _elements.modal.classList.remove('hidden');
        _populateChartTypes();
        _populateWidgetSizes();

        // Update modal title
        const title = document.querySelector('.modal-header h3');
        if (title) {
            title.textContent = isGlobal ? "Add Comparison Chart" : "Configure Chart";
        }

        // Show property and filter sections
        if (_elements.propertySelect?.parentElement) {
            _elements.propertySelect.parentElement.style.display = 'block';
        }
        if (_elements.filterColumn) {
            _elements.filterColumn.style.display = 'flex';
        }

        // Reset form
        if (_elements.form) _elements.form.reset();
        if (_elements.widgetSizeSelect) _elements.widgetSizeSelect.value = 'normal'; // Default to normal
        if (_elements.filtersJsonInput) _elements.filtersJsonInput.value = '';
        if (_elements.filterRowsContainer) _elements.filterRowsContainer.innerHTML = '';

        if (_elements.saveBtn) {
            _elements.saveBtn.textContent = 'Save Chart';
        }

        // Load event keys
        _loadEventKeys(isGlobal ? "GLOBAL" : projectId);

        // Clear preview
        const chartRenderer = KnuckleHUB.get('ChartRenderer');
        if (chartRenderer) {
            chartRenderer.clearCanvas('preview-chart-canvas');
        }

        if (_elements.previewInfo) {
            _elements.previewInfo.textContent = 'Select an Event Key to see preview.';
        }
    }

    /**
     * Show the modal for editing an existing chart
     * @param {Object} config - Chart configuration to edit
     * @param {string} projectId - Project ID
     * @param {boolean} isGlobal - Whether this is for global charts
     */
    function edit(config, projectId, isGlobal = false) {
        show(projectId, isGlobal);
        _editingChartId = config.id;

        if (_elements.displayNameInput) {
            _elements.displayNameInput.value = config.displayName;
        }
        if (_elements.chartTypeSelect) {
            _elements.chartTypeSelect.value = config.chartType;
        }
        if (_elements.saveBtn) {
            _elements.saveBtn.textContent = 'Update Chart';
        }

        // Delay to allow event keys to load
        setTimeout(() => {
            if (_elements.eventKeySelect) {
                _elements.eventKeySelect.value = config.eventKey;
            }

            // Set widget size if it exists (default to normal if not)
            if (_elements.widgetSizeSelect) {
                _elements.widgetSizeSelect.value = config.widgetSize || 'normal';
            }

            _loadPropertiesForEvent(config.eventKey).then(() => {
                if (_elements.propertySelect) {
                    _elements.propertySelect.value = config.propertyToDisplay || '';
                }
                _rebuildUIFromJson(config.filtersJson);
                _debouncedUpdatePreview();
            });
        }, 50);
    }

    /**
     * Hide the modal
     */
    function hide() {
        if (_elements.modal) {
            _elements.modal.classList.add('hidden');
        }
        _editingChartId = null;
        _currentEventProperties = [];
    }

    /**
     * Populate chart type dropdown
     * @private
     */
    function _populateChartTypes() {
        if (!_elements.chartTypeSelect) return;

        const chartTypes = [
            { value: 'LineChart', label: 'Line Chart' },
            { value: 'BarChart', label: 'Bar Chart' },
            { value: 'StackedBarChart', label: 'Stacked Bar Chart' },
            { value: 'PieChart', label: 'Pie Chart' },
            { value: 'NumberCard', label: 'Number Card' }
        ];

        const currentSelection = _elements.chartTypeSelect.value;
        _elements.chartTypeSelect.innerHTML = '<option value="">Select Chart Type</option>';

        chartTypes.forEach(type => {
            const opt = document.createElement('option');
            opt.value = type.value;
            opt.textContent = type.label;
            _elements.chartTypeSelect.appendChild(opt);
        });

        if (currentSelection) {
            _elements.chartTypeSelect.value = currentSelection;
        }
    }

    /**
     * Populate widget size dropdown
     * @private
     */
    function _populateWidgetSizes() {
        if (!_elements.widgetSizeSelect) return;

        const widgetSizes = [
            { value: 'small', label: 'Small' },
            { value: 'normal', label: 'Normal' },
            { value: 'large', label: 'Large' }
        ];

        const currentSelection = _elements.widgetSizeSelect.value;
        _elements.widgetSizeSelect.innerHTML = '';

        widgetSizes.forEach(size => {
            const opt = document.createElement('option');
            opt.value = size.value;
            opt.textContent = size.label;
            _elements.widgetSizeSelect.appendChild(opt);
        });

        if (currentSelection) {
            _elements.widgetSizeSelect.value = currentSelection;
        }
    }

    /**
     * Load event keys for the dropdown
     * @private
     */
    async function _loadEventKeys(projectId) {
        const api = KnuckleHUB.get('API');
        if (!api) return;

        const result = await api.getEventKeys(projectId);

        if (!_elements.eventKeySelect) return;

        const selectedKey = _elements.eventKeySelect.value;
        _elements.eventKeySelect.innerHTML = '<option value="">Select Event Key</option>';

        if (result.success && result.eventKeys) {
            result.eventKeys.forEach(key => {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = key;
                _elements.eventKeySelect.appendChild(option);
            });

            if (selectedKey) {
                _elements.eventKeySelect.value = selectedKey;
            }
        }
    }

    /**
     * Load properties for a selected event
     * @private
     */
    async function _loadPropertiesForEvent(eventKey) {
        const api = KnuckleHUB.get('API');
        if (!api) return;

        const projectId = _isGlobal ? "GLOBAL" : _currentProjectId;
        const result = await api.getEventProperties(projectId, eventKey);

        if (!_elements.propertySelect) return;

        const selectedProperty = _elements.propertySelect.value;
        _elements.propertySelect.innerHTML = '<option value="">Event Count (default)</option>';
        _currentEventProperties = [];

        if (result.success && result.propertyKeys) {
            _currentEventProperties = result.propertyKeys;
            result.propertyKeys.forEach(key => {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = key;
                _elements.propertySelect.appendChild(option);
            });

            if (selectedProperty) {
                _elements.propertySelect.value = selectedProperty;
            }
        }
    }

    /**
     * Add a filter row
     * @private
     */
    function _addFilterRow(data = null) {
        if (!_elements.filterRowsContainer) return;

        const row = document.createElement('div');
        row.className = 'filter-row';

        // Property select
        const propSelect = document.createElement('select');
        propSelect.className = 'filter-prop';
        propSelect.innerHTML = '<option value="">Property...</option>';
        _currentEventProperties.forEach(prop => {
            const opt = document.createElement('option');
            opt.value = prop;
            opt.textContent = prop;
            propSelect.appendChild(opt);
        });
        if (data?.property) propSelect.value = data.property;

        // Operator select
        const opSelect = document.createElement('select');
        opSelect.className = 'filter-op';
        ['=', '!=', '>', '<', '>=', '<='].forEach(op => {
            const opt = document.createElement('option');
            opt.value = op;
            opt.textContent = op;
            opSelect.appendChild(opt);
        });
        if (data?.operator) opSelect.value = data.operator;

        // Value input
        const valInput = document.createElement('input');
        valInput.className = 'filter-val';
        valInput.type = 'text';
        valInput.placeholder = 'Value';
        if (data?.value !== undefined) valInput.value = data.value;

        // Remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-filter-btn';
        removeBtn.innerHTML = '&times;';
        removeBtn.onclick = () => {
            row.remove();
            _updateJsonFromUI();
            _debouncedUpdatePreview();
        };

        // Add change listeners
        [propSelect, opSelect, valInput].forEach(el => {
            el.addEventListener('change', () => {
                _updateJsonFromUI();
                _debouncedUpdatePreview();
            });
        });

        row.appendChild(propSelect);
        row.appendChild(opSelect);
        row.appendChild(valInput);
        row.appendChild(removeBtn);
        _elements.filterRowsContainer.appendChild(row);
    }

    /**
     * Update all filter dropdowns with current properties
     * @private
     */
    function _updateAllFilterDropdowns() {
        const dropdowns = document.querySelectorAll('.filter-prop');
        dropdowns.forEach(dd => {
            const currentVal = dd.value;
            dd.innerHTML = '<option value="">Property...</option>';
            _currentEventProperties.forEach(prop => {
                const opt = document.createElement('option');
                opt.value = prop;
                opt.textContent = prop;
                dd.appendChild(opt);
            });
            dd.value = currentVal;
        });
    }

    /**
     * Update hidden JSON input from UI
     * @private
     */
    function _updateJsonFromUI() {
        const rows = document.querySelectorAll('.filter-row');
        const filters = [];

        rows.forEach(row => {
            const prop = row.querySelector('.filter-prop').value;
            const op = row.querySelector('.filter-op').value;
            let val = row.querySelector('.filter-val').value;

            if (prop && op && val !== '') {
                if (val.toLowerCase() === 'true') val = true;
                else if (val.toLowerCase() === 'false') val = false;
                else if (!isNaN(val) && val.trim() !== '') val = Number(val);

                filters.push({ property: prop, operator: op, value: val });
            }
        });

        const json = filters.length > 0 ? JSON.stringify(filters) : '';
        if (_elements.filtersJsonInput) {
            _elements.filtersJsonInput.value = json;
        }
    }

    /**
     * Rebuild filter UI from JSON string
     * @private
     */
    function _rebuildUIFromJson(jsonString) {
        if (_elements.filterRowsContainer) {
            _elements.filterRowsContainer.innerHTML = '';
        }

        if (!jsonString) return;

        try {
            const filters = JSON.parse(jsonString);
            if (Array.isArray(filters)) {
                filters.forEach(f => _addFilterRow(f));
            }
        } catch (e) {
            console.error('Error parsing filters JSON:', e);
        }
    }

    /**
     * Debounced preview update
     * @private
     */
    function _debouncedUpdatePreview() {
        if (_previewDebounceTimer) {
            clearTimeout(_previewDebounceTimer);
        }
        _previewDebounceTimer = setTimeout(_updatePreview, 300);
    }

    /**
     * Update the preview chart
     * @private
     */
    async function _updatePreview() {
        const eventKey = _elements.eventKeySelect?.value;
        const chartType = _elements.chartTypeSelect?.value;

        const chartRenderer = KnuckleHUB.get('ChartRenderer');

        if (!eventKey || !chartType) {
            if (_elements.previewInfo) {
                _elements.previewInfo.textContent = 'Select settings to preview.';
            }
            if (chartRenderer) {
                chartRenderer.clearCanvas('preview-chart-canvas');
            }
            return;
        }

        if (_elements.previewInfo) {
            _elements.previewInfo.textContent = 'Loading preview...';
        }

        if (chartRenderer) {
            chartRenderer.clearCanvas('preview-chart-canvas');
        }

        const api = KnuckleHUB.get('API');
        if (!api) return;

        const result = await api.getChartData({
            projectId: _isGlobal ? "GLOBAL" : _currentProjectId,
            eventKey: eventKey,
            propertyName: _elements.propertySelect?.value || '',
            chartType: chartType,
            days: document.getElementById('date-range')?.value || 30,
            filtersJson: _elements.filtersJsonInput?.value || '',
            useCache: false
        });

        if (result.success && result.chartData && chartRenderer) {
            chartRenderer.render('preview-chart-canvas', result.chartData, chartType, {
                displayName: 'Preview',
                propertyToDisplay: _elements.propertySelect?.value || '',
                widgetSize: _elements.widgetSizeSelect?.value || 'normal'
            });
            if (_elements.previewInfo) {
                _elements.previewInfo.textContent = `Preview: ${eventKey}`;
            }
        } else {
            if (_elements.previewInfo) {
                _elements.previewInfo.textContent = 'No data available for preview.';
            }
        }
    }

    /**
     * Save the chart configuration
     * @private
     */
    async function _saveConfig() {
        const toast = KnuckleHUB.get('Toast');
        const api = KnuckleHUB.get('API');

        if (!api) return;

        const isNew = _editingChartId === null;

        const configData = {
            id: _editingChartId,
            projectId: _isGlobal ? "GLOBAL" : _currentProjectId,
            eventKey: _elements.eventKeySelect?.value,
            displayName: _elements.displayNameInput?.value,
            chartType: _elements.chartTypeSelect?.value,
            propertyToDisplay: _elements.propertySelect?.value || '',
            widgetSize: _elements.widgetSizeSelect?.value || 'normal', // Default to normal
            filtersJson: _elements.filtersJsonInput?.value || '',
            isEnabled: true
        };

        const result = await api.saveChartConfig(configData);

        if (result.success) {
            configData.id = result.configId;

            if (toast) {
                toast.success(`Chart configuration ${isNew ? 'saved' : 'updated'}!`);
            }

            hide();

            if (_onSave) {
                _onSave(configData, isNew);
            }
        } else {
            if (toast) {
                toast.error('Failed to save chart configuration');
            }
        }
    }

    /**
     * Get the current editing chart ID
     * @returns {string|null}
     */
    function getEditingChartId() {
        return _editingChartId;
    }

    // Public API
    return {
        init,
        show,
        edit,
        hide,
        getEditingChartId
    };
})());