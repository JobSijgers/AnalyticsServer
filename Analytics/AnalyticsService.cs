using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Utils;


namespace KHSAnalytics
{
    using System.Text;
    using System.Text.Json;
    using System.Text.Json.Serialization;
    using Utils;

    namespace KHSAnalytics
    {
        // Response classes for deserialization
        public class AnalyticsResponse
        {
            [JsonPropertyName("chartId")] public int ChartId { get; set; }

            [JsonPropertyName("name")] public string Name { get; set; } = string.Empty;

            [JsonPropertyName("job")] public AnalyticsJob Job { get; set; } = new();

            [JsonPropertyName("yAxis")] public AxisInfo YAxis { get; set; } = new();

            [JsonPropertyName("xAxis")] public AxisInfo XAxis { get; set; } = new();

            [JsonPropertyName("colSpan")] public int ColSpan { get; set; }

            [JsonPropertyName("description")] public string Description { get; set; } = string.Empty;
        }

        public class AnalyticsJob
        {
            [JsonPropertyName("jobId")] public string JobId { get; set; } = string.Empty;

            [JsonPropertyName("status")] public string Status { get; set; } = string.Empty;

            [JsonPropertyName("results")] public JobResults Results { get; set; } = new();

            [JsonPropertyName("timeTakenMs")] public int TimeTakenMs { get; set; }
        }

        public class JobResults
        {
            [JsonPropertyName("mainChart")] public List<ChartData> MainChart { get; set; } = new();

            [JsonPropertyName("aggregate")] public object? Aggregate { get; set; }

            [JsonPropertyName("previousAggregate")]
            public object? PreviousAggregate { get; set; }

            [JsonPropertyName("dataSummary")] public object? DataSummary { get; set; }
        }

        public class ChartData
        {
            [JsonPropertyName("type")] public string Type { get; set; } = string.Empty;

            [JsonPropertyName("name")] public string Name { get; set; } = string.Empty;

            [JsonPropertyName("data")] public List<List<JsonElement>> Data { get; set; } = new();

            [JsonPropertyName("pivotValue")] public object? PivotValue { get; set; }

            [JsonPropertyName("pivotDimension")] public object? PivotDimension { get; set; }
        }

        public class AxisInfo
        {
            [JsonPropertyName("title")] public string Title { get; set; } = string.Empty;

            [JsonPropertyName("unit")] public string Unit { get; set; } = string.Empty;
        }

        // Table extraction classes
        public class TableData
        {
            public List<string> Headers { get; set; } = new();
            public List<List<object>> Rows { get; set; } = new();
            public string TableName { get; set; } = string.Empty;

            public void PrintTable()
            {
                Console.WriteLine($"Table: {TableName}");
                if (Headers.Any())
                {
                    Console.WriteLine($"Headers: {string.Join(" | ", Headers)}");
                    Console.WriteLine(new string('-', Headers.Sum(h => h.Length) + Headers.Count * 3));
                }

                foreach (var row in Rows)
                {
                    Console.WriteLine($"Row: {string.Join(" | ", row)}");
                }
            }
        }

        public class AnalyticsService
        {
            private readonly HttpClient _httpClient = new HttpClient();
            private readonly JsonSerializerOptions _jsonOptions;
            private readonly CancellationToken _cancellationToken;
            public List<FetchRequest> FetchRequests { get; set; } = new();

            // Add a flag to track if the fetch loop is running
            private bool _fetchLoopRunning = false;
            private Task _fetchLoopTask;

            public AnalyticsService(CancellationToken cancellationToken)
            {
                _cancellationToken = cancellationToken;
                _jsonOptions = new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true,
                    PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                };
                LoadFetchRequests(); // Load on initialization

                // Start the fetch loop automatically
                StartFetchLoop();
            }

            /// <summary>
            /// Starts the fetch loop to process all configured requests
            /// </summary>
            public void StartFetchLoop()
            {
                if (_fetchLoopRunning)
                {
                    DebugUtils.PrintWarning("Fetch loop is already running");
                    return;
                }

                _fetchLoopRunning = true;
                _fetchLoopTask = Task.Run(async () => await FetchAllRequestsLoop(_cancellationToken));
                DebugUtils.PrintSuccess("Fetch loop started successfully");
            }

