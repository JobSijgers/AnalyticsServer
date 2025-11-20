// Chart Manager - Handles all chart-related functionality
class ChartManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.pieChart = null;
        this.activeCharts = {}; // Store active Chart.js instances by canvas ID
    }

    createPropertyDistributionChart() {
        const canvas = document.getElementById('properties-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // Set canvas size to fit container
        const container = canvas.parentElement;
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;

        // Destroy existing chart if it exists
        if (this.pieChart) {
            this.pieChart.destroy();
        }

        // This is a legacy chart method; ensure it doesn't conflict with dynamic ones
        if (this.activeCharts['properties-chart']) {
            this.activeCharts['properties-chart'].destroy();
            delete this.activeCharts['properties-chart'];
        }

        if (!this.dashboard.currentData.topProperties || this.dashboard.currentData.topProperties.length === 0) {
            // Display message when no data
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

        // Generate distinct colors for the pie chart
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
            'rgb(218, 135, 39)',    // Primary orange
            'rgb(76, 175, 80)',     // Green
            'rgb(33, 150, 243)',    // Blue
            'rgb(156, 39, 176)',    // Purple
            'rgb(255, 152, 0)',     // Amber
            'rgb(244, 67, 54)',     // Red
            'rgb(0, 188, 212)',     // Cyan
            'rgb(103, 58, 183)',    // Deep purple
            'rgb(255, 87, 34)',     // Deep orange
            'rgb(205, 220, 57)'     // Lime
        ];

        // If we need more colors than available, generate variations
        if (count <= baseColors.length) {
            return baseColors.slice(0, count);
        }

        // Generate additional colors by adjusting hue
        const colors = [...baseColors];
        for (let i = baseColors.length; i < count; i++) {
            const hue = (i * 137.5) % 360; // Golden angle approximation
            colors.push(`hsl(${hue}, 70%, 50%)`);
        }
        return colors;
    }

    // Utility to clear a canvas context (used for preview)
    clearCanvas(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const chartInstance = this.activeCharts[canvasId];

        if (chartInstance) {
            chartInstance.destroy();
            delete this.activeCharts[canvasId];
        } else {
            // Clear manually if no Chart.js instance exists (e.g., for Number Card message)
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }


    renderChart(canvasId, chartData, chartType) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // Set canvas size
        const container = canvas.parentElement;

        let newWidth = container.clientWidth;
        let newHeight = container.clientHeight;

        // FIX: Robust canvas sizing for Number Cards
        if (chartType === 'NumberCard' && newHeight === 0) {
            // Assuming container style for number card is 150px height
            newHeight = 150;
            if (newWidth === 0) {
                newWidth = container.offsetWidth > 0 ? container.offsetWidth : 300;
            }
        }

        canvas.width = newWidth;
        canvas.height = newHeight;

        // FIX: Destroy existing chart instance on this canvas before creating a new one
        if (this.activeCharts[canvasId]) {
            this.activeCharts[canvasId].destroy();
            delete this.activeCharts[canvasId];
        }


        if (chartType === 'NumberCard') {
            this.renderNumberCard(ctx, chartData, canvas.width, canvas.height);
        } else {
            const dataArray = chartData.data || [];
            const hasData = dataArray.length > 0;

            // Check if there is meaningful data (i.e., not just an array of zeros)
            let isMeaningful = false;

            if (hasData) {
                if (chartType === 'LineChart') {
                    // Check if sum of all time series values (count or value) is > 0
                    isMeaningful = dataArray.some(item => (item.count || item.value) > 0);
                } else if (chartType === 'BarChart' || chartType === 'PieChart') {
                    // Check if sum of all distribution values is > 0
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

    renderNumberCard(ctx, data, width, height) {
        // Fallback for formatNumber if the dashboard utility fails (robustness)
        const localFormatNumber = (num) => {
            // Always return full number string as requested by user
            return num.toString();
        };

        // Ensure canvas is cleared before drawing custom elements
        ctx.clearRect(0, 0, width, height);

        const cardData = data?.data;
        if (!cardData) {
            ctx.font = '16px Arial';
            ctx.fillStyle = '#aaa';
            ctx.textAlign = 'center';
            ctx.fillText('No data found', width / 2, height / 2);
            return;
        }

        // NEW LOGIC: Determine what to display (Sum of Property or Total Events)
        const showSum = cardData.sumValue !== undefined && cardData.sumValue !== 0;
        const valueToDisplay = showSum ? cardData.sumValue : cardData.total;
        const labelToDisplay = showSum ? 'Sum of Properties' : 'Total Events';

        if (valueToDisplay === 0 && cardData.total === 0) {
            ctx.font = '16px Arial';
            ctx.fillStyle = '#aaa';
            ctx.textAlign = 'center';
            ctx.fillText('No events found', width / 2, height / 2);
            return;
        }

        // Use the dashboard formatNumber if available, otherwise use local fallback
        const formatter = this.dashboard.formatNumber || localFormatNumber;
        const formattedValue = formatter(valueToDisplay);

        ctx.fillStyle = '#eee';
        ctx.font = 'bold 48px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(formattedValue, width / 2, height / 2);

        ctx.fillStyle = '#aaa';
        ctx.font = '16px Roboto, sans-serif';
        // NEW: Display dynamic label
        ctx.fillText(labelToDisplay, width / 2, height / 2 + 30);
    }

    renderChartJsChart(ctx, chartData, chartType, canvasId) {
        let chartConfig;

        // Line Charts
        if (chartType === 'LineChart') {

            // Determine whether to use 'value' (for property analysis) or 'count' (for event count)
            const valueField = chartData.data?.some(item => item.value !== undefined && item.value !== 0) ? 'value' : 'count';

            chartConfig = {
                type: 'line',
                data: {
                    labels: chartData.data?.map(item => item.date) || [],
                    datasets: [{
                        label: valueField === 'value' ? 'Average Value' : 'Event Count',
                        data: chartData.data?.map(item => item[valueField]) || [], // Use the dynamic field
                        backgroundColor: 'rgb(218, 135, 39)', // Use solid color for line
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
            // Bar and Pie Charts (Distribution charts)

            // The C# endpoint returns data with 'label' and 'value'
            const labels = chartData.data?.map(item => item.label) || [];
            const values = chartData.data?.map(item => item.value) || [];

            chartConfig = {
                // Uses 'bar' or 'pie'
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
                            position: 'top',
                            labels: {
                                color: '#eee'
                            }
                        }
                    },
                    // Only show scales for Bar charts
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

        // Store the chart instance so it can be destroyed later
        this.activeCharts[canvasId] = new Chart(ctx, chartConfig);
    }
}