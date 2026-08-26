import { Connection } from 'mongoose';

export const SEED_OPERATORS = [
  { name: 'Ada Kessler', email: 'ada@bliq.test' },
  { name: 'Bruno Marsh', email: 'bruno@bliq.test' },
  { name: 'Chiara Vogt', email: 'chiara@bliq.test' },
];

export const SEED_VEHICLES = [
  { name: 'BLQ-011', status: 'online' },
  { name: 'BLQ-014', status: 'online' },
  { name: 'BLQ-023', status: 'offline' },
  { name: 'BLQ-031', status: 'online' },
  { name: 'BLQ-042', status: 'offline' },
  { name: 'BLQ-057', status: 'online' },
];

/**
 * Idempotent: safe to run repeatedly against the same database.
 * Existing vehicles are left untouched so a demo session is not reset.
 */
export async function seed(connection: Connection): Promise<void> {
  const operators = connection.collection('remote_operators');
  const vehicles = connection.collection('vehicles');

  for (const operator of SEED_OPERATORS) {
    await operators.updateOne(
      { email: operator.email },
      { $setOnInsert: { ...operator, createdAt: new Date(), updatedAt: new Date() } },
      { upsert: true },
    );
  }

  for (const vehicle of SEED_VEHICLES) {
    await vehicles.updateOne(
      { name: vehicle.name },
      {
        $setOnInsert: {
          ...vehicle,
          assignedOperatorId: null,
          assignedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );
  }
}
