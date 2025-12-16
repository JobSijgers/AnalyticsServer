/**
 * Chart Renderer Service
 * Handles all chart rendering using Chart.js.
 * Provides a clean API for creating various chart types.
 */
KnuckleHUB.register('ChartRenderer', (function() {
    'use strict';

    const _activeCharts = {};

    const _baseColors = [
        'rgb(84, 112, 198)',
        'rgb(145, 204, 117)',
        'rgb(250, 200, 88)',
        'rgb(238, 102, 102)',
        'rgb(115, 192, 222)',
        'rgb(59, 162, 114)',
        'rgb(252, 132, 82)',
        'rgb(154, 96, 180)',
        'rgb(234, 124, 204)'
    ];

    function formatNumber(num) {
        const numberValue = Number(num);
        if (isNaN(numberValue)) return String(num);
        return Math.round(numberValue).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }

    // Helper to format Seconds into M:SS.s
    function formatTime(totalSeconds) {
        if (isNaN(totalSeconds)) return "0:00";

        const minutes = Math.floor(totalSeconds / 60);
        const seconds = Math.floor(totalSeconds % 60);

        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    function generateColors(count) {
        if (count <= _baseColors.length) return _baseColors.slice(0, count);

        const colors = [..._baseColors];
        for (let i = _baseColors.length; i < count; i++) {
            const hue = (i * 137.5) % 360;
            colors.push(`hsl(${hue}, 70%, 50%)`);
        }
        return colors;
    }

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

    function destroyChart(canvasId) {
        if (_activeCharts[canvasId]) {
            _activeCharts[canvasId].destroy();
            delete _activeCharts[canvasId];
        }
    }

    /**
     * Main Render Function
     */
    function render(canvasId, chartData, chartType, config = null) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const container = canvas.parentElement;

        let newWidth = container.clientWidth;
        let newHeight = container.clientHeight;

        // Auto-size adjustment for Number Cards
        if ((chartType === 'NumberCard' || chartType === 'AverageNumberCard') && newHeight === 0) {
            newHeight = 150;
            if (newWidth === 0) newWidth = container.offsetWidth > 0 ? container.offsetWidth : 300;
        }

        canvas.width = newWidth;
        canvas.height = newHeight;

        destroyChart(canvasId);

        // --- Handle Number Cards (Sum and Average) ---
        if (chartType === 'NumberCard' || chartType === 'AverageNumberCard') {
            _renderNumberCard(ctx, chartData, config, canvas.width, canvas.height, chartType);
            return;
        }

        // --- Handle Standard Charts (Line, Bar, Pie, etc.) ---
        const dataArray = chartData.data || [];
        const hasData = dataArray.length > 0;

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
     * Render Logic for Number/Average Cards
     */
    function _renderNumberCard(ctx, data, config, width, height, chartType = 'NumberCard') {
        ctx.clearRect(0, 0, width, height);

        const cardData = data?.data;
        if (!cardData) {
            ctx.font = '16px Arial';
            ctx.fillStyle = '#aaa';
            ctx.textAlign = 'center';
            ctx.fillText('No data', width / 2, height / 2);
            return;
        }

        let valueToDisplay = 0;
        const isAverage = chartType === 'AverageNumberCard';

        if (isAverage) {
            valueToDisplay = cardData.avgValue || 0;
        } else {
            const showSum = cardData.sumValue !== undefined && cardData.sumValue !== 0;
            valueToDisplay = showSum ? cardData.sumValue : cardData.total;
        }

        let labelToDisplay = config?.propertyToDisplay || config?.displayName || 'Total Events';

        // Auto-append "(Avg)" if not present in the name and it's an average card
        if (isAverage) {
            labelToDisplay = 'Average ' + labelToDisplay;
        }

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

        // --- Formatting Logic ---
        let formattedValue;

        // Check the 'format' field from the Backend response
        if (data.format === 'time') {
            formattedValue = formatTime(valueToDisplay);
        }
        else {
            // Fallback: Standard formatting
            if (isAverage) {
                // Show decimals for averages (e.g., 10.55)
                formattedValue = Number(valueToDisplay).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
            } else {
                // Integers for counts
                formattedValue = formatNumber(valueToDisplay);
            }
        }

        ctx.fillText(formattedValue, width / 2, height / 2);

        ctx.fillStyle = '#aaa';
        ctx.font = '16px Roboto, sans-serif';
        ctx.fillText(labelToDisplay, width / 2, height / 2 + 30);
    }

    // --- Chart.js Configuration Building ---

    function _renderChartJsChart(ctx, chartData, chartType, canvasId, config, forceMultiSeries = false) {
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

    function _buildMultiSeriesConfig(chartData, chartType, days) {
        const seriesData = chartData.data || [];
        const colors = generateColors(seriesData.length);
        let labels = (seriesData.length > 0 && seriesData[0].data)
            ? seriesData[0].data.map(p => p.date)
            : [];

        const isStackedBar = chartType === 'StackedBarChart';
        const mainType = isStackedBar ? 'bar' : 'line';

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

    function _buildCompressedMultiSeriesConfig(seriesData, colors, labels, isStackedBar, mainType) {
        const targetPoints = Math.min(30, labels.length);
        const compressionFactor = Math.ceil(labels.length / targetPoints);
        const compressedLabels = [];

        const compressedDatasets = seriesData.map(series => {
            const compressedData = [];
            for (let i = 0; i < series.data.length; i += compressionFactor) {
                const chunk = series.data.slice(i, i + compressionFactor);
                // Sum instead of average
                const sum = chunk.reduce((total, item) => total + (item.value || item.count || 0), 0);
                compressedData.push(sum);

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

                // Sum instead of average
                const totalValue = dataChunk.reduce((sum, val) => sum + val, 0);
                compressedData.push(Math.round(totalValue));

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
                animation: false,
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            title: (context) => {
                                const label = context[0].label;
                                if (label.includes(' - ')) return `${label} (period total)`;
                                return isCompressed ? `${label} (total)` : label;
                            },
                            label: (context) => {
                                const value = context.parsed.y;
                                return isCompressed ? `${labelText}: ${value} (total)` : `${labelText}: ${value}`;
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

    function _buildCategoricalConfig(chartData, chartType, config) {
        let rawData = chartData.data || [];

        // --- NEW: Sorting Logic ---
        if (config && config.sortOrder) {
            // Clone array to avoid mutating original
            rawData = [...rawData];

            if (config.sortOrder === 'highest') {
                // Sort by Value (High to Low)
                rawData.sort((a, b) => {
                    const valA = a.value !== undefined ? a.value : (a.count || 0);
                    const valB = b.value !== undefined ? b.value : (b.count || 0);
                    return valB - valA;
                });
            } else if (config.sortOrder === 'alpha') {
                // Sort by Label (Alpha A-Z), handling numbers naturally
                rawData.sort((a, b) => {
                    const labelA = String(a.label || a.key || a.date || '');
                    const labelB = String(b.label || b.key || b.date || '');
                    return labelA.localeCompare(labelB, undefined, { numeric: true, sensitivity: 'base' });
                });
            }
        }
        // --------------------------

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
                    animation: false,
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
                animation: false,
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

    function _getTimeSeriesOptions(isStacked, maxTicksLimit = 15) {
        return {
            animation: false,
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

    return {
        render,
        clearCanvas,
        destroyChart,
        generateColors,
        formatNumber
    };
})());