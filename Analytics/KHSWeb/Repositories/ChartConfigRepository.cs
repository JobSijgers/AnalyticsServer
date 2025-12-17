using MongoDB.Driver;
using KHSWeb.Models;
using Utils;

namespace KHSWeb.Repositories;

public class ChartConfigRepository
{
    private readonly IMongoCollection<EventDisplayConfig> _configs;

    public ChartConfigRepository()
    {
        var database = Config.GetDatabase();
        _configs = database.GetCollection<EventDisplayConfig>(Config.ChartConfigsCollectionName);
    }

    public async Task<List<EventDisplayConfig>> GetConfigsForProjectAsync(string projectId)
    {
        try
        {
            return await _configs
                .Find(c => c.ProjectId == projectId && c.IsEnabled)
                .SortBy(c => c.DisplayOrder)
                .ToListAsync();
        }
        catch (Exception ex)
        {
            DebugUtils.PrintError($"Error loading configs from DB: {ex.Message}");
            return new List<EventDisplayConfig>();
        }
    }

    public async Task<List<EventDisplayConfig>> GetAllActiveConfigsAsync()
    {
        try
        {
            return await _configs.Find(c => c.IsEnabled).ToListAsync();
        }
        catch (Exception ex)
        {
            DebugUtils.PrintError($"Error loading active configs: {ex.Message}");
            return new List<EventDisplayConfig>();
        }
    }

    public async Task<EventDisplayConfig?> GetConfigByIdAsync(string id)
    {
        return await _configs.Find(c => c.Id == id).FirstOrDefaultAsync();
    }

    public async Task SaveConfigAsync(EventDisplayConfig config)
    {
        try
        {
            var filter = Builders<EventDisplayConfig>.Filter.Eq(c => c.Id, config.Id);
            await _configs.ReplaceOneAsync(
                filter,
                config,
                new ReplaceOptions { IsUpsert = true }
            );
        }
        catch (Exception ex)
        {
            DebugUtils.PrintError($"Error saving config to DB: {ex.Message}");
            throw;
        }
    }

    public async Task DeleteConfigAsync(string id, string projectId)
    {
        try
        {
            await _configs.DeleteOneAsync(c => c.Id == id && c.ProjectId == projectId);
        }
        catch (Exception ex)
        {
            DebugUtils.PrintError($"Error deleting config from DB: {ex.Message}");
            throw;
        }
    }

    public async Task<long> DeleteConfigsForProjectAsync(string projectId)
    {
        try
        {
            var result = await _configs.DeleteManyAsync(c => c.ProjectId == projectId);
            return result.DeletedCount;
        }
        catch (Exception ex)
        {
            DebugUtils.PrintError($"Error deleting project configs from DB: {ex.Message}");
            throw;
        }
    }

    public async Task UpdateConfigOrdersAsync(string projectId, List<ChartOrder> orders)
    {
        try
        {
            var updates = new List<WriteModel<EventDisplayConfig>>();

            foreach (var order in orders)
            {
                var filter = Builders<EventDisplayConfig>.Filter.And(
                    Builders<EventDisplayConfig>.Filter.Eq(c => c.Id, order.Id),
                    Builders<EventDisplayConfig>.Filter.Eq(c => c.ProjectId, projectId)
                );

                var update = Builders<EventDisplayConfig>.Update
                    .Set(c => c.DisplayOrder, order.DisplayOrder)
                    .Set(c => c.UpdatedAt, DateTime.UtcNow);

                updates.Add(new UpdateOneModel<EventDisplayConfig>(filter, update));
            }

            if (updates.Count > 0)
            {
                await _configs.BulkWriteAsync(updates);
            }
        }
        catch (Exception ex)
        {
            DebugUtils.PrintError($"Error updating config orders in DB: {ex.Message}");
            throw;
        }
    }
}