            /// <summary>
            /// Stops the fetch loop
            /// </summary>
            public void StopFetchLoop()
            {
                _fetchLoopRunning = false;
                DebugUtils.PrintWarning("Fetch loop stopping...");
            }

            /// <summary>
            /// Main loop that processes all fetch requests
            /// </summary>
            private async Task FetchAllRequestsLoop(CancellationToken ct)
            {
                DebugUtils.Print("Starting FetchAllRequestsLoop...");

                while (!ct.IsCancellationRequested && _fetchLoopRunning)
                {
                    try
                    {
                        if (FetchRequests.Count == 0)
                        {
                            DebugUtils.PrintWarning("No fetch requests configured. Waiting for requests...");
                            await Task.Delay(Config.FetchIntervalMs, ct);
                            continue;
                        }

                        DebugUtils.Print($"Processing {FetchRequests.Count} fetch requests...");

                        // Process each request sequentially
                        foreach (var request in FetchRequests)
                        {
                            if (!_fetchLoopRunning || ct.IsCancellationRequested)
                                break;

                            await ProcessSingleRequest(request, ct);
                        }

                        DebugUtils.PrintSuccess($"Completed processing all {FetchRequests.Count} requests");
                        DebugUtils.Print($"Waiting {Config.FetchIntervalMs}ms before next cycle...");
                        await Task.Delay(Config.FetchIntervalMs, ct);
                    }
                    catch (OperationCanceledException) when (ct.IsCancellationRequested)
                    {
                        DebugUtils.PrintWarning("Fetch loop cancelled");
                        break;
                    }
                    catch (Exception ex)
                    {
                        DebugUtils.PrintError($"Error in fetch loop: {ex.Message}");
                        // Wait a bit before retrying on error
                        await Task.Delay(Math.Min(Config.FetchIntervalMs, 30000), ct);
                    }
                }

                _fetchLoopRunning = false;
                DebugUtils.PrintWarning("FetchAllRequestsLoop terminated");
            }

            /// <summary>
            /// Processes a single fetch request
            /// </summary>
            private async Task ProcessSingleRequest(FetchRequest request, CancellationToken ct)
            {
                try
                {
                    DebugUtils.Print($"Processing request: {request.Name}");
                    DebugUtils.Print($"  Project: {request.ProjectId}");
                    DebugUtils.Print($"  Environment: {request.EnvironmentId}");
                    DebugUtils.Print($"  SQL: {request.SqlQuery}");

                    var response = await ExecuteAnalyticsQuery(
                        projectId: request.ProjectId,
                        environmentId: request.EnvironmentId,
                        chartName: request.ChartName,
                        bearerToken: Config.BearerToken,
                        sqlQuery: request.SqlQuery,
                        ct: ct
                    );

                    // Process the response based on your needs
                    await ProcessResponse(request, response);

                    DebugUtils.PrintSuccess($"Successfully processed request: {request.Name}");
                }
                catch (OperationCanceledException) when (ct.IsCancellationRequested)
                {
                    DebugUtils.PrintWarning($"Request processing cancelled: {request.Name}");
                    throw;
                }
                catch (Exception ex)
                {
                    DebugUtils.PrintError($"Failed to process request '{request.Name}': {ex.Message}");
                    // Don't re-throw, continue with next request
                }
            }

