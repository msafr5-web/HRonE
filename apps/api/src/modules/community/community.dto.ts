import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, IsString, Length, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreatePostDto {
  /** Plain text. Rendered as text by clients – HTML is never interpreted. */
  @Transform(trim) @IsString() @Length(1, 3000) body: string;

  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsString({ each: true }) @MaxLength(31, { each: true })
  tags?: string[];
}

export class CreateCommentDto {
  @Transform(trim) @IsString() @Length(1, 1500) body: string;
}
