using KHSWeb.Repositories;
using Utils;

namespace KHSWeb.Endpoints;

public class ProjectListEndpoint : WebEndpoint
{
    private readonly AnalyticsRepository _repo;

    public ProjectListEndpoint(AnalyticsRepository repo)
    {
        _repo = repo;
    }

    public override string Path => "/api/projects";
    public override METHOD Method => METHOD.GET;

    public override Delegate Action => async (HttpContext context) =>
    {
        try
        {
            var projects = await _repo.GetProjectsAsync();
            DebugUtils.PrintSuccess($"Retrieved {projects.Count} projects");
            return Results.Ok(new { projects, success = true });
        }
        catch (Exception ex)
        {
            DebugUtils.PrintError($"Error retrieving projects: {ex.Message}");
            return Results.Problem($"Error retrieving projects: {ex.Message}");
        }
    };
}