            /// <summary>
            /// Process the response from a fetch request
            /// </summary>
            private async Task ProcessResponse(FetchRequest request, string responseJson)
            {
                try
                {
                    // Extract data based on your requirements
                    var tableData = ExtractTableData(responseJson);

                    if (tableData != null)
                    {
                        DebugUtils.Print($"Extracted data from '{request.Name}': {tableData.Rows.Count} rows");

                        // Example: Print the table data
                        tableData.PrintTable();

                        // You can add custom processing here:
                        // - Save to database
                        // - Update dashboards
                        // - Send notifications
                        // - etc.

                        // Example: Extract first value for simple queries
                        var firstValue = ExtractFirstValue<object>(responseJson);
                        if (firstValue != null)
                        {
                            DebugUtils.PrintSuccess($"First value from '{request.Name}': {firstValue}");
                        }
                    }
                    else
                    {
                        DebugUtils.PrintWarning($"No table data extracted from '{request.Name}'");
                    }

                    // You can also extract as dictionary for key-value pairs
                    var dictData = ExtractAsDictionary(responseJson);
                    if (dictData.Any())
                    {
                        DebugUtils.Print($"Extracted {dictData.Count} key-value pairs from '{request.Name}'");
                        foreach (var kvp in dictData)
                        {
                            DebugUtils.Print($"  {kvp.Key}: {kvp.Value}");
                        }
                    }
                }
                catch (Exception ex)
                {
                    DebugUtils.PrintError($"Error processing response for '{request.Name}': {ex.Message}");
                }
            }

            /// <summary>
            /// Manually trigger processing of all requests (useful for testing)
            /// </summary>
            public async Task ProcessAllRequestsNow()
            {
                if (FetchRequests.Count == 0)
                {
                    DebugUtils.PrintWarning("No fetch requests to process");
                    return;
                }

                DebugUtils.Print($"Manually processing {FetchRequests.Count} requests...");

                foreach (var request in FetchRequests)
                {
                    await ProcessSingleRequest(request, _cancellationToken);
                }

                DebugUtils.PrintSuccess("Manual processing completed");
            }

            /// <summary>
            /// Manually trigger processing of a specific request by name
            /// </summary>
            public async Task ProcessRequestByName(string requestName)
            {
                var request = FetchRequests.FirstOrDefault(r =>
                    r.Name.Equals(requestName, StringComparison.OrdinalIgnoreCase));
                if (request == null)
                {
                    DebugUtils.PrintError($"Request not found: {requestName}");
                    return;
                }

                await ProcessSingleRequest(request, _cancellationToken);
            }

            private void LoadFetchRequests()
            {
                try
                {
                    if (File.Exists(Config.FetchConfigsPath))
                    {
                        var json = File.ReadAllText(Config.FetchConfigsPath);
                        var data = JsonSerializer.Deserialize<FetchConfigsData>(json, _jsonOptions);
                        FetchRequests = data?.FetchRequests ?? new List<FetchRequest>();
                        DebugUtils.Print(
                            $"Loaded {FetchRequests.Count} fetch requests from {Config.FetchConfigsPath}");
                    }
                    else
                    {
                        DebugUtils.Print(
                            $"No fetch configs file found at {Config.FetchConfigsPath}, initializing empty list");
                        FetchRequests = new List<FetchRequest>();
                    }
                }
                catch (Exception ex)
                {
                    DebugUtils.PrintError($"Error loading fetch configs: {ex.Message}");
                    FetchRequests = new List<FetchRequest>();
                }
            }

            public void ReloadFetchRequests()
            {
                LoadFetchRequests(); // Reload from file
            }

            /// <summary>
            /// Extracts the first value from the response as a specific type
            /// </summary>
            public T? ExtractFirstValue<T>(string jsonResponse)
            {
                DebugUtils.Print("Extracting first value...");
                try
                {
                    var response = JsonSerializer.Deserialize<AnalyticsResponse>(jsonResponse, _jsonOptions);
                    var firstElement = response?.Job?.Results?.MainChart?.FirstOrDefault()?.Data?.FirstOrDefault()
                        ?.FirstOrDefault();

                    if (firstElement is JsonElement element)
                    {
                        var extractedValue = ExtractValueFromElement(element);
                        return ConvertValue<T>(extractedValue);
                    }

                    DebugUtils.PrintWarning("No first element found in response.");
                }
                catch (Exception e)
                {
                    DebugUtils.PrintError($"Failed to extract first value: {e.Message}");
                }

                DebugUtils.PrintWarning("Returning default value for type T.");
                return default;
            }

