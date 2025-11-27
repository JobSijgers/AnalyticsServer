namespace KHSWeb.Endpoints;

public class FilterCondition
{
    public string Property { get; set; } = string.Empty;
    public string Operator { get; set; } = string.Empty;
    public object Value { get; set; } = null!;
}