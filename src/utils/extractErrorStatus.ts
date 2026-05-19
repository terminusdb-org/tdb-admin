/**
 * Extract the HTTP status code from an RTK Query error.
 *
 * RTK Query's FetchBaseQueryError has shape: { status: number; data: unknown }
 * This helper safely extracts the status without casting to `any`.
 */
export function extractErrorStatus(err: unknown): number | undefined {
  if (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    typeof (err as Record<string, unknown>).status === "number"
  ) {
    return (err as Record<string, unknown>).status as number;
  }
  return undefined;
}

/**
 * Extract the human-readable error message from a TDB API error response.
 *
 * TDB returns errors with shape: { "api:message": "..." }
 * RTK Query wraps this as: { status: number; data: { "api:message": "..." } }
 */
export function extractApiMessage(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null) return undefined;

  const errorObj = err as Record<string, unknown>;
  const data = errorObj.data;

  if (typeof data !== "object" || data === null) return undefined;

  const dataObj = data as Record<string, unknown>;
  const message = dataObj["api:message"];

  if (typeof message === "string" && message.length > 0) {
    return message;
  }

  return undefined;
}

/**
 * Check if an RTK Query error represents a "conflict" / "already exists" condition.
 *
 * TDB returns HTTP 400 (not 409) for duplicate entity creation. The error body
 * contains "api:message" with text like "... already existed...".
 * Some proxy/mediation layer responses may use 409.
 *
 * This helper checks both status codes and the message body.
 */
export function isConflictError(err: unknown): boolean {
  const status = extractErrorStatus(err);
  if (status === 409) return true;

  if (status === 400) {
    const message = extractApiMessage(err);
    if (message && /already exist/i.test(message)) {
      return true;
    }
  }

  return false;
}
