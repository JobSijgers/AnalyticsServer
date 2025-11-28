using KHSWeb.Services;

namespace KHSWeb.Endpoints
{
    public class GetProjectImageEndpoint : WebEndpoint
    {
        private readonly ProjectImageService _imageService;

        public GetProjectImageEndpoint()
        {
            _imageService = new ProjectImageService();
        }

        public override string Path => "/api/projects/image/{projectId}";
        public override METHOD Method => METHOD.GET;

        public override Delegate Action => new Func<string, Task<IResult>>(async (projectId) =>
        {
            var imageData = await _imageService.GetImageAsync(projectId);

            if (imageData != null && imageData.Length > 0)
            {
                return Results.Bytes(imageData, "image/jpeg");
            }

            return Results.NoContent();
        });
    }
}