using KHSWeb.Repositories;

namespace KHSWeb.Endpoints
{
    public class GetProjectImageEndpoint : WebEndpoint
    {
        private readonly ProjectImageRepository _imageRepo;

        public GetProjectImageEndpoint(ProjectImageRepository imageRepo)
        {
            _imageRepo = imageRepo;
        }

        public override string Path => "/api/projects/image/{projectId}";
        public override METHOD Method => METHOD.GET;

        public override Delegate Action => new Func<string, Task<IResult>>(async (projectId) =>
        {
            var imageData = await _imageRepo.GetImageAsync(projectId);

            if (imageData != null && imageData.Length > 0)
            {
                return Results.Bytes(imageData, "image/jpeg");
            }

            return Results.NoContent();
        });
    }
}