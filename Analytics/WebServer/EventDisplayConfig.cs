// EventDisplayConfig.cs - Add JsonConverter for ChartType
using System.Text.Json.Serialization;

public class EventDisplayConfig
{
    public string Id { get; set; } = MongoDB.Bson.ObjectId.GenerateNewId().ToString();
    public string ProjectId { get; set; } = string.Empty;
    public string EventKey { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    
    [JsonConverter(typeof(JsonStringEnumConverter))] // Add this attribute
    public ChartType ChartType { get; set; }
    
    public string PropertyToDisplay { get; set; } = string.Empty;
    public bool IsEnabled { get; set; } = true;
    public int DisplayOrder { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
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