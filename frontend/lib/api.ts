import type { ApiErrorBody, ErrorCode, Operator, Vehicle, VehicleStatus } from './types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

/**
 * Carries the backend's stable `code` so the UI can react to the rule that was
 * violated, never to the wording of a message.
 */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.code = body.error;
    this.status = body.statusCode;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      cache: 'no-store',
    });
  } catch {
    throw new ApiError({
      statusCode: 0,
      error: 'INTERNAL_ERROR',
      message: 'Could not reach the fleet service. Check that the API is running.',
    });
  }

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      (payload as ApiErrorBody) ?? {
        statusCode: response.status,
        error: 'INTERNAL_ERROR',
        message: `Request failed with status ${response.status}.`,
      },
    );
  }

  return payload as T;
}

export const api = {
  listVehicles: () => request<Vehicle[]>('/vehicles'),
  listOperators: () => request<Operator[]>('/operators'),

  setStatus: (id: string, status: VehicleStatus) =>
    request<Vehicle>(`/vehicles/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  takeover: (id: string, operatorId: string) =>
    request<Vehicle>(`/vehicles/${id}/takeover`, {
      method: 'POST',
      body: JSON.stringify({ operatorId }),
    }),

  release: (id: string, operatorId: string) =>
    request<Vehicle>(`/vehicles/${id}/release`, {
      method: 'POST',
      body: JSON.stringify({ operatorId }),
    }),

  createVehicle: (name: string) =>
    request<Vehicle>('/vehicles', { method: 'POST', body: JSON.stringify({ name }) }),
};
