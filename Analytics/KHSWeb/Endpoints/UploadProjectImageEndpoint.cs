using KHSWeb.Repositories;
using Utils;

namespace KHSWeb.Endpoints;

public class UploadProjectImageEndpoint : WebEndpoint
{
    private readonly ProjectImageRepository _imageRepo;

    public UploadProjectImageEndpoint(ProjectImageRepository imageRepo)
    {
        _imageRepo = imageRepo;
    }

    public override string Path => "/api/projects/image/upload";
    public override METHOD Method => METHOD.POST;

    public override Delegate Action => new Func<HttpRequest, Task<IResult>>(async (request) =>
    {
        if (!request.HasFormContentType)
        {
            return Results.BadRequest("Invalid content type");
        }

        var form = await request.ReadFormAsync();
        var projectId = form["projectId"].ToString();
        var file = form.Files["image"];

        if (string.IsNullOrEmpty(projectId) || file == null || file.Length == 0)
        {
            return Results.BadRequest("ProjectId and Image are required.");
        }

        try
        {
            using var memoryStream = new MemoryStream();
            await file.CopyToAsync(memoryStream);
            var imageBytes = memoryStream.ToArray();

            await _imageRepo.SaveImageAsync(projectId, imageBytes);

            return Results.Ok(new { success = true, message = "Image uploaded successfully" });
        }
        catch (Exception ex)
        {
            DebugUtils.PrintError($"Image upload failed: {ex.Message}");
            return Results.Problem("Image upload failed");
        }
    });
}