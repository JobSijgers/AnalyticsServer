using KHSWeb.Services;
using KHSWeb.Models;
using Utils;
using System.Text.Json;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Bson.IO;

namespace KHSWeb.Endpoints;

public class ProjectExportEndpoint : WebEndpoint
{
    private readonly MongoService _mongoService;

    public ProjectExportEndpoint()
    {
        _mongoService = new MongoService();
    }

    public override string Path => "/api/projects/export";
    public override METHOD Method => METHOD.GET;
    public override EndpointSecurity Security => EndpointSecurity.Public; 

    public override Delegate Action => async (HttpContext context) =>
    {
        // 1. Get Token
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
            // USE BSON DOCUMENT instead of strictly typed AnalyticEventDocument
            // This bypasses the C# model type checking error (String vs Boolean)
            using var cursor = await _mongoService.GetProjectEventsRawCursorAsync(projectId);
            
            long count = 0;

            // Strict JSON settings to match MongoDB output format generally
            var jsonWriterSettings = new JsonWriterSettings { OutputMode = JsonOutputMode.CanonicalExtendedJson };

            while (await cursor.MoveNextAsync())
            {
                foreach (var bsonDoc in cursor.Current)
                {
                    // Convert raw BsonDocument to JSON string directly
                    // This handles ANY data type mismatch gracefully
                    var json = bsonDoc.ToJson(jsonWriterSettings);

                    await context.Response.WriteAsync(json);
                    await context.Response.WriteAsync("\n");
                    count++;
                }
                await context.Response.Body.FlushAsync();
            }

            DebugUtils.PrintSuccess($"Export complete. Streamed {count} records.");
            return Results.Empty; // Response already written
        }
        catch (Exception ex)
        {
            DebugUtils.PrintError($"CRITICAL EXPORT ERROR: {ex.Message}");
            return Results.Problem(ex.Message);
        }
    };
}