/**
 * Chart Renderer Service
 * Handles all chart rendering using Chart.js.
 * Provides a clean API for creating various chart types.
 */
KnuckleHUB.register('ChartRenderer', (function() {
    'use strict';

    // Track active charts for cleanup
    const _activeCharts = {};

    // Chart color palette
    const _baseColors = [
        'rgb(218, 135, 39)', 'rgb(76, 175, 80)', 'rgb(33, 150, 243)', 'rgb(156, 39, 176)',
        'rgb(255, 152, 0)', 'rgb(244, 67, 54)', 'rgb(0, 188, 212)', 'rgb(103, 58, 183)',
        'rgb(255, 87, 34)', 'rgb(205, 220, 57)'
    ];

    /**
     * Format a number with dots as thousands separator
     * @param {number} num - Number to format
     * @returns {string}
     */
    function formatNumber(num) {
        const numberValue = Number(num);
        if (isNaN(numberValue)) return String(num);
        return Math.round(numberValue).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }

    /**
     * Generate chart colors
     * @param {number} count - Number of colors needed
     * @returns {string[]}
     */
    function generateColors(count) {
        if (count <= _baseColors.length) return _baseColors.slice(0, count);

        const colors = [..._baseColors];
        for (let i = _baseColors.length; i < count; i++) {
            const hue = (i * 137.5) % 360;
            colors.push(`hsl(${hue}, 70%, 50%)`);
        }
        return colors;
    }

    /**
     * Clear a canvas and destroy any existing chart
     * @param {string} canvasId - Canvas element ID
     */
    function clearCanvas(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (_activeCharts[canvasId]) {
            _activeCharts[canvasId].destroy();
            delete _activeCharts[canvasId];
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    /**
     * Destroy a specific chart
     * @param {string} canvasId - Canvas element ID
     */
    function destroyChart(canvasId) {
        if (_activeCharts[canvasId]) {
            _activeCharts[canvasId].destroy();
            delete _activeCharts[canvasId];
        }
    }

    /**
     * Main render function
     * @param {string} canvasId - Canvas element ID
     * @param {Object} chartData - Chart data from API
     * @param {string} chartType - Type of chart
     * @param {Object} config - Chart configuration
     */
    function render(canvasId, chartData, chartType, config = null) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const container = canvas.parentElement;

        let newWidth = container.clientWidth;
        let newHeight = container.clientHeight;

        if (chartType === 'NumberCard' && newHeight === 0) {
            newHeight = 150;
            if (newWidth === 0) newWidth = container.offsetWidth > 0 ? container.offsetWidth : 300;
        }

        canvas.width = newWidth;
        canvas.height = newHeight;

        // Destroy existing chart
        destroyChart(canvasId);

        if (chartType === 'NumberCard') {
            _renderNumberCard(ctx, chartData, config, canvas.width, canvas.height);
            return;
        }

        const dataArray = chartData.data || [];
        const hasData = dataArray.length > 0;

        // Smart Detection: Check if data is truly multi-series
        const isActuallyMultiSeries = chartData.type === 'multiLine' ||
            (hasData && dataArray[0].hasOwnProperty('data') && Array.isArray(dataArray[0].data));

        let isMeaningful = false;
        const safeType = (chartType === 'AreaChart') ? 'LineChart' : chartType;

        if (hasData) {
            if (safeType === 'LineChart' || (safeType === 'StackedBarChart' && isActuallyMultiSeries)) {
                if (isActuallyMultiSeries) {
                    isMeaningful = dataArray.some(series =>
                        series.data && series.data.length > 0 &&
                        series.data.some(p => p.value > 0 || p.count > 0)
                    );
                } else {
                    const valueField = dataArray.some(item => item.value !== undefined && item.value !== 0)
                        ? 'value' : 'count';
                    isMeaningful = dataArray.some(item => item[valueField] > 0);
                }
            } else {
                isMeaningful = dataArray.some(item => item.value > 0 || item.count > 0);
            }
        }

        if (isMeaningful) {
            _renderChartJsChart(ctx, chartData, safeType, canvasId, config, isActuallyMultiSeries);
        } else {
            ctx.font = '16px Arial';
            ctx.fillStyle = '#aaa';
            ctx.textAlign = 'center';
            ctx.fillText('No meaningful data found.', canvas.width / 2, canvas.height / 2);
        }
    }

    /**
     * Render a number card
     * @private
     */
    function _renderNumberCard(ctx, data, config, width, height) {
        ctx.clearRect(0, 0, width, height);

        const cardData = data?.data;
        if (!cardData) {
            ctx.font = '16px Arial';
            ctx.fillStyle = '#aaa';
            ctx.textAlign = 'center';
            ctx.fillText('No data', width / 2, height / 2);
            return;
        }

        const showSum = cardData.sumValue !== undefined && cardData.sumValue !== 0;
        const valueToDisplay = showSum ? cardData.sumValue : cardData.total;
        let labelToDisplay = config?.propertyToDisplay || config?.displayName || 'Total Events';

        if (valueToDisplay === 0 && cardData.total === 0) {
            ctx.font = '16px Arial';
            ctx.fillStyle = '#aaa';
            ctx.textAlign = 'center';
            ctx.fillText('No events', width / 2, height / 2);
            return;
        }

        ctx.fillStyle = '#eee';
        ctx.font = 'bold 48px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(formatNumber(valueToDisplay), width / 2, height / 2);

        ctx.fillStyle = '#aaa';
        ctx.font = '16px Roboto, sans-serif';
        ctx.fillText(labelToDisplay, width / 2, height / 2 + 30);
    }

    /**
     * Render a Chart.js chart
     * @private
     */
    function _renderChartJsChart(ctx, chartData, chartType, canvasId, config, forceMultiSeries = false) {
        // Handle LineChart integer series fix
        if (chartType === 'LineChart' && (chartData.type === 'multiLine' || forceMultiSeries) &&
            chartData.data && chartData.data.length > 0) {
            const isIntegerSeries = chartData.data.every(s => s.label && /^-?\d+$/.test(s.label));
            if (isIntegerSeries) {
                chartData = _aggregateIntegerSeries(chartData);
                forceMultiSeries = false;
            }
        }

        const isMultiSeries = forceMultiSeries || chartData.type === 'multiLine';
        if (chartType === 'AreaChart') chartType = 'LineChart';

        const dateRangeSelect = document.getElementById('date-range');
        const days = dateRangeSelect ? parseInt(dateRangeSelect.value) || 30 : 30;

        let chartConfig;

        if (chartType === 'LineChart' || (chartType === 'StackedBarChart' && isMultiSeries)) {
            chartConfig = isMultiSeries
                ? _buildMultiSeriesConfig(chartData, chartType, days)
                : _buildSingleLineConfig(chartData, days);
        } else {
            chartConfig = _buildCategoricalConfig(chartData, chartType, config);
        }

        _activeCharts[canvasId] = new Chart(ctx, chartConfig);
    }

    /**
     * Aggregate integer series data
     * @private
     */
    function _aggregateIntegerSeries(chartData) {
        const aggregated = {};
        chartData.data.forEach(series => {
            const factor = parseInt(series.label, 10);
            if (!isNaN(factor) && series.data) {
                series.data.forEach(p => {
                    const date = p.date;
                    const count = p.count !== undefined ? p.count : (p.value || 0);
                    if (!aggregated[date]) aggregated[date] = 0;
                    aggregated[date] += factor * count;
                });
            }
        });

        return {
            ...chartData,
            type: 'line',
            data: Object.keys(aggregated)
                .sort((a, b) => new Date(a) - new Date(b))
                .map(d => ({ date: d, value: aggregated[d] }))
        };
    }

    /**
     * Build multi-series chart config
     * @private
     */
    function _buildMultiSeriesConfig(chartData, chartType, days) {
        const seriesData = chartData.data || [];
        const colors = generateColors(seriesData.length);
        let labels = (seriesData.length > 0 && seriesData[0].data)
            ? seriesData[0].data.map(p => p.date)
            : [];

        const isStackedBar = chartType === 'StackedBarChart';
        const mainType = isStackedBar ? 'bar' : 'line';

        // Check if compression is needed
        if (days > 30 && labels.length > 30) {
            return _buildCompressedMultiSeriesConfig(seriesData, colors, labels, isStackedBar, mainType);
        }

        const datasets = seriesData.map((series, index) => ({
            label: series.label,
            data: series.data ? series.data.map(d => d.value || d.count || 0) : [],
            borderColor: colors[index],
            backgroundColor: colors[index],
            borderWidth: 2,
            fill: false,
            tension: isStackedBar ? 0 : 0.3,
            pointRadius: isStackedBar ? 0 : 2
        }));

        return {
            type: mainType,
            data: { labels, datasets },
            options: _getTimeSeriesOptions(isStackedBar)
        };
    }

    /**
     * Build compressed multi-series config
     * @private
     */
    function _buildCompressedMultiSeriesConfig(seriesData, colors, labels, isStackedBar, mainType) {
        const targetPoints = Math.min(30, labels.length);
        const compressionFactor = Math.ceil(labels.length / targetPoints);
        const compressedLabels = [];

        const compressedDatasets = seriesData.map(series => {
            const compressedData = [];
            for (let i = 0; i < series.data.length; i += compressionFactor) {
                const chunk = series.data.slice(i, i + compressionFactor);
                const sum = chunk.reduce((total, item) => total + (item.value || item.count || 0), 0);
                const average = chunk.length > 0 ? Math.round(sum / chunk.length) : 0;
                compressedData.push(average);

                if (chunk.length > 0 && compressedLabels.length < Math.ceil(series.data.length / compressionFactor)) {
                    if (chunk.length === 1) {
                        compressedLabels.push(chunk[0].date);
                    } else {
                        const firstDate = chunk[0].date;
                        const lastDate = chunk[chunk.length - 1].date;
                        compressedLabels.push(firstDate === lastDate ? firstDate : `${firstDate} - ${lastDate}`);
                    }
                }
            }
            return compressedData;
        });

        const datasets = seriesData.map((series, index) => ({
            label: series.label,
            data: compressedDatasets[index] || [],
            borderColor: colors[index],
            backgroundColor: colors[index],
            borderWidth: 2,
            fill: false,
            tension: isStackedBar ? 0 : 0.1,
            pointRadius: 4,
            pointHoverRadius: 6
        }));

        return {
            type: mainType,
            data: { labels: compressedLabels, datasets },
            options: _getTimeSeriesOptions(isStackedBar, Math.min(15, compressedLabels.length))
        };
    }

    /**
     * Build single line chart config
     * @private
     */
    function _buildSingleLineConfig(chartData, days) {
        let labels = chartData.data?.map(item => item.date || item.label || item.key) || [];
        let dataValues = chartData.data?.map(item =>
            item.value !== undefined ? item.value : (item.count || 0)
        ) || [];

        const labelText = 'Event Count';
        let isCompressed = false;

        if (days > 30 && labels.length > 30) {
            isCompressed = true;
            const targetPoints = Math.min(30, labels.length);
            const compressionFactor = Math.ceil(labels.length / targetPoints);
            const compressedLabels = [];
            const compressedData = [];

            for (let i = 0; i < labels.length; i += compressionFactor) {
                const dataChunk = dataValues.slice(i, i + compressionFactor);
                const labelChunk = labels.slice(i, i + compressionFactor);
                const averageValue = dataChunk.reduce((sum, val) => sum + val, 0) / dataChunk.length;
                compressedData.push(Math.round(averageValue));

                if (labelChunk.length > 0) {
                    if (labelChunk.length === 1) {
                        compressedLabels.push(labelChunk[0]);
                    } else {
                        const firstLabel = labelChunk[0];
                        const lastLabel = labelChunk[labelChunk.length - 1];
                        compressedLabels.push(firstLabel === lastLabel ? firstLabel : `${firstLabel} - ${lastLabel}`);
                    }
                }
            }
            labels = compressedLabels;
            dataValues = compressedData;
        }

        return {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: labelText,
                    data: dataValues,
                    backgroundColor: 'rgb(218, 135, 39)',
                    borderColor: 'rgb(218, 135, 39)',
                    borderWidth: 2,
                    fill: false,
                    tension: isCompressed ? 0.1 : 0.3,
                    pointRadius: isCompressed ? 4 : 2,
                    pointHoverRadius: isCompressed ? 6 : 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            title: (context) => {
                                const label = context[0].label;
                                if (label.includes(' - ')) return `${label} (period average)`;
                                return isCompressed ? `${label} (average)` : label;
                            },
                            label: (context) => {
                                const value = context.parsed.y;
                                return isCompressed ? `${labelText}: ${value} (avg)` : `${labelText}: ${value}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        ticks: { color: '#eee' }
                    },
                    x: {
                        type: 'category',
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        ticks: { color: '#eee', maxTicksLimit: Math.min(15, labels.length) }
                    }
                }
            }
        };
    }

    /**
     * Build categorical chart config (Bar, Pie, Stacked)
     * @private
     */
    function _buildCategoricalConfig(chartData, chartType, config) {
        const rawData = chartData.data || [];

        if (chartType === 'StackedBarChart') {
            const colors = generateColors(rawData.length);
            const datasets = rawData.map((item, index) => ({
                label: item.label || item.key || item.date,
                data: [item.value !== undefined ? item.value : (item.count || 0)],
                backgroundColor: colors[index],
                borderColor: '#2a2a2a',
                borderWidth: 2
            }));

            return {
                type: 'bar',
                data: {
                    labels: [config?.propertyToDisplay || 'Total Distribution'],
                    datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: true, position: 'right', labels: { color: '#eee', boxWidth: 10 } }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            stacked: true,
                            grid: { color: 'rgba(255,255,255,0.1)' },
                            ticks: { color: '#eee' }
                        },
                        x: {
                            stacked: true,
                            grid: { color: 'rgba(255,255,255,0.1)' },
                            ticks: { color: '#eee' }
                        }
                    }
                }
            };
        }

        // Standard Bar or Pie Chart
        const labels = rawData.map(item => item.label || item.key || item.date);
        const values = rawData.map(item => item.value !== undefined ? item.value : (item.count || 0));

        return {
            type: (chartType === 'BarChart') ? 'bar' : chartType.toLowerCase().replace('chart', ''),
            data: {
                labels,
                datasets: [{
                    label: 'Count',
                    data: values,
                    backgroundColor: generateColors(values.length),
                    borderColor: '#2a2a2a',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: chartType !== 'BarChart',
                        position: 'right',
                        labels: { color: '#eee', boxWidth: 10 }
                    }
                },
                scales: (chartType === 'BarChart') ? {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        ticks: { color: '#eee' }
                    },
                    x: {
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        ticks: { color: '#eee' }
                    }
                } : { y: { display: false }, x: { display: false } }
            }
        };
    }

    /**
     * Get time series chart options
     * @private
     */
    function _getTimeSeriesOptions(isStacked, maxTicksLimit = 15) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: true, labels: { color: '#eee', boxWidth: 10 } },
                tooltip: { mode: 'index', intersect: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    stacked: isStacked,
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { color: '#eee' }
                },
                x: {
                    type: 'category',
                    stacked: isStacked,
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { color: '#eee', maxTicksLimit }
                }
            }
        };
    }

    // Public API
    return {
        render,
        clearCanvas,
        destroyChart,
        generateColors,
        formatNumber
    };
})());