'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { Operator, Vehicle } from '@/lib/types';

const POLL_INTERVAL_MS = 5000;

interface FleetState {
  vehicles: Vehicle[];
  operators: Operator[];
  loading: boolean;
  error: string | null;
}

/**
 * Owns fleet state for the screen.
 *
 * Polling stands in for a realtime feed: assignment is shared state, so a
 * second operator's takeover must appear here without a manual refresh. In a
 * real deployment this would be a WebSocket/SSE subscription driven by the
 * backend's assignment events — see README §Evolution.
 */
export function useFleet() {
  const [state, setState] = useState<FleetState>({
    vehicles: [],
    operators: [],
    loading: true,
    error: null,
  });
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const mounted = useRef(true);

  const load = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const [vehicles, operators] = await Promise.all([api.listVehicles(), api.listOperators()]);
      if (!mounted.current) return;
      setState({ vehicles, operators, loading: false, error: null });
    } catch (err) {
      if (!mounted.current) return;
      const message = err instanceof ApiError ? err.message : 'Something went wrong loading the fleet.';
      // A failed background poll must not blank out a screen that is working.
      setState((s) => ({ ...s, loading: false, error: showSpinner ? message : s.error }));
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load(true);

    const timer = setInterval(() => void load(false), POLL_INTERVAL_MS);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, [load]);

  const replaceVehicle = useCallback((updated: Vehicle) => {
    setState((s) => ({
      ...s,
      vehicles: s.vehicles.map((v) => (v.id === updated.id ? updated : v)),
    }));
  }, []);

  /**
   * Runs one action optimistically and reconciles with the server.
   * On rejection the optimistic patch is rolled back and the SERVER's message
   * is surfaced — the user is told which rule stopped them, not "failed".
   */
  const act = useCallback(
    async (
      vehicleId: string,
      optimistic: (vehicle: Vehicle) => Vehicle,
      call: () => Promise<Vehicle>,
    ): Promise<{ ok: true; vehicle: Vehicle } | { ok: false; message: string }> => {
      const snapshot = state.vehicles.find((v) => v.id === vehicleId);
      if (!snapshot) return { ok: false, message: 'That vehicle is no longer in the fleet.' };

      setPending((p) => ({ ...p, [vehicleId]: true }));
      replaceVehicle(optimistic(snapshot));

      try {
        const updated = await call();
        replaceVehicle(updated);
        return { ok: true, vehicle: updated };
      } catch (err) {
        replaceVehicle(snapshot); // roll back
        void load(false); // and resync, in case the world moved on
        return {
          ok: false,
          message: err instanceof ApiError ? err.message : 'The action could not be completed.',
        };
      } finally {
        setPending((p) => ({ ...p, [vehicleId]: false }));
      }
    },
    [state.vehicles, replaceVehicle, load],
  );

  return {
    ...state,
    pending,
    act,
    refresh: () => load(true),
  };
}
