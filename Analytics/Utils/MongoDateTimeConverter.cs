using System.Text.Json;
using System.Text.Json.Serialization;

namespace Utils;

public class MongoDateTimeConverter : JsonConverter<DateTime>
{
    public override DateTime Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        // Case 1: Standard ISO Date String "2023-01-01T..."
        if (reader.TokenType == JsonTokenType.String)
        {
            if (DateTime.TryParse(reader.GetString(), out DateTime date))
            {
                return date.ToUniversalTime();
            }
        }

        // Case 2: MongoDB Extended JSON { "$date": "..." } or { "$date": { "$numberLong": "..." } }
        if (reader.TokenType == JsonTokenType.StartObject)
        {
            using (JsonDocument doc = JsonDocument.ParseValue(ref reader))
            {
                if (doc.RootElement.TryGetProperty("$date", out JsonElement dateElement))
                {
                    // Format: { "$date": "2023-01-01T..." }
                    if (dateElement.ValueKind == JsonValueKind.String && DateTime.TryParse(dateElement.GetString(), out DateTime date))
                    {
                        return date.ToUniversalTime();
                    }
                    
                    // Format: { "$date": { "$numberLong": "1678900000" } }
                    if (dateElement.ValueKind == JsonValueKind.Object && 
                        dateElement.TryGetProperty("$numberLong", out JsonElement longElement))
                    {
                         if (long.TryParse(longElement.GetString(), out long millis))
                         {
                             return DateTimeOffset.FromUnixTimeMilliseconds(millis).UtcDateTime;
                         }
                    }
                }
            }
        }

        // Fallback: Return current time or throw
        DebugUtils.PrintError($"[JsonConverter] Failed to parse date. Token: {reader.TokenType}");
        return DateTime.UtcNow;
    }

    public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(value.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ"));
    }
}