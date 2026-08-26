import type { Vehicle } from './types';

/**
 * The same rules the backend enforces, mirrored here for ONE purpose: telling
 * the operator why a button is disabled before they press it. The server
 * remains the only authority — every action is still sent and can still be
 * rejected, and the UI reconciles with whatever the server answers.
 */
export function takeoverBlockedReason(vehicle: Vehicle, operatorId: string | null): string | null {
  if (!operatorId) return 'Select who you are operating as first.';
  if (vehicle.assignedOperatorId === operatorId) return 'You are already operating this vehicle.';
  if (vehicle.status !== 'online') return 'Vehicle is offline — bring it online first.';
  if (vehicle.assignedOperatorId) return `Held by ${vehicle.assignedOperatorName ?? 'another operator'}.`;
  return null;
}

export function releaseBlockedReason(vehicle: Vehicle, operatorId: string | null): string | null {
  if (!operatorId) return 'Select who you are operating as first.';
  if (!vehicle.assignedOperatorId) return 'Nobody is operating this vehicle.';
  if (vehicle.assignedOperatorId !== operatorId) return 'Only the current operator can release it.';
  return null;
}

export function offlineBlockedReason(vehicle: Vehicle): string | null {
  if (vehicle.status === 'offline') return 'Already offline.';
  if (vehicle.assignedOperatorId) return 'Assigned — the operator must release it first.';
  return null;
}

export function onlineBlockedReason(vehicle: Vehicle): string | null {
  return vehicle.status === 'online' ? 'Already online.' : null;
}
