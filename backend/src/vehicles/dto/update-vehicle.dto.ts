import { IsString, Length, Matches } from 'class-validator';

export class UpdateVehicleDto {
  @IsString()
  @Length(2, 64, { message: 'name must be between 2 and 64 characters' })
  @Matches(/^[\w\- ]+$/, { message: 'name may contain letters, numbers, spaces, hyphens and underscores' })
  name!: string;
}
