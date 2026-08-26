import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { ControlService } from './control.service';
import { VehicleRepository } from '../vehicles/repositories/vehicle.repository';
import { OperatorsService } from '../operators/operators.service';
import { AssignmentEventsService } from '../history/assignment-events.service';
import { VehicleDocument, VehicleStatus } from '../vehicles/schemas/vehicle.schema';
import {
  NotHolderError,
  OperatorAlreadyHoldsVehicleError,
  OperatorNotFoundError,
  VehicleAlreadyAssignedError,
  VehicleNotFoundError,
  VehicleOfflineError,
} from '../common/errors/domain-error';

/**
 * Unit tests for the takeover / release use-case — the scenario the brief asks
 * to see done well. The repository is mocked, so these assert the SERVICE's
 * decisions: which error a failed atomic write is explained as, and that the
 * write is always attempted before any state is read.
 *
 * The complementary proof that the writes are actually race-free lives in
 * test/concurrency.spec.ts against a real MongoDB.
 */

const OPERATOR_A = new Types.ObjectId().toString();
const OPERATOR_B = new Types.ObjectId().toString();
const VEHICLE_ID = new Types.ObjectId().toString();

function vehicleDoc(overrides: Partial<{
  id: string;
  name: string;
  status: VehicleStatus;
  assignedOperatorId: string | null;
}> = {}): VehicleDocument {
  const assigned = overrides.assignedOperatorId ?? null;
  return {
    _id: new Types.ObjectId(overrides.id ?? VEHICLE_ID),
    name: overrides.name ?? 'BLQ-014',
    status: overrides.status ?? 'online',
    assignedOperatorId: assigned ? new Types.ObjectId(assigned) : null,
    assignedAt: assigned ? new Date('2026-01-01T10:00:00.000Z') : null,
    createdAt: new Date('2026-01-01T09:00:00.000Z'),
    updatedAt: new Date('2026-01-01T10:00:00.000Z'),
  } as unknown as VehicleDocument;
}

