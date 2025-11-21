class ChartManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.pieChart = null;
        this.activeCharts = {};
    }

    _formatNumberWithDots(num) {
        const numberValue = Number(num);

        if (isNaN(numberValue)) {
            return String(num);
        }

        const numStr = Math.round(numberValue).toString();

        return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }

    createPropertyDistributionChart() {
        const canvas = document.getElementById('properties-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        const container = canvas.parentElement;
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;

        if (this.pieChart) {
            this.pieChart.destroy();
        }

        if (this.activeCharts['properties-chart']) {
            this.activeCharts['properties-chart'].destroy();
            delete this.activeCharts['properties-chart'];
        }

        if (!this.dashboard.currentData.topProperties || this.dashboard.currentData.topProperties.length === 0) {
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
                layout: {
                    padding: {
                        top: 10,
                        bottom: 10,
                        left: 10,
                        right: 10
                    }
                },
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#eee',
                            font: {
                                family: "'Roboto', sans-serif",
                                size: 12
                            },
                            padding: 15,
                            boxWidth: 12
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value} events (${percentage}%)`;
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
            'rgb(218, 135, 39)',
            'rgb(76, 175, 80)',
            'rgb(33, 150, 243)',
            'rgb(156, 39, 176)',
            'rgb(255, 152, 0)',
            'rgb(244, 67, 54)',
            'rgb(0, 188, 212)',
            'rgb(103, 58, 183)',
            'rgb(255, 87, 34)',
            'rgb(205, 220, 57)'
        ];

        if (count <= baseColors.length) {
            return baseColors.slice(0, count);
        }

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
        const chartInstance = this.activeCharts[canvasId];

        if (chartInstance) {
            chartInstance.destroy();
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
            if (newWidth === 0) {
                newWidth = container.offsetWidth > 0 ? container.offsetWidth : 300;
            }
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

            if (hasData) {
                if (chartType === 'LineChart') {
                    // When a property is selected, the backend returns count. Otherwise, it uses value/count for time-series.
                    const isDistribution = !!config?.propertyToDisplay && !dataArray.every(item => item.date?.includes(' '));
                    const valueField = isDistribution ? 'count' : (dataArray.some(item => item.value !== undefined && item.value !== 0) ? 'value' : 'count');
                    isMeaningful = dataArray.some(item => item[valueField] > 0);
                } else if (chartType === 'BarChart' || chartType === 'PieChart') {
                    isMeaningful = dataArray.some(item => item.value > 0);
                }
            }

            if (isMeaningful) {
                this.renderChartJsChart(ctx, chartData, chartType, canvasId);
            } else {
                ctx.font = '16px Arial';
                ctx.fillStyle = '#aaa';
                ctx.textAlign = 'center';
                ctx.fillText('No meaningful data found for this period.', canvas.width / 2, canvas.height / 2);
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
            ctx.fillText('No data found', width / 2, height / 2);
            return;
        }

        const showSum = cardData.sumValue !== undefined && cardData.sumValue !== 0;
        const valueToDisplay = showSum ? cardData.sumValue : cardData.total;

        let labelToDisplay = 'Total Events';

        if (showSum && config) {
            const propertyName = config.propertyToDisplay;

            if (propertyName) {
                labelToDisplay = propertyName;
            } else {
                labelToDisplay = config.displayName || 'Sum of Property';
            }
        }

        if (valueToDisplay === 0 && cardData.total === 0) {
            ctx.font = '16px Arial';
            ctx.fillStyle = '#aaa';
            ctx.textAlign = 'center';
            ctx.fillText('No events found', width / 2, height / 2);
            return;
        }

        const formattedValue = this._formatNumberWithDots(valueToDisplay);

        ctx.fillStyle = '#eee';
        ctx.font = 'bold 48px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(formattedValue, width / 2, height / 2);

        ctx.fillStyle = '#aaa';
        ctx.font = '16px Roboto, sans-serif';
        ctx.fillText(labelToDisplay, width / 2, height / 2 + 30);
    }

    renderChartJsChart(ctx, chartData, chartType, canvasId) {
        let chartConfig;

        if (chartType === 'LineChart') {

            const isDistribution = !!chartData.data?.some(item => !item.date?.includes(' ')) && !chartData.data?.some(item => item.date?.includes('-'));

            // If a property is selected and it's not time-series (i.e., property distribution), 
            // the backend returns data with 'date' as property value and 'count' as event count.
            // If it is time-series and has a value, use 'value'. Otherwise, use 'count'.
            const valueField = isDistribution ? 'count' : (chartData.data?.some(item => item.value !== undefined && item.value !== 0) ? 'value' : 'count');
            const labelText = isDistribution ? 'Event Count' : (valueField === 'value' ? 'Average Value' : 'Event Count');

            chartConfig = {
                type: 'line',
                data: {
                    // For property distribution, 'date' holds the property value (e.g., '0', '1', '2')
                    // For time series, 'date' holds the formatted date (e.g., 'Nov 01')
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
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(255,255,255,0.1)'
                            },
                            ticks: {
                                color: '#eee'
                            }
                        },
                        x: {
                            // If it's a property distribution chart, ensure labels are treated as categories
                            type: isDistribution ? 'category' : 'time',
                            // Time parsing is too complex to fix easily without Date objects or a library like Luxon. 
                            // Sticking to 'category' for distribution and letting Chart.js infer for time series.
                            grid: {
                                color: 'rgba(255,255,255,0.1)'
                            },
                            ticks: {
                                color: '#eee'
                            }
                        }
                    }
                }
            };
        } else {
            const labels = chartData.data?.map(item => item.label) || [];
            const values = chartData.data?.map(item => item.value) || [];

            chartConfig = {
                type: chartType.toLowerCase().replace('chart', ''),
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
                    plugins: {
                        legend: {
                            display: false,
                            position: 'top',
                            labels: {
                                color: '#eee'
                            }
                        }
                    },
                    scales: (chartType === 'BarChart') ? {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(255,255,255,0.1)'
                            },
                            ticks: {
                                color: '#eee'
                            }
                        },
                        x: {
                            grid: {
                                color: 'rgba(255,255,255,0.1)'
                            },
                            ticks: {
                                color: '#eee'
                            }
                        }
                    } : {
                        y: { display: false },
                        x: { display: false }
                    }
                }
            };
        }

        this.activeCharts[canvasId] = new Chart(ctx, chartConfig);
    }
}