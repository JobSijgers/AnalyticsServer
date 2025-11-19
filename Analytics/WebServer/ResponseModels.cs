// ResponseModels.cs
namespace KHSWeb.Models
{
    public class ApiResponse<T>
    {
        public bool Success { get; set; }
        public T? Data { get; set; }
        public string? Message { get; set; }
    }

    public class EventKeysResponse
    {
        public List<string> EventKeys { get; set; } = new List<string>();
    }

    public class EventPropertiesResponse
    {
        public List<string> PropertyKeys { get; set; } = new List<string>();
    }

    public class ChartConfigsResponse
    {
        public List<EventDisplayConfig> Configs { get; set; } = new List<EventDisplayConfig>();
    }

    public class ChartDataResponse
    {
        public object? ChartData { get; set; }
    }

    public class SaveConfigResponse
    {
        public string ConfigId { get; set; } = string.Empty;
    }
}