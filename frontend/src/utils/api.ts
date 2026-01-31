/**
 * API client utilities with authentication support
 */

/**
 * Fetch with automatic authentication header injection
 */
export async function fetchWithAuth(url: string, options?: RequestInit): Promise<Response> {
  const apiKey = localStorage.getItem('govmonitor_api_key');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Merge existing headers
  if (options?.headers) {
    const existingHeaders = new Headers(options.headers);
    existingHeaders.forEach((value, key) => {
      headers[key] = value;
    });
  }

  // Add Authorization header if API key exists
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Fetch JSON with authentication
 */
export async function fetchJSON<T = any>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetchWithAuth(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `HTTP ${response.status}`;

    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.message || errorJson.error || errorMessage;
    } catch {
      errorMessage = errorText || errorMessage;
    }

    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * API helper methods
 */
export const api = {
  /**
   * GET request with auth
   */
  get: async <T = any>(url: string): Promise<T> => {
    return fetchJSON<T>(url, { method: 'GET' });
  },

  /**
   * POST request with auth
   */
  post: async <T = any>(url: string, data?: any): Promise<T> => {
    return fetchJSON<T>(url, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  },

  /**
   * PUT request with auth
   */
  put: async <T = any>(url: string, data?: any): Promise<T> => {
    return fetchJSON<T>(url, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  },

  /**
   * DELETE request with auth
   */
  delete: async <T = any>(url: string): Promise<T> => {
    return fetchJSON<T>(url, { method: 'DELETE' });
  },
};

/**
 * Get API base URL
 */
export function getApiUrl(): string {
  return import.meta.env.VITE_API_URL || '/api';
}
