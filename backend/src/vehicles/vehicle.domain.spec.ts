import { VehicleRules, VehicleState } from './vehicle.domain';

const OP_A = 'operator-a';
const OP_B = 'operator-b';

const vehicle = (over: Partial<VehicleState> = {}): VehicleState => ({
  id: 'v1',
  name: 'BLQ-014',
  status: 'online',
  assignedOperatorId: null,
  ...over,
});

/** Pure rules, no mocks, no database — the rules read as a spec. */
describe('VehicleRules', () => {
  describe('canBeTakenBy', () => {
    it('allows taking an online, unassigned vehicle', () => {
      expect(VehicleRules.canBeTakenBy(vehicle(), OP_A)).toBeNull();
    });

    it('refuses an offline vehicle', () => {
      expect(VehicleRules.canBeTakenBy(vehicle({ status: 'offline' }), OP_A)).toBe('VEHICLE_OFFLINE');
    });

    it('refuses a vehicle held by another operator', () => {
      expect(VehicleRules.canBeTakenBy(vehicle({ assignedOperatorId: OP_B }), OP_A)).toBe(
        'VEHICLE_ALREADY_ASSIGNED',
      );
    });

    it('treats re-taking your own vehicle as allowed', () => {
      expect(VehicleRules.canBeTakenBy(vehicle({ assignedOperatorId: OP_A }), OP_A)).toBeNull();
    });

    it('checks connectivity before assignment', () => {
      expect(
        VehicleRules.canBeTakenBy(vehicle({ status: 'offline', assignedOperatorId: OP_B }), OP_A),
      ).toBe('VEHICLE_OFFLINE');
    });
  });

  describe('canChangeStatusTo', () => {
    it('refuses going offline while assigned', () => {
      expect(VehicleRules.canChangeStatusTo(vehicle({ assignedOperatorId: OP_A }), 'offline')).toBe(
        'VEHICLE_ASSIGNED_CANNOT_GO_OFFLINE',
      );
    });

    it('allows going offline when free', () => {
      expect(VehicleRules.canChangeStatusTo(vehicle(), 'offline')).toBeNull();
    });

    it('always allows coming online, assigned or not', () => {
      expect(VehicleRules.canChangeStatusTo(vehicle({ status: 'offline' }), 'online')).toBeNull();
      expect(
        VehicleRules.canChangeStatusTo(vehicle({ assignedOperatorId: OP_A }), 'online'),
      ).toBeNull();
    });
  });

  describe('canBeReleasedBy', () => {
    it('allows the holder to release', () => {
      expect(VehicleRules.canBeReleasedBy(vehicle({ assignedOperatorId: OP_A }), OP_A)).toBeNull();
    });

    it('refuses a non-holder', () => {
      expect(VehicleRules.canBeReleasedBy(vehicle({ assignedOperatorId: OP_B }), OP_A)).toBe(
        'NOT_HOLDER',
      );
    });
  });
});
