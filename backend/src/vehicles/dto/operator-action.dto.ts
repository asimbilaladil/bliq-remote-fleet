import { IsMongoId } from 'class-validator';

/**
 * Stands in for authentication: in a real deployment the operator identity
 * would come from the token, not the body. See README §Assumptions.
 */
export class OperatorActionDto {
  @IsMongoId({ message: 'operatorId must be a valid remote operator id' })
  operatorId!: string;
}