            /// <summary>
            /// Extracts all data as a table structure
            /// </summary>
            public TableData? ExtractTableData(string jsonResponse)
            {
                DebugUtils.Print("Extracting table data...");
                try
                {
                    var response = JsonSerializer.Deserialize<AnalyticsResponse>(jsonResponse, _jsonOptions);
                    var mainChart = response?.Job?.Results?.MainChart?.FirstOrDefault();

                    if (mainChart == null)
                    {
                        DebugUtils.PrintWarning("MainChart is null in response.");
                        return null;
                    }

                    var tableData = new TableData
                    {
                        TableName = mainChart.Name
                    };

                    // For simple single-value responses like your total kills example
                    if (mainChart.Data.Count == 1 && mainChart.Data[0].Count == 1)
                    {
                        tableData.Headers.Add("value");
                        tableData.Rows.Add(new List<object> { ExtractValueFromElement(mainChart.Data[0][0]) });
                        DebugUtils.PrintSuccess($"Extracted single-value table: {tableData.TableName}");
                        return tableData;
                    }

                    // For multi-row, multi-column tables
                    foreach (var row in mainChart.Data)
                    {
                        var tableRow = new List<object>();
                        foreach (var cell in row)
                        {
                            tableRow.Add(ExtractValueFromElement(cell));
                        }

                        tableData.Rows.Add(tableRow);
                    }

                    // Generate headers if we have data but no explicit headers
                    if (tableData.Rows.Any() && tableData.Headers.Count == 0)
                    {
                        tableData.Headers = Enumerable.Range(1, tableData.Rows[0].Count)
                            .Select(i => $"column_{i}")
                            .ToList();
                        DebugUtils.Print("Generated default headers for table.");
                    }

                    DebugUtils.PrintSuccess(
                        $"Extracted table: {tableData.TableName} with {tableData.Rows.Count} rows.");
                    return tableData;
                }
                catch (Exception e)
                {
                    DebugUtils.PrintError($"Failed to extract table data: {e.Message}");
                    return null;
                }
            }

            /// <summary>
            /// Extracts a complete dataset with multiple charts/tables
            /// </summary>
            public List<TableData> ExtractAllTables(string jsonResponse)
            {
                var tables = new List<TableData>();
                DebugUtils.Print("Extracting all tables...");
                try
                {
                    var response = JsonSerializer.Deserialize<AnalyticsResponse>(jsonResponse, _jsonOptions);

                    if (response?.Job?.Results?.MainChart != null)
                    {
                        foreach (var chart in response.Job.Results.MainChart)
                        {
                            var table = ExtractTableFromChart(chart);
                            if (table != null)
                            {
                                tables.Add(table);
                                DebugUtils.PrintSuccess($"Extracted table: {table.TableName}");
                            }
                            else
                            {
                                DebugUtils.PrintWarning($"Failed to extract table from chart: {chart.Name}");
                            }
                        }
                    }
                    else
                    {
                        DebugUtils.PrintWarning("No MainChart data found in response.");
                    }
                }
                catch (Exception e)
                {
                    DebugUtils.PrintError($"Failed to extract all tables: {e.Message}");
                }

                DebugUtils.PrintSuccess($"Extracted {tables.Count} tables.");
                return tables;
            }

            /// <summary>
            /// Extracts data as a dictionary for key-value pairs
            /// </summary>
            public Dictionary<string, object> ExtractAsDictionary(string jsonResponse)
            {
                var result = new Dictionary<string, object>();
                DebugUtils.Print("Extracting data as dictionary...");
                try
                {
                    var tableData = ExtractTableData(jsonResponse);
                    if (tableData != null && tableData.Rows.Any())
                    {
                        for (int i = 0; i < tableData.Headers.Count && i < tableData.Rows[0].Count; i++)
                        {
                            result[tableData.Headers[i]] = tableData.Rows[0][i];
                        }

                        DebugUtils.PrintSuccess($"Extracted dictionary with {result.Count} key-value pairs.");
                    }
                    else
                    {
                        DebugUtils.PrintWarning("No table data or rows found for dictionary extraction.");
                    }
                }
                catch (Exception e)
                {
                    DebugUtils.PrintError($"Failed to extract as dictionary: {e.Message}");
                }

                return result;
            }

