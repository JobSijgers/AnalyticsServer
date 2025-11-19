// EventDisplayConfig.cs - Add JsonConverter for ChartType
using System.Text.Json.Serialization;

public class EventDisplayConfig
{
    public string Id { get; set; } = string.Empty;
    public string ProjectId { get; set; } = string.Empty;
    public string EventKey { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string ChartType { get; set; } = string.Empty;
    public string PropertyToDisplay { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    public bool IsEnabled { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public enum ChartType
{
    LineChart,
    BarChart,
    PieChart,
    DoughnutChart,
    AreaChart,
    NumberCard
}