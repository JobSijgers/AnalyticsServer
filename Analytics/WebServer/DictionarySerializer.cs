using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Bson.Serialization.Serializers;

namespace KHSWeb.Serializers;

public class DictionarySerializer : IBsonSerializer<Dictionary<string, object>>
{
    public Type ValueType => typeof(Dictionary<string, object>);

    public Dictionary<string, object> Deserialize(BsonDeserializationContext context, BsonDeserializationArgs args)
    {
        var doc = BsonDocumentSerializer.Instance.Deserialize(context, args);
        var dict = new Dictionary<string, object>();
            
        foreach (var element in doc)
        {
            dict[element.Name] = ConvertBsonValue(element.Value);
        }
            
        return dict;
    }

    public void Serialize(BsonSerializationContext context, BsonSerializationArgs args, Dictionary<string, object> value)
    {
        var doc = new BsonDocument();
            
        foreach (var kvp in value)
        {
            doc[kvp.Key] = ConvertToBsonValue(kvp.Value);
        }
            
        BsonDocumentSerializer.Instance.Serialize(context, doc);
    }

    public void Serialize(BsonSerializationContext context, BsonSerializationArgs args, object value)
    {
        Serialize(context, args, (Dictionary<string, object>)value);
    }

    object IBsonSerializer.Deserialize(BsonDeserializationContext context, BsonDeserializationArgs args)
    {
        return Deserialize(context, args);
    }

    private object ConvertBsonValue(BsonValue bsonValue)
    {
        return (bsonValue.BsonType switch
        {
            BsonType.String => bsonValue.AsString,
            BsonType.Int32 => bsonValue.AsInt32,
            BsonType.Int64 => bsonValue.AsInt64,
            BsonType.Double => bsonValue.AsDouble,
            BsonType.Boolean => bsonValue.AsBoolean,
            BsonType.DateTime => bsonValue.ToUniversalTime(),
            BsonType.Null => null,
            BsonType.Document => ConvertBsonDocument(bsonValue.AsBsonDocument),
            BsonType.Array => ConvertBsonArray(bsonValue.AsBsonArray),
            _ => bsonValue.ToString()
        })!;
    }

    private Dictionary<string, object> ConvertBsonDocument(BsonDocument doc)
    {
        var dict = new Dictionary<string, object>();
        foreach (var element in doc)
        {
            dict[element.Name] = ConvertBsonValue(element.Value);
        }
        return dict;
    }

    private List<object> ConvertBsonArray(BsonArray array)
    {
        var list = new List<object>();
        foreach (var value in array)
        {
            list.Add(ConvertBsonValue(value));
        }
        return list;
    }

    private BsonValue ConvertToBsonValue(object value)
    {
        if (value == null) return BsonNull.Value;
            
        return value switch
        {
            string str => new BsonString(str),
            int i => new BsonInt32(i),
            long l => new BsonInt64(l),
            double d => new BsonDouble(d),
            float f => new BsonDouble(f),
            bool b => new BsonBoolean(b),
            DateTime dt => new BsonDateTime(dt.ToUniversalTime()),
            Dictionary<string, object> dict => ConvertDictionaryToBsonDocument(dict),
            IEnumerable<object> list => ConvertListToBsonArray(list),
            _ => new BsonString(value.ToString())
        };
    }

    private BsonDocument ConvertDictionaryToBsonDocument(Dictionary<string, object> dict)
    {
        var doc = new BsonDocument();
        foreach (var kvp in dict)
        {
            doc[kvp.Key] = ConvertToBsonValue(kvp.Value);
        }
        return doc;
    }

    private BsonArray ConvertListToBsonArray(IEnumerable<object> list)
    {
        var array = new BsonArray();
        foreach (var item in list)
        {
            array.Add(ConvertToBsonValue(item));
        }
        return array;
    }
}