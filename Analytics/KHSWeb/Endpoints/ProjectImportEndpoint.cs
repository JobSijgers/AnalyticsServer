using KHSWeb.Repositories;
using KHSWeb.Models;
using Utils;
using System.Text.Json;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Net.Http.Headers;

namespace KHSWeb.Endpoints;

public class ProjectImportEndpoint : WebEndpoint
{
    private readonly AnalyticsRepository _repo;

    public ProjectImportEndpoint(AnalyticsRepository repo)
    {
        _repo = repo;
    }

    public override string Path => "/api/projects/import";
    public override METHOD Method => METHOD.POST;
    public override EndpointSecurity Security => EndpointSecurity.Public; 

    public override Delegate Action => async (HttpContext context) =>
    {
        var sizeFeature = context.Features.Get<IHttpMaxRequestBodySizeFeature>();
        if (sizeFeature != null) sizeFeature.MaxRequestBodySize = null;

        try
        {
            string projectId = context.Request.Query["projectId"].ToString();
            
            if (!MediaTypeHeaderValue.TryParse(context.Request.ContentType, out var mediaTypeHeader) ||
                string.IsNullOrEmpty(mediaTypeHeader.Boundary.Value))
            {
                return Results.BadRequest("Invalid Content-Type");
            }

            var boundary = HeaderUtilities.RemoveQuotes(mediaTypeHeader.Boundary).Value;
            var reader = new MultipartReader(boundary, context.Request.Body);
            
            var jsonOptions = new JsonSerializerOptions 
            { 
                PropertyNameCaseInsensitive = true,
                NumberHandling = System.Text.Json.Serialization.JsonNumberHandling.AllowReadingFromString
            };
            
            jsonOptions.Converters.Add(new MongoDateTimeConverter());
            jsonOptions.Converters.Add(new BsonDocumentJsonConverter());

            var section = await reader.ReadNextSectionAsync();
            int count = 0;
            var batch = new List<AnalyticEventDocument>();

            while (section != null)
            {
                var hasContentDispositionHeader = ContentDispositionHeaderValue.TryParse(section.ContentDisposition, out var contentDisposition);

                if (hasContentDispositionHeader && contentDisposition.Name.Equals("file", StringComparison.OrdinalIgnoreCase))
                {
                    using var streamReader = new StreamReader(section.Body);
                    string? line;
                    
                    while ((line = await streamReader.ReadLineAsync()) != null)
                    {
                        if (string.IsNullOrWhiteSpace(line)) continue;

                        try
                        {
                            var doc = JsonSerializer.Deserialize<AnalyticEventDocument>(line, jsonOptions);
                            
                            if (doc != null)
                            {
                                if (!string.IsNullOrEmpty(projectId)) doc.ProjectId = projectId;
                                doc.Id = MongoDB.Bson.ObjectId.GenerateNewId().ToString();
                                batch.Add(doc);
                            }
                        }
                        catch (Exception ex)
                        {
                            if (count == 0) DebugUtils.PrintError($"Import JSON Error: {ex.Message} on line: {line.Substring(0, Math.Min(line.Length, 50))}");
                        }

                        if (batch.Count >= 1000)
                        {
                            await _repo.BulkInsertEventsAsync(batch);
                            count += batch.Count;
                            batch.Clear();
                        }
                    }
                }
                section = await reader.ReadNextSectionAsync();
            }

            if (batch.Count > 0)
            {
                await _repo.BulkInsertEventsAsync(batch);
                count += batch.Count;
            }

            DebugUtils.PrintSuccess($"[IMPORT SUCCESS] Total imported: {count} events into '{projectId}'");
            return Results.Ok(new { success = true, count });
        }
        catch (Exception ex)
        {
            DebugUtils.PrintError($"[IMPORT FAIL] {ex.Message}");
            return Results.Problem(ex.Message);
        }
    };
}