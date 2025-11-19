// In your AnalyticEventDocument class
public class AnalyticEventDocument
{
    public string Id { get; set; } = MongoDB.Bson.ObjectId.GenerateNewId().ToString();
    public string Key { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public string ProjectId { get; set; } = string.Empty;
    
    // Store as BsonDocument for MongoDB compatibility
    public MongoDB.Bson.BsonDocument Properties { get; set; } = new MongoDB.Bson.BsonDocument();
    
    // Helper property for easy access (ignore for serialization)
    [MongoDB.Bson.Serialization.Attributes.BsonIgnore]
    public Dictionary<string, object> PropertiesDict
    {
        get => Properties.ToDictionary();
        set => Properties = value?.ToBsonDocument() ?? new MongoDB.Bson.BsonDocument();
    }
}

// Extension methods for conversion
public static class BsonDocumentExtensions
{
    public static Dictionary<string, object> ToDictionary(this MongoDB.Bson.BsonDocument bsonDoc)
    {
        if (bsonDoc == null) return new Dictionary<string, object>();
        
        var dict = new Dictionary<string, object>();
        foreach (var element in bsonDoc.Elements)
        {
            dict[element.Name] = BsonValueToObject(element.Value);
        }
        return dict;
    }
    
    public static MongoDB.Bson.BsonDocument ToBsonDocument(this Dictionary<string, object> dict)
    {
        if (dict == null) return new MongoDB.Bson.BsonDocument();
        
        var bsonDoc = new MongoDB.Bson.BsonDocument();
        foreach (var kvp in dict)
        {
            bsonDoc[kvp.Key] = ObjectToBsonValue(kvp.Value);
        }
        return bsonDoc;
    }
    
    private static object BsonValueToObject(MongoDB.Bson.BsonValue value)
    {
        return value.BsonType switch
        {
            MongoDB.Bson.BsonType.String => value.AsString,
            MongoDB.Bson.BsonType.Int32 => value.AsInt32,
            MongoDB.Bson.BsonType.Int64 => value.AsInt64,
            MongoDB.Bson.BsonType.Double => value.AsDouble,
            MongoDB.Bson.BsonType.Boolean => value.AsBoolean,
            MongoDB.Bson.BsonType.Null => null,
            MongoDB.Bson.BsonType.Array => value.AsBsonArray.Select(BsonValueToObject).ToList(),
            MongoDB.Bson.BsonType.Document => value.AsBsonDocument.ToDictionary(),
            _ => value.ToString()
        };
    }
    
    private static MongoDB.Bson.BsonValue ObjectToBsonValue(object obj)
    {
        return obj switch
        {
            string s => new MongoDB.Bson.BsonString(s),
            int i => new MongoDB.Bson.BsonInt32(i),
            long l => new MongoDB.Bson.BsonInt64(l),
            double d => new MongoDB.Bson.BsonDouble(d),
            float f => new MongoDB.Bson.BsonDouble(f),
            bool b => new MongoDB.Bson.BsonBoolean(b),
            null => MongoDB.Bson.BsonNull.Value,
            List<object> list => new MongoDB.Bson.BsonArray(list.Select(ObjectToBsonValue)),
            Dictionary<string, object> dict => dict.ToBsonDocument(),
            _ => new MongoDB.Bson.BsonString(obj.ToString())
        };
    }
}