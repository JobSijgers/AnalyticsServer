using System.Text.Json.Serialization;

public class FetchRequest
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("projectId")]
    public string ProjectId { get; set; } = string.Empty;

    [JsonPropertyName("environmentId")]
    public string EnvironmentId { get; set; } = string.Empty;

    [JsonPropertyName("chartName")]
    public string ChartName { get; set; } = string.Empty;

    [JsonPropertyName("sqlQuery")]
    public string SqlQuery { get; set; } = string.Empty;
}