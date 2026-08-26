'use client';

import type { Vehicle } from '@/lib/types';
import {
  offlineBlockedReason,
  onlineBlockedReason,
  releaseBlockedReason,
  takeoverBlockedReason,
} from '@/lib/rules';
import { ActionButton } from './ActionButton';
import { ControlBadge, StatusBadge } from './StatusBadge';

interface Props {
  vehicle: Vehicle;
  operatorId: string | null;
  busy: boolean;
  onSetStatus: (status: 'online' | 'offline') => void;
  onTakeover: () => void;
  onRelease: () => void;
}

export function VehicleCard({ vehicle, operatorId, busy, onSetStatus, onTakeover, onRelease }: Props) {
  return (
    <article className="flex flex-col gap-4 rounded-xl border border-edge bg-panel p-4 sm:p-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-100">{vehicle.name}</h2>
          {vehicle.assignedAt && (
            <p className="mt-0.5 text-xs text-slate-500">
              Since {new Date(vehicle.assignedAt).toLocaleTimeString()}
            </p>
          )}
        </div>
        <StatusBadge vehicle={vehicle} />
      </header>

      <ControlBadge vehicle={vehicle} youId={operatorId} />

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <ActionButton
            label="Set online"
            onClick={() => onSetStatus('online')}
            disabledReason={onlineBlockedReason(vehicle)}
            busy={busy}
          />
          <ActionButton
            label="Set offline"
            onClick={() => onSetStatus('offline')}
            disabledReason={offlineBlockedReason(vehicle)}
            busy={busy}
            variant="danger"
          />
        </div>
        <div className="flex gap-2">
          <ActionButton
            label="Take over"
            onClick={onTakeover}
            disabledReason={takeoverBlockedReason(vehicle, operatorId)}
            busy={busy}
            variant="primary"
          />
          <ActionButton
            label="Release"
            onClick={onRelease}
            disabledReason={releaseBlockedReason(vehicle, operatorId)}
            busy={busy}
          />
        </div>
      </div>
    </article>
  );
}
