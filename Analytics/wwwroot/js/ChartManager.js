class ChartManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.pieChart = null;
        this.activeCharts = {};
    }

    _formatNumberWithDots(num) {
        const numberValue = Number(num);
        if (isNaN(numberValue)) return String(num);
        return Math.round(numberValue).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }
    
    generateChartColors(count) {
        const baseColors = [
            'rgb(218, 135, 39)', 'rgb(76, 175, 80)', 'rgb(33, 150, 243)', 'rgb(156, 39, 176)',
            'rgb(255, 152, 0)', 'rgb(244, 67, 54)', 'rgb(0, 188, 212)', 'rgb(103, 58, 183)',
            'rgb(255, 87, 34)', 'rgb(205, 220, 57)'
        ];
        if (count <= baseColors.length) return baseColors.slice(0, count);
        const colors = [...baseColors];
        for (let i = baseColors.length; i < count; i++) {
            const hue = (i * 137.5) % 360;
            colors.push(`hsl(${hue}, 70%, 50%)`);
        }
        return colors;
    }

    clearCanvas(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (this.activeCharts[canvasId]) {
            this.activeCharts[canvasId].destroy();
            delete this.activeCharts[canvasId];
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    renderChart(canvasId, chartData, chartType, config = null) {
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
        if (this.activeCharts[canvasId]) {
            this.activeCharts[canvasId].destroy();
            delete this.activeCharts[canvasId];
        }
        if (chartType === 'NumberCard') {
            this.renderNumberCard(ctx, chartData, config, canvas.width, canvas.height);
        } else {
            const dataArray = chartData.data || [];
            const hasData = dataArray.length > 0;

            // Smart Detection: Check if data is truly multi-series (time series)
            // This handles cases where backend sends time-series but forgets the 'multiLine' type flag
            const isActuallyMultiSeries = chartData.type === 'multiLine' ||
                (hasData && dataArray[0].hasOwnProperty('data') && Array.isArray(dataArray[0].data));

            let isMeaningful = false;
            const safeType = (chartType === 'AreaChart') ? 'LineChart' : chartType;

            if (hasData) {
                if (safeType === 'LineChart' || (safeType === 'StackedBarChart' && isActuallyMultiSeries)) {
                    if (isActuallyMultiSeries) {
                        isMeaningful = dataArray.some(series => series.data && series.data.length > 0 && series.data.some(p => p.value > 0 || p.count > 0));
                    } else {
                        const valueField = dataArray.some(item => item.value !== undefined && item.value !== 0) ? 'value' : 'count';
                        isMeaningful = dataArray.some(item => item[valueField] > 0);
                    }
                } else {
                    isMeaningful = dataArray.some(item => item.value > 0 || item.count > 0);
                }
            }
            if (isMeaningful) {
                this.renderChartJsChart(ctx, chartData, safeType, canvasId, config, isActuallyMultiSeries);
            } else {
                ctx.font = '16px Arial';
                ctx.fillStyle = '#aaa';
                ctx.textAlign = 'center';
                ctx.fillText('No meaningful data found.', canvas.width / 2, canvas.height / 2);
            }
        }
    }

    renderNumberCard(ctx, data, config, width, height) {
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
        ctx.fillText(this._formatNumberWithDots(valueToDisplay), width / 2, height / 2);
        ctx.fillStyle = '#aaa';
        ctx.font = '16px Roboto, sans-serif';
        ctx.fillText(labelToDisplay, width / 2, height / 2 + 30);
    }

    renderChartJsChart(ctx, chartData, chartType, canvasId, config, forceMultiSeries = false) {
        // Handle LineChart integer series fix
        if (chartType === 'LineChart' && (chartData.type === 'multiLine' || forceMultiSeries) && chartData.data && chartData.data.length > 0) {
            const isIntegerSeries = chartData.data.every(s => s.label && /^-?\d+$/.test(s.label));
            if (isIntegerSeries) {
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
                chartData.data = Object.keys(aggregated).sort((a, b) => new Date(a) - new Date(b)).map(d => ({
                    date: d,
                    value: aggregated[d]
                }));
                chartData.type = 'line';
                forceMultiSeries = false; // It is now flat
            }
        }

        let chartConfig;
        const isMultiSeries = forceMultiSeries || chartData.type === 'multiLine';
        if (chartType === 'AreaChart') chartType = 'LineChart';

        const dateRangeSelect = document.getElementById('date-range');
        const days = dateRangeSelect ? parseInt(dateRangeSelect.value) || 30 : 30;

        let isCompressed = false;
        let compressionFactor = 1;

        if (chartType === 'LineChart' || (chartType === 'StackedBarChart' && isMultiSeries)) {
            // --- TIME SERIES / MULTI-SERIES DATA HANDLING ---
            if (isMultiSeries) {
                const seriesData = chartData.data || [];
                const colors = this.generateChartColors(seriesData.length);

                let labels = (seriesData.length > 0 && seriesData[0].data)
                    ? seriesData[0].data.map(p => p.date)
                    : [];

                if (days > 30 && labels.length > 30) {
                    isCompressed = true;
                    const targetPoints = Math.min(30, labels.length);
                    compressionFactor = Math.ceil(labels.length / targetPoints);
                    const compressedLabels = [];
                    const compressedDatasets = seriesData.map(series => {
                        const compressedData = [];
                        for (let i = 0; i < series.data.length; i += compressionFactor) {
                            const chunk = series.data.slice(i, i + compressionFactor);
                            const sum = chunk.reduce((total, item) => total + (item.value || item.count || 0), 0);
                            const average = chunk.length > 0 ? Math.round(sum / chunk.length) : 0;
                            compressedData.push(average);
                            if (chunk.length > 0) {
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
                    labels = compressedLabels;

                    const isStackedBar = chartType === 'StackedBarChart';
                    const mainType = isStackedBar ? 'bar' : 'line';

                    const datasets = seriesData.map((series, index) => ({
                        label: series.label,
                        data: compressedDatasets[index] || [],
                        borderColor: colors[index],
                        backgroundColor: colors[index],
                        borderWidth: 2,
                        fill: false,
                        tension: isStackedBar ? 0 : 0.1,
                        pointRadius: isCompressed ? 4 : (isStackedBar ? 0 : 2),
                        pointHoverRadius: isCompressed ? 6 : 4
                    }));

                    chartConfig = {
                        type: mainType,
                        data: { labels: labels, datasets: datasets },
                        options: {
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
                                    stacked: isStackedBar,
                                    grid: { color: 'rgba(255,255,255,0.1)' },
                                    ticks: { color: '#eee' }
                                },
                                x: {
                                    type: 'category',
                                    stacked: isStackedBar,
                                    grid: { color: 'rgba(255,255,255,0.1)' },
                                    ticks: { color: '#eee', maxTicksLimit: Math.min(15, labels.length) }
                                }
                            }
                        }
                    };
                } else {
                    const isStackedBar = chartType === 'StackedBarChart';
                    const mainType = isStackedBar ? 'bar' : 'line';
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

                    chartConfig = {
                        type: mainType,
                        data: { labels: labels, datasets: datasets },
                        options: {
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
                                    stacked: isStackedBar,
                                    grid: { color: 'rgba(255,255,255,0.1)' },
                                    ticks: { color: '#eee' }
                                },
                                x: {
                                    type: 'category',
                                    stacked: isStackedBar,
                                    grid: { color: 'rgba(255,255,255,0.1)' },
                                    ticks: { color: '#eee' }
                                }
                            }
                        }
                    };
                }
            } else {
                // Single Line Chart (Compressed logic)
                let labels = chartData.data?.map(item => item.date || item.label || item.key) || [];
                let dataValues = chartData.data?.map(item => item.value !== undefined ? item.value : (item.count || 0)) || [];
                const labelText = 'Event Count';

                if (days > 30 && labels.length > 30) {
                    isCompressed = true;
                    const targetPoints = Math.min(30, labels.length);
                    compressionFactor = Math.ceil(labels.length / targetPoints);
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

                chartConfig = {
                    type: 'line',
                    data: {
                        labels: labels,
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
                            y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#eee' } },
                            x: { type: 'category', grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#eee', maxTicksLimit: Math.min(15, labels.length) } }
                        }
                    }
                };
            }
        } else {
            // --- SIMPLE CATEGORICAL DATA HANDLING ---
            // If code reaches here, the data DEFINITELY has no dates, just totals.
            const rawData = chartData.data || [];

            if (chartType === 'StackedBarChart') {
                // Force "Stacked" look for totals:
                // Creates a single column (or multiple if configured differently) showing the breakdown.
                // Since there are no dates, we can only stack the categories themselves.
                const colors = this.generateChartColors(rawData.length);
                const datasets = rawData.map((item, index) => ({
                    label: item.label || item.key || item.date,
                    data: [item.value !== undefined ? item.value : (item.count || 0)],
                    backgroundColor: colors[index],
                    borderColor: '#2a2a2a',
                    borderWidth: 2
                }));

                chartConfig = {
                    type: 'bar',
                    data: {
                        labels: [config?.propertyToDisplay || 'Total Distribution'],
                        datasets: datasets
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
            } else {
                // Standard Side-by-Side Bar Chart
                const labels = rawData.map(item => item.label || item.key || item.date);
                const values = rawData.map(item => item.value !== undefined ? item.value : (item.count || 0));

                chartConfig = {
                    type: (chartType === 'BarChart') ? 'bar' : chartType.toLowerCase().replace('chart', ''),
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Count',
                            data: values,
                            backgroundColor: this.generateChartColors(values.length),
                            borderColor: '#2a2a2a',
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: (chartType === 'BarChart') ? {
                            y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#eee' } },
                            x: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#eee' } }
                        } : { y: { display: false }, x: { display: false } }
                    }
                };
            }
        }
        this.activeCharts[canvasId] = new Chart(ctx, chartConfig);
    }
}