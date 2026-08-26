import type { Vehicle } from '@/lib/types';

export function StatusBadge({ vehicle }: { vehicle: Vehicle }) {
  const online = vehicle.status === 'online';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        online ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-500/15 text-slate-400'
      }`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-emerald-400' : 'bg-slate-500'}`}
      />
      {online ? 'Online' : 'Offline'}
    </span>
  );
}

export function ControlBadge({ vehicle, youId }: { vehicle: Vehicle; youId: string | null }) {
  if (!vehicle.assignedOperatorId) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-500/10 px-2.5 py-1 text-xs text-slate-400">
        Unassigned
      </span>
    );
  }

  const isYou = vehicle.assignedOperatorId === youId;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
        isYou ? 'bg-sky-500/15 text-sky-300' : 'bg-amber-500/15 text-amber-300'
      }`}
    >
      {isYou ? 'You are operating' : `Held by ${vehicle.assignedOperatorName ?? 'another operator'}`}
    </span>
  );
}
