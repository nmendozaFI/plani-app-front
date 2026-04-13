/**
 * Shared API fetch utilities for communicating with the FastAPI backend.
 * Consolidates duplicate apiFetch implementations from lib/api.ts and action files.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export { API_BASE };

/**
 * Client-side API fetch with JSON handling and error extraction.
 * Use this in client components and lib/api.ts functions.
 */
export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      body.detail || `API error ${res.status}: ${res.statusText}`
    );
  }

  return res.json();
}

/**
 * Server-side API fetch with no-cache for server actions.
 * Use this in server actions that need fresh data.
 */
export async function apiFetchServer<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Error ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

/**
 * Fetch that returns a Blob (for file downloads like Excel exports).
 */
export async function apiFetchBlob(
  path: string,
  options?: RequestInit
): Promise<Blob> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, options);
  if (!res.ok) throw new Error("Error al descargar archivo");
  return res.blob();
}

/**
 * Upload a file via FormData (for imports).
 */
export async function apiUpload<T>(
  path: string,
  formData: FormData
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Error ${res.status}: ${res.statusText}`);
  }
  return res.json();
}
