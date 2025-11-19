// ChartConfigService.cs
using System.Text.Json;
using System.Text.Json.Serialization;
using KHSWeb.Models;
using Utils;
using System.IO;
using System.Collections.Generic;
using System.Linq;

namespace KHSWeb.Services
{
    public class ChartConfigService
    {
        private readonly string _configFilePath;

        public ChartConfigService()
        {
            var basePath = System.AppContext.BaseDirectory;
            _configFilePath = Path.Combine(basePath, "Data", "chart-configs.json");
            
            // Ensure directory exists
            var directory = Path.GetDirectoryName(_configFilePath);
            if (!Directory.Exists(directory))
            {
                Directory.CreateDirectory(directory);
            }
        }

        public async Task<List<EventDisplayConfig>> LoadConfigsForProject(string projectId)
        {
            var configs = await LoadAllConfigs();
            return configs
                .Where(c => c.ProjectId == projectId && c.IsEnabled)
                .OrderBy(c => c.DisplayOrder)
                .ToList();
        }

        public async Task<List<EventDisplayConfig>> LoadAllConfigs()
        {
            if (!File.Exists(_configFilePath))
            {
                return new List<EventDisplayConfig>();
            }

            try
            {
                var json = await File.ReadAllTextAsync(_configFilePath);
                var options = new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true,
                    Converters = { new JsonStringEnumConverter() }
                };
                
                return JsonSerializer.Deserialize<List<EventDisplayConfig>>(json, options) ?? new List<EventDisplayConfig>();
            }
            catch (Exception ex)
            {
                DebugUtils.PrintError($"Error reading config file: {ex.Message}");
                return new List<EventDisplayConfig>();
            }
        }

        public async Task SaveAllConfigs(List<EventDisplayConfig> configs)
        {
            var options = new JsonSerializerOptions
            {
                WriteIndented = true,
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            };

            var json = JsonSerializer.Serialize(configs, options);
            await File.WriteAllTextAsync(_configFilePath, json);
        }
    }
}