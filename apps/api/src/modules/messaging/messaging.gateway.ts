import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Push channel only: clients SEND over REST (ack + idempotency), RECEIVE over Socket.io.
 * Auth happens in the handshake (`auth: { token }`); each user joins a private room `user:<id>`.
 * NOTE: scaling beyond one API instance needs the Redis adapter (@socket.io/redis-adapter).
 */
@WebSocketGateway()
export class MessagingGateway implements OnGatewayConnection {
  private readonly logger = new Logger(MessagingGateway.name);
  @WebSocketServer() private server: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;
      if (typeof token !== 'string') throw new Error('no token');
      const { sub } = await this.jwt.verifyAsync<{ sub: string }>(token);
      const user = await this.prisma.user.findUnique({ where: { id: sub }, select: { id: true, isActive: true } });
      if (!user?.isActive) throw new Error('inactive');
      await client.join(`user:${user.id}`);
    } catch {
      this.logger.debug('Socket rejected');
      client.disconnect(true);
    }
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }
}