            /// <summary>
            /// Extracts a single column from the response
            /// </summary>
            public List<T> ExtractColumn<T>(string jsonResponse, int columnIndex = 0)
            {
                var result = new List<T>();
                DebugUtils.Print($"Extracting column {columnIndex}...");
                try
                {
                    var tableData = ExtractTableData(jsonResponse);
                    if (tableData != null)
                    {
                        foreach (var row in tableData.Rows)
                        {
                            if (columnIndex < row.Count)
                            {
                                var convertedValue = ConvertValue<T>(row[columnIndex]);
                                if (convertedValue != null)
                                    result.Add(convertedValue);
                            }
                            else
                            {
                                DebugUtils.PrintWarning($"Column index {columnIndex} out of range for row.");
                            }
                        }

                        DebugUtils.PrintSuccess($"Extracted {result.Count} values from column {columnIndex}.");
                    }
                    else
                    {
                        DebugUtils.PrintWarning("No table data found for column extraction.");
                    }
                }
                catch (Exception e)
                {
                    DebugUtils.PrintError($"Failed to extract column: {e.Message}");
                }

                return result;
            }

            /// <summary>
            /// Extracts data as a list of typed objects (for structured results)
            /// </summary>
            public List<T> ExtractAsList<T>(string jsonResponse) where T : new()
            {
                var result = new List<T>();
                DebugUtils.Print($"Extracting data as list of {typeof(T).Name}...");
                try
                {
                    var tableData = ExtractTableData(jsonResponse);
                    if (tableData != null && tableData.Rows.Any())
                    {
                        var properties = typeof(T).GetProperties();

                        foreach (var row in tableData.Rows)
                        {
                            var item = new T();

                            for (int i = 0; i < Math.Min(properties.Length, row.Count); i++)
                            {
                                var property = properties[i];
                                try
                                {
                                    var value = Convert.ChangeType(row[i], property.PropertyType);
                                    property.SetValue(item, value);
                                }
                                catch
                                {
                                    DebugUtils.PrintWarning(
                                        $"Failed to convert value for property {property.Name} in row.");
                                }
                            }

                            result.Add(item);
                        }

                        DebugUtils.PrintSuccess($"Extracted {result.Count} objects of type {typeof(T).Name}.");
                    }
                    else
                    {
                        DebugUtils.PrintWarning("No table data or rows found for list extraction.");
                    }
                }
                catch (Exception e)
                {
                    DebugUtils.PrintError($"Failed to extract as list: {e.Message}");
                }

                return result;
            }

            /// <summary>
            /// Extracts a value by specific JSON path
            /// </summary>
            public T? ExtractValueByPath<T>(string jsonResponse,
                string jsonPath = "job.results.mainChart[0].data[0][0]")
            {
                DebugUtils.Print($"Extracting value by JSON path: {jsonPath}...");
                try
                {
                    using var document = JsonDocument.Parse(jsonResponse);
                    var element = document.RootElement;

                    var pathParts = jsonPath.Split('.');
                    foreach (var part in pathParts)
                    {
                        if (part.Contains('[') && part.Contains(']'))
                        {
                            // Handle array access like "mainChart[0]"
                            var propertyName = part.Split('[')[0];
                            var index = int.Parse(part.Split('[')[1].TrimEnd(']'));

                            element = element.GetProperty(propertyName)[index];
                        }
                        else
                        {
                            element = element.GetProperty(part);
                        }
                    }

                    var value = ExtractValueFromElement(element);
                    DebugUtils.PrintSuccess($"Extracted value by path: {value}");
                    return ConvertValue<T>(value);
                }
                catch (Exception e)
                {
                    DebugUtils.PrintError($"Failed to extract value by path '{jsonPath}': {e.Message}");
                    return default;
                }
            }

