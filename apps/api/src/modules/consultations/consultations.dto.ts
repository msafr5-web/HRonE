import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';
import { PageQuery } from '../../common/utils/pagination';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateThreadDto {
  @Transform(trim) @IsString() @Length(8, 160) title: string;
  @Transform(trim) @IsString() @Length(20, 5000) body: string;
  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsString({ each: true }) @MaxLength(31, { each: true }) tags?: string[];
  /** Hide the author's identity publicly (kept internally for moderation). */
  @IsOptional() @IsBoolean() isAnonymous?: boolean;
  /** Only verified experts / admins may publish premium threads. */
  @IsOptional() @IsBoolean() isPremium?: boolean;
}

export class CreateReplyDto {
  @Transform(trim) @IsString() @Length(2, 3000) body: string;
  @IsOptional() @IsUUID() parentId?: string;
}

export class VoteDto {
  @Type(() => Number) @IsInt() @IsIn([-1, 0, 1]) value: -1 | 0 | 1;
}

export class ThreadListQuery extends PageQuery {
  @IsOptional() @IsIn(['all', 'unanswered', 'solved']) filter: 'all' | 'unanswered' | 'solved' = 'all';
}
