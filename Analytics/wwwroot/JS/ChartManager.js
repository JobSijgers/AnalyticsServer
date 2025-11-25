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

    createPropertyDistributionChart() {
        const canvas = document.getElementById('properties-chart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const container = canvas.parentElement;
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        if (this.pieChart) this.pieChart.destroy();
        if (this.activeCharts['properties-chart']) {
            this.activeCharts['properties-chart'].destroy();
            delete this.activeCharts['properties-chart'];
        }
        if (!this.dashboard.currentData || !this.dashboard.currentData.topProperties || this.dashboard.currentData.topProperties.length === 0) {
            ctx.font = '16px Arial';
            ctx.fillStyle = '#aaa';
            ctx.textAlign = 'center';
            ctx.fillText('No property data available', canvas.width / 2, canvas.height / 2);
            return;
        }
        const labels = this.dashboard.currentData.topProperties.map(prop =>
            this.dashboard.truncateText(prop.Key || prop.key || 'Unknown', 15)
        );
        const data = this.dashboard.currentData.topProperties.map(prop => prop.Count || prop.count || 0);
        const total = data.reduce((sum, value) => sum + value, 0);
        const colors = this.generateChartColors(data.length);
        this.pieChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    borderColor: '#2a2a2a',
                    borderWidth: 2,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: 10 },
                plugins: {
                    legend: { position: 'right', labels: { color: '#eee', font: { family: "'Roboto', sans-serif", size: 12 }, padding: 15, boxWidth: 12 } },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const value = context.raw || 0;
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                return `${context.label}: ${value} events (${percentage}%)`;
                            }
                        },
                        backgroundColor: 'rgba(42, 42, 42, 0.95)',
                        titleColor: '#eee',
                        bodyColor: '#eee',
                        borderColor: 'rgb(218, 135, 39)',
                        borderWidth: 1
                    }
                }
            }
        });
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
            let isMeaningful = false;
            const safeType = (chartType === 'AreaChart') ? 'LineChart' : chartType;
            if (hasData) {
                if (safeType === 'LineChart' || safeType === 'StackedBarChart') {
                    if (chartData.type === 'multiLine') {
                        isMeaningful = dataArray.some(series => series.data && series.data.length > 0 && series.data.some(p => p.count > 0));
                    } else {
                        const isDistribution = !!config?.propertyToDisplay && !dataArray.every(item => item.date?.includes(' '));
                        const valueField = isDistribution ? 'count' : (dataArray.some(item => item.value !== undefined && item.value !== 0) ? 'value' : 'count');
                        isMeaningful = dataArray.some(item => item[valueField] > 0);
                    }
                } else {
                    isMeaningful = dataArray.some(item => item.value > 0);
                }
            }
            if (isMeaningful) {
                this.renderChartJsChart(ctx, chartData, safeType, canvasId);
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

    renderChartJsChart(ctx, chartData, chartType, canvasId) {
        let chartConfig;
        const isMultiSeries = chartData.type === 'multiLine';
        if (chartType === 'AreaChart') chartType = 'LineChart';
        if (chartType === 'LineChart' || (chartType === 'StackedBarChart' && isMultiSeries)) {
            if (isMultiSeries) {
                const seriesData = chartData.data || [];
                const colors = this.generateChartColors(seriesData.length);
                const labels = (seriesData.length > 0 && seriesData[0].data)
                    ? seriesData[0].data.map(p => p.date)
                    : [];
                const isStackedBar = chartType === 'StackedBarChart';
                const mainType = isStackedBar ? 'bar' : 'line';
                const datasets = seriesData.map((series, index) => ({
                    label: series.label,
                    data: series.data ? series.data.map(d => d.count) : [],
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
                                stacked: isStackedBar,
                                grid: { color: 'rgba(255,255,255,0.1)' },
                                ticks: { color: '#eee' }
                            }
                        }
                    }
                };
            } else {
                const isDistribution = !!chartData.data?.some(item => !item.date?.includes(' ')) && !chartData.data?.some(item => item.date?.includes('-'));
                const valueField = isDistribution ? 'count' : (chartData.data?.some(item => item.value !== undefined && item.value !== 0) ? 'value' : 'count');
                const labelText = isDistribution ? 'Event Count' : (valueField === 'value' ? 'Average Value' : 'Event Count');
                chartConfig = {
                    type: 'line',
                    data: {
                        labels: chartData.data?.map(item => item.date) || [],
                        datasets: [{
                            label: labelText,
                            data: chartData.data?.map(item => item[valueField]) || [],
                            backgroundColor: 'rgb(218, 135, 39)',
                            borderColor: 'rgb(218, 135, 39)',
                            borderWidth: 2,
                            fill: false
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#eee' } },
                            x: {
                                type: isDistribution ? 'category' : 'time',
                                grid: { color: 'rgba(255,255,255,0.1)' },
                                ticks: { color: '#eee' }
                            }
                        }
                    }
                };
            }
        } else {
            const labels = chartData.data?.map(item => item.label) || [];
            const values = chartData.data?.map(item => item.value) || [];
            chartConfig = {
                type: (chartType === 'StackedBarChart') ? 'bar' : chartType.toLowerCase().replace('chart', ''),
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
                    scales: (chartType === 'BarChart' || chartType === 'StackedBarChart') ? {
                        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#eee' } },
                        x: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#eee' } }
                    } : { y: { display: false }, x: { display: false } }
                }
            };
        }
        this.activeCharts[canvasId] = new Chart(ctx, chartConfig);
    }
}