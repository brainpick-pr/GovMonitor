/**
 * JSON utilities
 */

/**
 * Extract value from nested JSON object using dot notation path
 * @param obj - The JSON object
 * @param path - Dot-separated path (e.g., "data.status.health")
 * @returns The value at the path, or undefined if not found
 */
export function getJsonValue(obj: any, path: string): any {
  const keys = path.split('.');
  let value = obj;

  for (const key of keys) {
    if (value === null || value === undefined) return undefined;
    value = value[key];
  }

  return value;
}
