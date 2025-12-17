namespace KHSWeb.Models;

[System.Serializable]
public class UnityAnalyticBatch
{
    public List<UnityAnalyticsEvent> events { get; set; } = new List<UnityAnalyticsEvent>();
}