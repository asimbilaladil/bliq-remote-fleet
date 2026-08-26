'use client';

import { useMemo, useState } from 'react';
import { useFleet } from '@/hooks/useFleet';
import { useToasts } from '@/hooks/useToasts';
import { api, ApiError } from '@/lib/api';
import type { Vehicle, VehicleStatus } from '@/lib/types';
import { VehicleCard } from '@/components/VehicleCard';
import { OperatorPicker } from '@/components/OperatorPicker';
import { Toaster } from '@/components/Toaster';
import { EmptyState, ErrorPanel, LoadingGrid } from '@/components/States';

export default function FleetPage() {
  const { vehicles, operators, loading, error, pending, act, refresh } = useFleet();
  const toasts = useToasts();
  const [operatorId, setOperatorId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const heldVehicle = useMemo(
    () => vehicles.find((v) => v.assignedOperatorId === operatorId) ?? null,
    [vehicles, operatorId],
  );

  const onlineCount = vehicles.filter((v) => v.status === 'online').length;
  const assignedCount = vehicles.filter((v) => v.assignedOperatorId).length;

  async function run(
    vehicle: Vehicle,
    optimistic: (v: Vehicle) => Vehicle,
    call: () => Promise<Vehicle>,
    successMessage: string,
  ) {
    const result = await act(vehicle.id, optimistic, call);
    if (result.ok) toasts.success(successMessage);
    else toasts.error(result.message);
  }

  const setStatus = (vehicle: Vehicle, status: VehicleStatus) =>
    run(
      vehicle,
      (v) => ({ ...v, status }),
      () => api.setStatus(vehicle.id, status),
      `${vehicle.name} is now ${status}.`,
    );

  const takeover = (vehicle: Vehicle) => {
    if (!operatorId) return;
    return run(
      vehicle,
      (v) => ({ ...v, assignedOperatorId: operatorId, assignedOperatorName: 'You' }),
      () => api.takeover(vehicle.id, operatorId),
      `You are now operating ${vehicle.name}.`,
    );
  };

  const release = (vehicle: Vehicle) => {
    if (!operatorId) return;
    return run(
      vehicle,
      (v) => ({ ...v, assignedOperatorId: null, assignedOperatorName: null, assignedAt: null }),
      () => api.release(vehicle.id, operatorId),
      `${vehicle.name} released.`,
    );
  };

  async function addVehicle() {
    setAdding(true);
    try {
      await api.createVehicle(`BLQ-${Math.floor(100 + Math.random() * 899)}`);
      await refresh();
      toasts.success('Vehicle added to the fleet.');
    } catch (err) {
      toasts.error(err instanceof ApiError ? err.message : 'Could not add the vehicle.');
    } finally {
      setAdding(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-8 flex flex-col gap-5">
        <div>
          <h1 className="text-xl font-semibold text-slate-100 sm:text-2xl">Remote Fleet Control</h1>
          <p className="mt-1 text-sm text-slate-400">
            {loading
              ? 'Loading fleet…'
              : `${vehicles.length} vehicles · ${onlineCount} online · ${assignedCount} being operated`}
          </p>
        </div>

        <OperatorPicker
          operators={operators}
          value={operatorId}
          onChange={setOperatorId}
          heldVehicleName={heldVehicle?.name ?? null}
        />
      </header>

      {loading ? (
        <LoadingGrid />
      ) : error ? (
        <ErrorPanel message={error} onRetry={refresh} />
      ) : vehicles.length === 0 ? (
        <EmptyState onAdd={addVehicle} busy={adding} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {vehicles.map((vehicle) => (
            <VehicleCard
              key={vehicle.id}
              vehicle={vehicle}
              operatorId={operatorId}
              busy={Boolean(pending[vehicle.id])}
              onSetStatus={(status) => void setStatus(vehicle, status)}
              onTakeover={() => void takeover(vehicle)}
              onRelease={() => void release(vehicle)}
            />
          ))}
        </div>
      )}

      <Toaster toasts={toasts.toasts} onDismiss={toasts.dismiss} />
    </main>
  );
}
