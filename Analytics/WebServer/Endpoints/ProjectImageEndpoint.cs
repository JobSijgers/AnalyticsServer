namespace KHSWeb.Endpoints
{
    // 1. Endpoint to Get the Image
    public class GetProjectImageEndpoint : WebEndpoint
    {
        public override string Path => "/api/projects/image/{projectId}";
        public override METHOD Method => METHOD.GET;

        public override Delegate Action => new Func<string, IResult>((projectId) =>
        {
            var basePath = System.AppContext.BaseDirectory;
            var folderPath = System.IO.Path.Combine(basePath, "Data", "ProjectImages");
            var filePath = System.IO.Path.Combine(folderPath, $"{projectId}.jpg");

            if (File.Exists(filePath))
            {
                var image = File.OpenRead(filePath);
                return Results.File(image, "image/jpeg");
            }

            // Return 204 (No Content) to prevent 404 errors in browser console
            return Results.NoContent();
        });
    }

    // 2. Endpoint to Upload the Image
    public class UploadProjectImageEndpoint : WebEndpoint
    {
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

            // Match the path logic from ChartConfigService
            var basePath = System.AppContext.BaseDirectory;
            var folderPath = System.IO.Path.Combine(basePath, "Data", "ProjectImages");

            // Ensure directory exists inside the Data folder
            if (!Directory.Exists(folderPath))
            {
                Directory.CreateDirectory(folderPath);
            }

            // Save as [projectId].jpg (overwriting existing)
            var filePath = System.IO.Path.Combine(folderPath, $"{projectId}.jpg");

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            return Results.Ok(new { success = true, message = "Image uploaded successfully" });
        });
    }
}