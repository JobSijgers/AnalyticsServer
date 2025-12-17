namespace KHSWeb.Models;

public class UpdateOrderRequest
{
    public string ProjectId { get; set; } = string.Empty;
    public List<ChartOrder> Orders { get; set; } = new List<ChartOrder>();
}