namespace KHSWeb.Models;

public class EventDisplayConfig
{
    public string Id { get; set; } = string.Empty;
    public string ProjectId { get; set; } = string.Empty;
    public string EventKey { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string ChartType { get; set; } = string.Empty; 
    public string PropertyToDisplay { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    public bool IsEnabled { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public string FiltersJson { get; set; } = string.Empty;
}