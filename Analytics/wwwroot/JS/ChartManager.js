// Chart Manager - Handles all chart-related functionality
class ChartManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.pieChart = null;
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

    renderChart(canvasId, chartData, chartType) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // Set canvas size
        const container = canvas.parentElement;
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;

        if (chartType === 'NumberCard') {
            this.renderNumberCard(ctx, chartData, canvas.width, canvas.height);
        } else {
            this.renderChartJsChart(ctx, chartData, chartType);
        }
    }

    renderNumberCard(ctx, data, width, height) {
        const total = data.data?.total || 0;

        ctx.fillStyle = '#eee';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(total.toString(), width / 2, height / 2);

        ctx.fillStyle = '#aaa';
        ctx.font = '16px Arial';
        ctx.fillText('Total Events', width / 2, height / 2 + 30);
    }

    renderChartJsChart(ctx, chartData, chartType) {
        let chartConfig;

        if (chartType === 'LineChart' || chartType === 'AreaChart') {
            chartConfig = {
                type: chartType === 'AreaChart' ? 'line' : 'line',
                data: {
                    labels: chartData.data?.map(item => item.date) || [],
                    datasets: [{
                        label: 'Count',
                        data: chartData.data?.map(item => item.count) || [],
                        backgroundColor: chartType === 'AreaChart' ? 'rgba(218, 135, 39, 0.2)' : 'rgb(218, 135, 39)',
                        borderColor: 'rgb(218, 135, 39)',
                        borderWidth: 2,
                        fill: chartType === 'AreaChart'
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
            chartConfig = {
                type: chartType.toLowerCase().replace('chart', ''),
                data: {
                    labels: chartData.data?.map(item => item.label || item.date) || [],
                    datasets: [{
                        label: 'Count',
                        data: chartData.data?.map(item => item.value || item.count) || [],
                        backgroundColor: this.generateChartColors(chartData.data?.length || 1),
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
        }

        new Chart(ctx, chartConfig);
    }
}