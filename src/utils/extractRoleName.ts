/**
 * Extract a human-readable role name from a capability role value.
 *
 * TDB returns role identifiers in multiple formats depending on version and
 * whether normalisation fully resolved the JSON-LD object:
 *
 * 1. Clean name string: "Admin Role" → pass through
 * 2. JSON-LD @id path: "Role/admin" → strip prefix → "admin"
 * 3. JSON-stringified object: '{"@id":"Role/admin","name":"Admin Role"}' → parse → extract "name"
 * 4. JSON-stringified array: '[{"@id":"Role/admin","name":"Admin Role"}]' → parse first element → extract "name"
 *
 * This function handles all variants defensively and always returns a plain string.
 */
export function extractRoleName(role: string): string {
  const trimmed = role.trim();

  // Attempt JSON parse if it looks like JSON (starts with { or [)
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      return extractFromParsed(parsed);
    } catch {
      // Not valid JSON — fall through to path handling
    }
  }

  // If it looks like a JSON-LD @id path (e.g. "Role/admin"), extract the last segment
  if (trimmed.includes("/") && !trimmed.includes(" ")) {
    return trimmed.split("/").pop() ?? trimmed;
  }

  return trimmed;
}

/** Extract role name from a parsed JSON value */
function extractFromParsed(value: unknown): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return "Unknown";
    return extractFromParsed(value[0]);
  }

  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    // Prefer "name" field, fall back to "@id" stripped of prefix
    if (typeof obj["name"] === "string" && obj["name"].length > 0) {
      return obj["name"];
    }
    if (typeof obj["@id"] === "string" && obj["@id"].length > 0) {
      const id = obj["@id"];
      return id.includes("/") ? (id.split("/").pop() ?? id) : id;
    }
    return JSON.stringify(value);
  }

  if (typeof value === "string") {
    return value;
  }

  return String(value);
}