            /// <summary>
            /// Extracts multiple values from a specific row
            /// </summary>
            public List<T> ExtractRowValues<T>(string jsonResponse, int chartIndex = 0, int rowIndex = 0)
            {
                var result = new List<T>();
                DebugUtils.Print($"Extracting row values from chart {chartIndex}, row {rowIndex}...");
                try
                {
                    var response = JsonSerializer.Deserialize<AnalyticsResponse>(jsonResponse, _jsonOptions);
                    var row = response?.Job?.Results?.MainChart?[chartIndex]?.Data?[rowIndex];

                    if (row != null)
                    {
                        foreach (var element in row)
                        {
                            var value = ExtractValueFromElement(element);
                            var convertedValue = ConvertValue<T>(value);
                            if (convertedValue != null)
                                result.Add(convertedValue);
                        }

                        DebugUtils.PrintSuccess($"Extracted {result.Count} values from row {rowIndex}.");
                    }
                    else
                    {
                        DebugUtils.PrintWarning($"No data found for chart {chartIndex}, row {rowIndex}.");
                    }
                }
                catch (Exception e)
                {
                    DebugUtils.PrintError($"Failed to extract row values: {e.Message}");
                }

                return result;
            }

            /// <summary>
            /// Gets the response as a dynamic object for flexible access
            /// </summary>
            public dynamic? ExtractDynamic(string jsonResponse)
            {
                DebugUtils.Print("Extracting dynamic data...");
                try
                {
                    var response = JsonSerializer.Deserialize<AnalyticsResponse>(jsonResponse, _jsonOptions);
                    var mainChart = response?.Job?.Results?.MainChart?.FirstOrDefault();

                    if (mainChart?.Data != null)
                    {
                        var dynamicData = new List<dynamic>();

                        foreach (var row in mainChart.Data)
                        {
                            var dynamicRow = new List<dynamic>();
                            foreach (var cell in row)
                            {
                                dynamicRow.Add(ExtractValueFromElement(cell));
                            }

                            dynamicData.Add(dynamicRow);
                        }

                        DebugUtils.PrintSuccess($"Extracted dynamic data for table: {mainChart.Name}");
                        return new
                        {
                            TableName = mainChart.Name,
                            Data = dynamicData
                        };
                    }

                    DebugUtils.PrintWarning("No MainChart data found for dynamic extraction.");
                }
                catch (Exception e)
                {
                    DebugUtils.PrintError($"Failed to extract dynamic data: {e.Message}");
                }

                return null;
            }

            // Helper methods
            private TableData? ExtractTableFromChart(ChartData chart)
            {
                DebugUtils.Print($"Extracting table from chart: {chart.Name}...");
                if (chart.Data == null || chart.Data.Count == 0)
                {
                    DebugUtils.PrintWarning($"No data found in chart: {chart.Name}");
                    return null;
                }

                var tableData = new TableData
                {
                    TableName = chart.Name
                };

                foreach (var row in chart.Data)
                {
                    var tableRow = new List<object>();
                    foreach (var cell in row)
                    {
                        tableRow.Add(ExtractValueFromElement(cell));
                    }

                    tableData.Rows.Add(tableRow);
                }

                // Generate headers
                if (tableData.Rows.Any())
                {
                    tableData.Headers = Enumerable.Range(1, tableData.Rows[0].Count)
                        .Select(i => $"col_{i}")
                        .ToList();
                    DebugUtils.Print("Generated default headers for table.");
                }

                DebugUtils.PrintSuccess(
                    $"Extracted table: {tableData.TableName} with {tableData.Rows.Count} rows.");
                return tableData;
            }

            private object ExtractValueFromElement(JsonElement element)
            {
                return element.ValueKind switch
                {
                    JsonValueKind.Number => element.TryGetInt32(out int intVal) ? intVal :
                        element.TryGetInt64(out long longVal) ? longVal :
                        element.TryGetDouble(out double doubleVal) ? doubleVal : (object)element.GetRawText(),
                    JsonValueKind.String => HandleStringValue(element.GetString()!),
                    JsonValueKind.True => true,
                    JsonValueKind.False => false,
                    JsonValueKind.Null => null!,
                    _ => element.GetRawText()
                };
            }

