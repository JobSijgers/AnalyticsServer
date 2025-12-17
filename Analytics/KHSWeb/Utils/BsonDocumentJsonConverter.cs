using System.Text.Json;
using System.Text.Json.Serialization;
using MongoDB.Bson;

namespace Utils;

public class BsonDocumentJsonConverter : JsonConverter<BsonDocument>
{
    public override BsonDocument Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        // Parse the JSON token into a JsonDocument to traverse it easily
        using (JsonDocument doc = JsonDocument.ParseValue(ref reader))
        {
            return ToBsonDocument(doc.RootElement);
        }
    }

    public override void Write(Utf8JsonWriter writer, BsonDocument value, JsonSerializerOptions options)
    {
        // Just write the raw JSON string that MongoDB generates
        writer.WriteRawValue(value.ToJson());
    }

    private BsonDocument ToBsonDocument(JsonElement element)
    {
        var bsonDoc = new BsonDocument();

        // Loop through every property in the JSON object
        foreach (var property in element.EnumerateObject())
        {
            bsonDoc.Add(property.Name, ToBsonValue(property.Value));
        }

        return bsonDoc;
    }

    private BsonValue ToBsonValue(JsonElement element)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.Object:
                // Recursive call for nested objects
                return ToBsonDocument(element);
            
            case JsonValueKind.Array:
                var bsonArray = new BsonArray();
                foreach (var item in element.EnumerateArray())
                {
                    bsonArray.Add(ToBsonValue(item));
                }
                return bsonArray;

            case JsonValueKind.String:
                return new BsonString(element.GetString());

            case JsonValueKind.Number:
                // Try to keep integers as integers, fallback to double
                if (element.TryGetInt32(out int i)) return new BsonInt32(i);
                if (element.TryGetInt64(out long l)) return new BsonInt64(l);
                return new BsonDouble(element.GetDouble());

            case JsonValueKind.True: return BsonBoolean.True;
            case JsonValueKind.False: return BsonBoolean.False;
            case JsonValueKind.Null: return BsonNull.Value;
            
            default: return BsonNull.Value;
        }
    }
}