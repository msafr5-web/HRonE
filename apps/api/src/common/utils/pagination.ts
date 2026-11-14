import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

/** Cursor pagination query (stable ordering: createdAt desc, id desc). */
export class PageQuery {
  @IsOptional() @IsUUID() cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit: number = 20;
  @IsOptional() @IsString() tag?: string;
  /** Filter by author username (profile pages). */
  @IsOptional() @IsString() author?: string;
  /** Free-text search. */
  @IsOptional() @IsString() q?: string;
}

export function toPage<T extends { id: string }>(rows: T[], limit: number) {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
}

/** Prisma args for fetching `limit + 1` rows after an optional cursor. */
export function cursorArgs(q: PageQuery) {
  return {
    take: q.limit + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
  };
}