            private object HandleStringValue(string value)
            {
                // Try to parse as integer
                if (int.TryParse(value, out int intResult))
                    return intResult;

                // Try to parse as long
                if (long.TryParse(value, out long longResult))
                    return longResult;

                // Try to parse as double
                if (double.TryParse(value, out double doubleResult))
                    return doubleResult;

                // Try to parse as boolean
                if (bool.TryParse(value, out bool boolResult))
                    return boolResult;

                // Return as string if no other parsing works
                return value;
            }

            private T? ConvertValue<T>(object value)
            {
                if (value == null) return default;

                try
                {
                    if (value is T typedValue)
                        return typedValue;

                    // Handle string to number conversions
                    var stringValue = value.ToString()!;
                    var targetType = typeof(T);

                    if (targetType == typeof(int) && int.TryParse(stringValue, out int intVal))
                        return (T)(object)intVal;

                    if (targetType == typeof(long) && long.TryParse(stringValue, out long longVal))
                        return (T)(object)longVal;

                    if (targetType == typeof(double) && double.TryParse(stringValue, out double doubleVal))
                        return (T)(object)doubleVal;

                    if (targetType == typeof(decimal) && decimal.TryParse(stringValue, out decimal decimalVal))
                        return (T)(object)decimalVal;

                    if (targetType == typeof(bool) && bool.TryParse(stringValue, out bool boolVal))
                        return (T)(object)boolVal;

                    if (targetType == typeof(string))
                        return (T)(object)stringValue;

                    // Fallback to Convert.ChangeType
                    return (T)Convert.ChangeType(value, targetType);
                }
                catch
                {
                    DebugUtils.PrintWarning($"Failed to convert value '{value}' to type {typeof(T).Name}.");
                    return default;
                }
            }

            /// <summary>
            /// Executes a SQL query against Unity Analytics API
            /// </summary>
            public async Task<string> ExecuteAnalyticsQuery(
                string projectId,
                string environmentId,
                string chartName,
                string bearerToken,
                string sqlQuery,
                CancellationToken ct)
            {
                DebugUtils.Print("Executing analytics query...");
                try
                {
                    var url =
                        $"https://services.unity.com/api/live-ops/composer/v2/projects/{projectId}/environments/{environmentId}/charts/{chartName}";

                    var request = new HttpRequestMessage(HttpMethod.Post, url);
                    request.Headers.Add("Authorization", $"Bearer {bearerToken}");
                    request.Headers.Add("Connection", "keep-alive");

                    var payload = new { sql = sqlQuery };
                    var jsonContent = JsonSerializer.Serialize(payload);
                    request.Content = new StringContent(jsonContent, Encoding.UTF8, "application/json");

                    DebugUtils.Print($"Sending request to Unity Analytics API: {url}");
                    DebugUtils.Print($"SQL Query: {sqlQuery}");
                    DebugUtils.Print(
                        $"Using Bearer Token: {bearerToken?.Substring(0, Math.Min(20, bearerToken.Length))}...");

                    var response = await _httpClient.SendAsync(request, ct);

                    if (!response.IsSuccessStatusCode)
                    {
                        var errorContent = await response.Content.ReadAsStringAsync(ct);
                        DebugUtils.PrintError($"API request failed: {response.StatusCode} - {errorContent}");
                        throw new HttpRequestException(
                            $"API request failed with status {response.StatusCode}: {errorContent}", null,
                            response.StatusCode);
                    }

                    var responseContent = await response.Content.ReadAsStringAsync(ct);
                    DebugUtils.PrintSuccess("Successfully executed analytics query.");
                    DebugUtils.Print($"Response length: {responseContent.Length} characters");

                    return responseContent;
                }
                catch (Exception e)
                {
                    DebugUtils.PrintError($"Failed to execute analytics query: {e.Message}");
                    throw;
                }
            }

            public class FetchConfigsData
            {
                public List<FetchRequest> FetchRequests { get; set; } = new();
            }
        }
    }
}