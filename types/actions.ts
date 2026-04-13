/**
 * Shared action result type for server actions.
 * Discriminated union pattern for type-safe error handling.
 */

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };
