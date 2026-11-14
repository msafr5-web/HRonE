import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateReportDto {
  @IsIn(['POST', 'COMMENT', 'THREAD', 'REPLY', 'USER']) targetType: 'POST' | 'COMMENT' | 'THREAD' | 'REPLY' | 'USER';
  @IsUUID() targetId: string;
  @Transform(trim) @IsString() @Length(3, 500) reason: string;
}

export class ReviewDto {
  @IsOptional() @Transform(trim) @IsString() @Length(0, 500) note?: string;
}

export class GrantDto {
  @Transform(trim) @IsString() @Length(3, 20) username: string;
  @IsIn(['MONTH', 'YEAR']) interval: 'MONTH' | 'YEAR';
  @Type(() => Number) @IsInt() @Min(1) @Max(400) days: number;
}
