import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection } from 'mongoose';
import request from 'supertest';
import { VehiclesModule } from '../src/vehicles/vehicles.module';
import { OperatorsModule } from '../src/operators/operators.module';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';

/**
 * Thin HTTP-level pass: status codes and the SHAPE of the error envelope the
 * frontend depends on. The rules themselves are covered above; this asserts
 * the wiring and the contract.
 */
describe('Fleet API (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let connection: Connection;
  let operatorId: string;
  let vehicleId: string;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();

    const moduleRef = await Test.createTestingModule({
      imports: [MongooseModule.forRoot(mongod.getUri()), VehiclesModule, OperatorsModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();

    connection = moduleRef.get<Connection>(getConnectionToken());
    await connection.syncIndexes();

    const op = await connection
      .collection('remote_operators')
      .insertOne({ name: 'Ada Kessler', email: 'ada@bliq.test', createdAt: new Date(), updatedAt: new Date() });
    operatorId = op.insertedId.toString();
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  it('creates a vehicle, offline by default', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/vehicles')
      .send({ name: 'BLQ-014' })
      .expect(201);

    expect(res.body).toMatchObject({ name: 'BLQ-014', status: 'offline', assignedOperatorId: null });
    vehicleId = res.body.id;
  });

  it('rejects an invalid payload with a VALIDATION_FAILED envelope', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/vehicles')
      .send({ name: 'x', bogus: true })
      .expect(400);

    expect(res.body).toMatchObject({ statusCode: 400, error: 'VALIDATION_FAILED' });
    expect(typeof res.body.message).toBe('string');
  });

  it('refuses takeover of an offline vehicle with 409 VEHICLE_OFFLINE', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/vehicles/${vehicleId}/takeover`)
      .send({ operatorId })
      .expect(409);

    expect(res.body.error).toBe('VEHICLE_OFFLINE');
  });

  it('brings the vehicle online, then takes it over', async () => {
    await request(app.getHttpServer())
      .patch(`/api/vehicles/${vehicleId}/status`)
      .send({ status: 'online' })
      .expect(200);

    const res = await request(app.getHttpServer())
      .post(`/api/vehicles/${vehicleId}/takeover`)
      .send({ operatorId })
      .expect(200);

    expect(res.body.assignedOperatorId).toBe(operatorId);
    expect(res.body.assignedOperatorName).toBe('Ada Kessler');
  });

  it('refuses to go offline while assigned', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/vehicles/${vehicleId}/status`)
      .send({ status: 'offline' })
      .expect(409);

    expect(res.body.error).toBe('VEHICLE_ASSIGNED_CANNOT_GO_OFFLINE');
  });

  it('refuses to delete while assigned, and allows it after release', async () => {
    await request(app.getHttpServer()).delete(`/api/vehicles/${vehicleId}`).expect(409);

    await request(app.getHttpServer())
      .post(`/api/vehicles/${vehicleId}/release`)
      .send({ operatorId })
      .expect(200);

    await request(app.getHttpServer()).delete(`/api/vehicles/${vehicleId}`).expect(204);
  });

  it('returns 404 with VEHICLE_NOT_FOUND for a missing vehicle', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/vehicles/507f1f77bcf86cd799439011')
      .expect(404);

    expect(res.body.error).toBe('VEHICLE_NOT_FOUND');
  });

  it('rejects a malformed id as a validation error, not a 500', async () => {
    const res = await request(app.getHttpServer()).get('/api/vehicles/not-an-id').expect(400);
    expect(res.body.error).toBe('VALIDATION_FAILED');
  });
});
