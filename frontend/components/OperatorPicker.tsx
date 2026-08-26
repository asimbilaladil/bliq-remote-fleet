'use client';

import type { Operator } from '@/lib/types';

interface Props {
  operators: Operator[];
  value: string | null;
  onChange: (id: string) => void;
  heldVehicleName: string | null;
}

/**
 * Stands in for signing in. Choosing an operator here is what a session/token
 * would provide in production — see README §Assumptions.
 */
export function OperatorPicker({ operators, value, onChange, heldVehicleName }: Props) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <label htmlFor="operator" className="text-sm text-slate-400">
        Operating as
      </label>
      <select
        id="operator"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[44px] rounded-lg border border-edge bg-panel px-3 text-sm text-slate-200
          focus:border-sky-500/60 focus:outline-none"
      >
        <option value="" disabled>
          Select a remote operator…
        </option>
        {operators.map((operator) => (
          <option key={operator.id} value={operator.id}>
            {operator.name}
          </option>
        ))}
      </select>
      <span className="text-xs text-slate-500">
        {heldVehicleName ? `Currently operating ${heldVehicleName}` : 'Holding no vehicle'}
      </span>
    </div>
  );
}