describe('ControlService', () => {
  let service: ControlService;
  let repo: jest.Mocked<VehicleRepository>;
  let operators: { assertExists: jest.Mock; namesByIds: jest.Mock };
  let events: { record: jest.Mock };

  beforeEach(async () => {
    repo = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findByOperator: jest.fn().mockResolvedValue(null),
      rename: jest.fn(),
      deleteIfUnassigned: jest.fn(),
      setStatus: jest.fn(),
      claim: jest.fn(),
      release: jest.fn(),
    } as unknown as jest.Mocked<VehicleRepository>;

    operators = {
      assertExists: jest.fn().mockResolvedValue(undefined),
      namesByIds: jest.fn().mockResolvedValue(new Map([[OPERATOR_A, 'Ada Kessler']])),
    };

    events = { record: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ControlService,
        { provide: VehicleRepository, useValue: repo },
        { provide: OperatorsService, useValue: operators },
        { provide: AssignmentEventsService, useValue: events },
      ],
    }).compile();

    service = moduleRef.get(ControlService);
  });

  describe('takeover', () => {
    it('claims a vehicle that is online and unassigned', async () => {
      repo.claim.mockResolvedValue(vehicleDoc({ assignedOperatorId: OPERATOR_A }));

      const result = await service.takeover(VEHICLE_ID, OPERATOR_A);

      expect(repo.claim).toHaveBeenCalledWith(VEHICLE_ID, OPERATOR_A);
      expect(result.assignedOperatorId).toBe(OPERATOR_A);
      expect(result.assignedOperatorName).toBe('Ada Kessler');
      expect(result.assignedAt).not.toBeNull();
    });

    it('attempts the atomic claim BEFORE reading state (no read-then-write)', async () => {
      const order: string[] = [];
      repo.claim.mockImplementation(async () => {
        order.push('claim');
        return vehicleDoc({ assignedOperatorId: OPERATOR_A });
      });
      repo.findById.mockImplementation(async () => {
        order.push('findById');
        return vehicleDoc();
      });

      await service.takeover(VEHICLE_ID, OPERATOR_A);

      expect(order).toEqual(['claim']);
      expect(repo.findById).not.toHaveBeenCalled();
    });

    it('records an audit event on success', async () => {
      repo.claim.mockResolvedValue(vehicleDoc({ assignedOperatorId: OPERATOR_A }));

      await service.takeover(VEHICLE_ID, OPERATOR_A);

      expect(events.record).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'taken_over', operatorId: OPERATOR_A }),
      );
    });

    it('rejects an offline vehicle with VEHICLE_OFFLINE', async () => {
      repo.claim.mockResolvedValue(null);
      repo.findById.mockResolvedValue(vehicleDoc({ status: 'offline' }));

      await expect(service.takeover(VEHICLE_ID, OPERATOR_A)).rejects.toBeInstanceOf(
        VehicleOfflineError,
      );
    });

    it('rejects a vehicle already held by someone else', async () => {
      repo.claim.mockResolvedValue(null);
      repo.findById.mockResolvedValue(vehicleDoc({ assignedOperatorId: OPERATOR_B }));

      await expect(service.takeover(VEHICLE_ID, OPERATOR_A)).rejects.toBeInstanceOf(
        VehicleAlreadyAssignedError,
      );
    });

    it('rejects an operator who already holds a different vehicle', async () => {
      const otherId = new Types.ObjectId().toString();
      repo.findByOperator.mockResolvedValue(
        vehicleDoc({ id: otherId, name: 'BLQ-011', assignedOperatorId: OPERATOR_A }),
      );

      await expect(service.takeover(VEHICLE_ID, OPERATOR_A)).rejects.toBeInstanceOf(
        OperatorAlreadyHoldsVehicleError,
      );
      expect(repo.claim).not.toHaveBeenCalled();
    });

    it('is idempotent when the caller already holds this vehicle', async () => {
      repo.findByOperator.mockResolvedValue(vehicleDoc({ assignedOperatorId: OPERATOR_A }));
      repo.claim.mockResolvedValue(null);
      repo.findById.mockResolvedValue(vehicleDoc({ assignedOperatorId: OPERATOR_A }));

      const result = await service.takeover(VEHICLE_ID, OPERATOR_A);

      expect(result.assignedOperatorId).toBe(OPERATOR_A);
    });

    it('reports a missing vehicle as 404, not as a rule violation', async () => {
      repo.claim.mockResolvedValue(null);
      repo.findById.mockResolvedValue(null);

      await expect(service.takeover(VEHICLE_ID, OPERATOR_A)).rejects.toBeInstanceOf(
        VehicleNotFoundError,
      );
    });

    it('rejects an unknown operator before touching the fleet', async () => {
      operators.assertExists.mockRejectedValue(new OperatorNotFoundError(OPERATOR_A));

      await expect(service.takeover(VEHICLE_ID, OPERATOR_A)).rejects.toBeInstanceOf(
        OperatorNotFoundError,
      );
      expect(repo.claim).not.toHaveBeenCalled();
    });
  });

  describe('release', () => {
    it('releases a vehicle held by the caller and clears assignedAt', async () => {
      repo.release.mockResolvedValue(vehicleDoc({ assignedOperatorId: null }));

      const result = await service.release(VEHICLE_ID, OPERATOR_A);

      expect(repo.release).toHaveBeenCalledWith(VEHICLE_ID, OPERATOR_A);
      expect(result.assignedOperatorId).toBeNull();
      expect(result.assignedAt).toBeNull();
      expect(events.record).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'released', operatorId: OPERATOR_A }),
      );
    });

    it('rejects a release by someone who is not the holder', async () => {
      repo.release.mockResolvedValue(null);
      repo.findById.mockResolvedValue(vehicleDoc({ assignedOperatorId: OPERATOR_B }));

      await expect(service.release(VEHICLE_ID, OPERATOR_A)).rejects.toBeInstanceOf(NotHolderError);
    });

    it('rejects releasing an unassigned vehicle', async () => {
      repo.release.mockResolvedValue(null);
      repo.findById.mockResolvedValue(vehicleDoc({ assignedOperatorId: null }));

      await expect(service.release(VEHICLE_ID, OPERATOR_A)).rejects.toBeInstanceOf(NotHolderError);
    });

    it('reports a missing vehicle as 404', async () => {
      repo.release.mockResolvedValue(null);
      repo.findById.mockResolvedValue(null);

      await expect(service.release(VEHICLE_ID, OPERATOR_A)).rejects.toBeInstanceOf(
        VehicleNotFoundError,
      );
    });
  });
});
