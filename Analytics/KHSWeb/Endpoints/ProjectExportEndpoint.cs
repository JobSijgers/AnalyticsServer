using KHSWeb.Repositories;
using KHSWeb.Models;
using Utils;
using MongoDB.Bson;
using MongoDB.Bson.IO;
using MongoDB.Driver;

namespace KHSWeb.Endpoints;

public class ProjectExportEndpoint : WebEndpoint
{
    private readonly AnalyticsRepository _repo;

    public ProjectExportEndpoint(AnalyticsRepository repo)
    {
        _repo = repo;
    }

    public override string Path => "/api/projects/export";
    public override METHOD Method => METHOD.GET;
    public override EndpointSecurity Security => EndpointSecurity.Public; 

    public override Delegate Action => async (HttpContext context) =>
    {
        string token = context.Request.Headers["Authorization"].ToString().Replace("Bearer ", "");
        if (string.IsNullOrEmpty(token))
        {
            token = context.Request.Query["token"].ToString();
        }

        if (string.IsNullOrEmpty(token)) 
        {
             return Results.Unauthorized();
        }

        var projectId = context.Request.Query["projectId"].ToString();
        if (string.IsNullOrEmpty(projectId))
        {
            return Results.BadRequest("ProjectId is required");
        }

        DebugUtils.PrintSuccess($"Starting export for project: '{projectId}'");

        context.Response.ContentType = "application/x-ndjson";
        context.Response.Headers.Add("Content-Disposition", $"attachment; filename=\"{projectId}_export.jsonl\"");

        try
        {
            // Access raw BSON collection via the repository's collection reference
            var database = _repo.GetCollection().Database;
            var rawCollection = database.GetCollection<BsonDocument>(Config.MetricsCollectionName);
            var rawFilter = Builders<BsonDocument>.Filter.Eq("ProjectId", projectId);
            
            using var cursor = await rawCollection.Find(rawFilter).ToCursorAsync();
            
            long count = 0;
            var jsonWriterSettings = new JsonWriterSettings { OutputMode = JsonOutputMode.CanonicalExtendedJson };

            while (await cursor.MoveNextAsync())
            {
                foreach (var bsonDoc in cursor.Current)
                {
                    var json = bsonDoc.ToJson(jsonWriterSettings);
                    await context.Response.WriteAsync(json);
                    await context.Response.WriteAsync("\n");
                    count++;
                }
                await context.Response.Body.FlushAsync();
            }

            DebugUtils.PrintSuccess($"Export complete. Streamed {count} records.");
            return Results.Empty; 
        }
        catch (Exception ex)
        {
            DebugUtils.PrintError($"CRITICAL EXPORT ERROR: {ex.Message}");
            return Results.Problem(ex.Message);
        }
    };
}