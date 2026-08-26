import { Test } from '@nestjs/testing';
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection, Types } from 'mongoose';
import { VehiclesModule } from '../src/vehicles/vehicles.module';
import { ControlService } from '../src/control/control.service';
import { VehiclesService } from '../src/vehicles/vehicles.service';
import { VehicleRepository } from '../src/vehicles/repositories/vehicle.repository';
import { DomainError, ErrorCode } from '../src/common/errors/domain-error';

/**
 * The test that justifies the whole design.
 *
 * Everything above this file is an argument that the rules hold under
 * concurrency; this runs the actual races against a real MongoDB and counts
 * the winners. If the implementation ever regresses to read-then-write, these
 * fail — the unit tests would not.
 */
describe('Fleet control under concurrency', () => {
  let mongod: MongoMemoryServer;
  let connection: Connection;
  let control: ControlService;
  let vehicles: VehiclesService;
  let repo: VehicleRepository;
  let operatorA: string;
  let operatorB: string;

  const codeOf = (err: unknown): string =>
    err instanceof DomainError ? err.code : `UNEXPECTED:${String(err)}`;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();

    const moduleRef = await Test.createTestingModule({
      imports: [MongooseModule.forRoot(mongod.getUri()), VehiclesModule],
    }).compile();

    connection = moduleRef.get<Connection>(getConnectionToken());
    control = moduleRef.get(ControlService);
    vehicles = moduleRef.get(VehiclesService);
    repo = moduleRef.get(VehicleRepository);

    // The unique partial index is the enforcement mechanism — build it.
    await connection.syncIndexes();
  });

  afterAll(async () => {
    await connection.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    await connection.collection('vehicles').deleteMany({});
    await connection.collection('remote_operators').deleteMany({});
    await connection.collection('assignment_events').deleteMany({});

    const inserted = await connection.collection('remote_operators').insertMany([
      { name: 'Ada Kessler', email: 'ada@bliq.test', createdAt: new Date(), updatedAt: new Date() },
      { name: 'Bruno Marsh', email: 'bruno@bliq.test', createdAt: new Date(), updatedAt: new Date() },
    ]);
    operatorA = inserted.insertedIds[0].toString();
    operatorB = inserted.insertedIds[1].toString();
  });

  async function createOnlineVehicle(name: string): Promise<string> {
    const created = await repo.create({ name, status: 'online' });
    return created._id.toString();
  }

  it('lets exactly one of 20 simultaneous takeovers win', async () => {
    const vehicleId = await createOnlineVehicle('BLQ-014');

    // 20 distinct operators, all reaching for the same vehicle at once.
    const operatorDocs = await connection.collection('remote_operators').insertMany(
      Array.from({ length: 20 }, (_, i) => ({
        name: `Operator ${i}`,
        email: `op${i}@bliq.test`,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    );
    const operatorIds = Object.values(operatorDocs.insertedIds).map((id) => id.toString());

    const outcomes = await Promise.allSettled(
      operatorIds.map((operatorId) => control.takeover(vehicleId, operatorId)),
    );

    const won = outcomes.filter((o) => o.status === 'fulfilled');
    const lost = outcomes.filter((o) => o.status === 'rejected') as PromiseRejectedResult[];

    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(19);
    lost.forEach((l) => expect(codeOf(l.reason)).toBe(ErrorCode.VEHICLE_ALREADY_ASSIGNED));

    const stored = await connection.collection('vehicles').findOne({ _id: new Types.ObjectId(vehicleId) });
    expect(stored?.assignedOperatorId).not.toBeNull();
  });

  it('never lets one operator end up holding two vehicles', async () => {
    const first = await createOnlineVehicle('BLQ-011');
    const second = await createOnlineVehicle('BLQ-023');

    const outcomes = await Promise.allSettled([
      control.takeover(first, operatorA),
      control.takeover(second, operatorA),
    ]);

    expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1);

    const held = await connection
      .collection('vehicles')
      .countDocuments({ assignedOperatorId: new Types.ObjectId(operatorA) });
    expect(held).toBe(1);
  });

  it('refuses to take a vehicle offline while it is assigned', async () => {
    const vehicleId = await createOnlineVehicle('BLQ-031');
    await control.takeover(vehicleId, operatorA);

    await expect(vehicles.setStatus(vehicleId, 'offline')).rejects.toMatchObject({
      code: ErrorCode.VEHICLE_ASSIGNED_CANNOT_GO_OFFLINE,
    });

    const stored = await connection.collection('vehicles').findOne({ _id: new Types.ObjectId(vehicleId) });
    expect(stored?.status).toBe('online');
    expect(stored?.assignedOperatorId?.toString()).toBe(operatorA);
  });

  it('resolves a takeover racing a go-offline into one consistent state', async () => {
    const vehicleId = await createOnlineVehicle('BLQ-042');

    const [takeover, offline] = await Promise.allSettled([
      control.takeover(vehicleId, operatorA),
      vehicles.setStatus(vehicleId, 'offline'),
    ]);

    const stored = await connection.collection('vehicles').findOne({ _id: new Types.ObjectId(vehicleId) });

    // Whoever won, the forbidden combination must never exist.
    const isAssigned = stored?.assignedOperatorId !== null;
    const isOffline = stored?.status === 'offline';
    expect(isAssigned && isOffline).toBe(false);

    // And at least one of the two operations must have been rejected cleanly.
    expect([takeover.status, offline.status]).toContain('rejected');
  });

  it('allows a fresh takeover only after the holder releases', async () => {
    const vehicleId = await createOnlineVehicle('BLQ-057');
    await control.takeover(vehicleId, operatorA);

    await expect(control.takeover(vehicleId, operatorB)).rejects.toMatchObject({
      code: ErrorCode.VEHICLE_ALREADY_ASSIGNED,
    });

    await control.release(vehicleId, operatorA);
    const taken = await control.takeover(vehicleId, operatorB);
    expect(taken.assignedOperatorId).toBe(operatorB);
  });

  it('records the assignment history as an append-only fact log', async () => {
    const vehicleId = await createOnlineVehicle('BLQ-011');
    await control.takeover(vehicleId, operatorA);
    await control.release(vehicleId, operatorA);

    const events = await connection
      .collection('assignment_events')
      .find({ vehicleId: new Types.ObjectId(vehicleId) })
      .sort({ occurredAt: 1 })
      .toArray();

    expect(events.map((e) => e.type)).toEqual(['taken_over', 'released']);
  });
});
