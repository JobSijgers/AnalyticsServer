// MetricValue.cs
using System.Text.Json;

namespace KHSWeb.Models
{
    public class MetricValue
    {
        public object Value { get; set; }
        public string Type { get; set; } = "unknown";

        public T GetValue<T>()
        {
            if (Value is JsonElement jsonElement)
            {
                return jsonElement.Deserialize<T>();
            }
            return (T)Convert.ChangeType(Value, typeof(T));
        }

        public static MetricValue Create<T>(T value)
        {
            return new MetricValue
            {
                Value = value,
                Type = typeof(T).Name.ToLower()
            };
        }
    }

    // MetricDocument.cs
    public class MetricDocument
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string MetricKey { get; set; }
        public MetricValue Value { get; set; }
        public Dictionary<string, object> Properties { get; set; } = new();
        public Dictionary<string, object> Metadata { get; set; } = new();
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public string Category { get; set; } = "default";
        public string Source { get; set; } = "unknown";
        public string ProjectId { get; set; } = "default-project"; // Added project ID
    }

    // MetricRequest.cs
    public class MetricRequest
    {
        public string MetricKey { get; set; }
        public object Value { get; set; }
        public Dictionary<string, object> Properties { get; set; } = new();
        public Dictionary<string, object> Metadata { get; set; } = new();
        public string Category { get; set; } = "default";
        public string Source { get; set; } = "unknown";
        public string ProjectId { get; set; } = "default-project"; // Added project ID
    }

    // BatchMetricRequest.cs
    public class BatchMetricRequest
    {
        public List<MetricRequest> Metrics { get; set; } = new();
    }

    // MetricQuery.cs
    public class MetricQuery
    {
        public string MetricKey { get; set; }
        public string Category { get; set; }
        public string Source { get; set; }
        public string ProjectId { get; set; } // Added project ID filtering
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public int Limit { get; set; } = 100;
        public int Skip { get; set; } = 0;
    }
    
    public class DashboardSummary
    {
        public List<MetricFrequency> TopMetrics { get; set; } = new List<MetricFrequency>();
    }
    public class MetricFrequency
    {
        public string MetricKey { get; set; }
        public int Count { get; set; }
    }
}