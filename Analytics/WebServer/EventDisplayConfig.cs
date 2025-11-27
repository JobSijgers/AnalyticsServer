namespace KHSWeb.Models;

public class EventDisplayConfig
{
    public string Id { get; set; }
    public string ProjectId { get; set; }
    public string EventKey { get; set; }
    public string DisplayName { get; set; }
    public string ChartType { get; set; } // Or enum if you use one
    public string PropertyToDisplay { get; set; }
    public int DisplayOrder { get; set; }
    public bool IsEnabled { get; set; }
    public DateTime? CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string FiltersJson { get; set; }
}