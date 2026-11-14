import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class StartConversationDto {
  @Transform(trim) @IsString() @Length(3, 20) username: string;
}

export class SendMessageDto {
  @Transform(trim) @IsString() @Length(1, 2000) body: string;

  /** Client-generated idempotency key; resending the same key never duplicates the message. */
  @IsString() @Matches(/^[A-Za-z0-9_-]{8,64}$/) clientMsgId: string;
}
