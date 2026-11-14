import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, IsUrl, Length, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class UpdateProfileDto {
  @IsOptional() @Transform(trim) @IsString() @Length(2, 50) displayName?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100) headline?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(500) bio?: string;
}

export class VerificationRequestDto {
  @IsIn(['HR_SPECIALIST', 'LEGAL_CONSULTANT'])
  requestedRole: 'HR_SPECIALIST' | 'LEGAL_CONSULTANT';

  @IsOptional() @Transform(trim) @IsString() @MaxLength(1000) notes?: string;

  /** Links to supporting evidence (licence, professional profile). File upload comes with the storage module. */
  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsUrl({ protocols: ['https'], require_protocol: true }, { each: true })
  documents?: string[];
}
