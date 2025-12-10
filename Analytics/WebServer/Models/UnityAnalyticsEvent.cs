namespace KHSWeb.Models;

[System.Serializable]
public class UnityAnalyticsEvent
{
    public string key { get; set; } = string.Empty;
    public Dictionary<string, object> properties { get; set; } = new Dictionary<string, object>();
    public string project { get; set; } = string.Empty;
    public DateTime? timestamp { get; set; }
}