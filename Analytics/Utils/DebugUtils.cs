using System;
using System.Collections;
using System.Text.Json;

namespace Utils
{
    /// <summary>
    /// Manages debug output with configurable print levels.
    /// </summary>
    public static class DebugUtils
    {
        public enum PRINT_LEVEL
        {
            NONE,
            ERRORS,
            ERRORS_WARNINGS,
            ERRORS_WARNINGS_SUCCESS,
            ALL
        }

        private static PRINT_LEVEL printLevel = PRINT_LEVEL.NONE;
        private static bool printCollections = false;

        public static void SetPrintLevel(PRINT_LEVEL newLevel)
        {
            DebugUtils.Print($"Setting debug print level to: {newLevel}");
            printLevel = newLevel;
            DebugUtils.PrintSuccess($"Debug print level set to {newLevel}");
        }

        public static void SetPrintCollections(bool enabled)
        {
            printCollections = enabled;
            DebugUtils.PrintSuccess($"Collection printing set to: {enabled}");
        }

        public static void PrintError(string text)
        {
            if (printLevel >= PRINT_LEVEL.ERRORS)
                Console.WriteLine($"❌ [ERROR] {text}");
        }

        public static void Print(string text)
        {
            if (printLevel >= PRINT_LEVEL.ALL)
                Console.WriteLine($"[PRINT] {text}");
        }

        public static void PrintSuccess(string text)
        {
            if (printLevel >= PRINT_LEVEL.ERRORS_WARNINGS_SUCCESS)
                Console.WriteLine($"✅ [SUCCESS] {text}");
        }

        public static void PrintWarning(string text)
        {
            if (printLevel >= PRINT_LEVEL.ERRORS_WARNINGS)
                Console.WriteLine($"⚠️ [WARNING] {text}");
        }

        /// <summary>
        /// Converts a collection to a readable string. 
        /// If printCollections is false, prints only the count.
        /// </summary>
        public static string CollectionToString(IEnumerable collection)
        {
            if (collection == null)
                return "null";

            try
            {
                int count = 0;
                foreach (var _ in collection)
                    count++;

                if (!printCollections)
                    return $"Collection (Count: {count})";

                var options = new JsonSerializerOptions { WriteIndented = true };
                return JsonSerializer.Serialize(collection, options);
            }
            catch (Exception ex)
            {
                return $"[Collection print error: {ex.Message}]";
            }
        }
    }
}